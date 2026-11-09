import type * as THREE from "three";
import type { CarSpec } from "../cars";
import { $, format } from "../hud";
import type { World } from "../world";
import { GymRun, HIT_MS, LEVELS, LEVEL_IDS, MISS_MS, RunStatus, Step, build_course, find_site, to_world, type Course, type GymLevel, type Site } from "./gymkhana";
import { GymkhanaView } from "./gymkhana-view";
import { PARK_IDS, PARK_LEVELS, ParkRun, ParkStatus, Verdict, park_footprint, park_solids, type ParkLevel } from "./parking";
import { ParkingView } from "./parking-view";
import { MAX_STARS, Track, local_store, type RaceRecord } from "./track";

const SPAWN_LIFT = 0.75;
const NOTICE_MS = 2500;
const DEG = 180 / Math.PI;

export interface Driven {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  readonly heading: number;
  readonly spec: CarSpec;
}

interface Listed {
  id: string;
  name: string;
  brings: string;
}

const star_text = (stars: number) => "★".repeat(stars) + "☆".repeat(MAX_STARS - stars);

function line(label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  const name = document.createElement("span");
  name.className = "dim";
  name.textContent = label;
  const text = document.createElement("b");
  text.textContent = value;
  row.append(name, text);
  return row;
}

export class Modes {
  private readonly track: Track;
  private readonly park_track: Track;
  private site: Site | null | undefined;
  private park_site: Site | null | undefined;
  private level: GymLevel | null = null;
  private course: Course | null = null;
  private run: GymRun | null = null;
  private view: GymkhanaView | null = null;
  private park_level: ParkLevel | null = null;
  private park: ParkRun | null = null;
  private park_view: ParkingView | null = null;
  private unplace: (() => void) | null = null;
  private high = true;
  private readonly park_area = park_footprint();
  private abort: AbortController | null = null;
  private status_key = "";
  private readonly el = {
    menu: $("modes"),
    levels: $("gym-levels", HTMLOListElement),
    stars: $("gym-stars"),
    park_levels: $("park-levels", HTMLOListElement),
    park_stars: $("park-stars"),
    race: $("race-record"),
    status: $("mode-status"),
    result: $("mode-result"),
    title: $("mode-result-title"),
    result_stars: $("mode-result-stars"),
    lines: $("mode-result-lines"),
    retry: $("mode-retry", HTMLButtonElement),
    next: $("mode-next", HTMLButtonElement),
    exit: $("mode-exit", HTMLButtonElement),
    free: $("free-drive", HTMLButtonElement),
  };

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly start_index: number,
    private readonly race_record: () => RaceRecord,
    private readonly place: (x: number, y: number, z: number, heading: number) => void,
    private readonly race_busy: () => boolean,
  ) {
    this.track = new Track("gymkhana", world.seed, LEVEL_IDS, local_store());
    this.park_track = new Track("parking", world.seed, PARK_IDS, local_store());
  }

  get active(): boolean {
    return this.run !== null || this.park !== null;
  }

  get current(): GymRun | null {
    return this.run;
  }

  get parking(): boolean {
    return this.park !== null;
  }

  get high_view(): boolean {
    return this.park !== null && this.high;
  }

  toggle_view() {
    this.high = !this.high;
  }

  start() {
    this.abort = new AbortController();
    const { signal } = this.abort;
    this.el.menu.addEventListener("toggle", () => this.render_menu(), { signal });
    const pick = (e: Event) => {
      const button = e.target instanceof Element ? e.target.closest<HTMLButtonElement>("button[data-level]") : null;
      if (!button?.dataset.level) return;
      this.el.menu.hidePopover();
      this.play(button.dataset.level);
    };
    this.el.levels.addEventListener("click", pick, { signal });
    this.el.park_levels.addEventListener("click", pick, { signal });
    this.el.retry.addEventListener("click", () => this.restart(), { signal });
    this.el.next.addEventListener("click", () => this.play_next(), { signal });
    this.el.exit.addEventListener("click", () => this.exit(), { signal });
    this.el.free.addEventListener(
      "click",
      () => {
        this.el.menu.hidePopover();
        this.exit();
      },
      { signal },
    );
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
    this.exit();
  }

  play(id: string) {
    if (PARK_IDS.includes(id)) return this.play_park(id);
    const level = LEVELS.find((l) => l.id === id);
    if (!level || !this.track.is_open(id)) return;
    if (this.race_busy()) return this.notice("Leave the lobby race to play gymkhana");
    if (this.site === undefined) this.site = find_site(this.world, this.start_index);
    this.clear();
    this.level = level;
    if (!this.site) {
      this.show_status("No flat ground near the start on this map");
      return;
    }
    this.course = build_course(this.world.seed, this.site, level);
    this.restart();
  }

  private play_park(id: string) {
    const level = PARK_LEVELS.find((l) => l.id === id);
    if (!level || !this.park_track.is_open(id)) return;
    if (this.race_busy()) return this.notice("Leave the lobby race to park");
    if (this.park_site === undefined) this.park_site = find_site(this.world, this.start_index, this.park_area);
    this.clear();
    this.level = null;
    if (!this.park_site) {
      this.show_status("No flat ground near the start on this map");
      return;
    }
    this.park_level = level;
    this.restart();
  }

  restart() {
    if (this.park_level) return this.restart_park(this.park_level);
    const { course } = this;
    if (!course) return;
    this.view?.dispose();
    this.view = new GymkhanaView(course, this.world);
    this.scene.add(this.view.root);
    this.run = new GymRun(course);
    this.el.result.hidden = true;
    const { site } = course;
    this.place(site.x, this.world.height(site.x, site.z) + SPAWN_LIFT, site.z, site.heading);
  }

  private restart_park(level: ParkLevel) {
    const site = this.park_site;
    if (!site) return;
    this.park_view?.dispose();
    this.unplace?.();
    this.park_view = new ParkingView(site, level, this.world, this.world.seed, this.park_area);
    this.scene.add(this.park_view.root);
    const solids = park_solids(site, level, (x, z) => this.world.height(x, z));
    this.unplace = this.world.place(solids);
    this.park = new ParkRun(site, level, solids);
    this.el.result.hidden = true;
    const at = to_world(site, level.start.u, level.start.v);
    this.place(at.x, this.world.height(at.x, at.z) + SPAWN_LIFT, at.z, site.heading + level.start.heading);
  }

  exit() {
    this.clear();
    this.level = null;
    this.el.status.hidden = true;
  }

  private clear() {
    this.view?.dispose();
    this.view = null;
    this.course = null;
    this.run = null;
    this.park_view?.dispose();
    this.park_view = null;
    this.unplace?.();
    this.unplace = null;
    this.park = null;
    this.park_level = null;
    this.el.result.hidden = true;
    this.status_key = "";
  }

  private play_next() {
    const ids = this.park_level ? PARK_IDS : LEVEL_IDS;
    const next = ids[ids.indexOf(this.park_level?.id ?? this.level?.id ?? "") + 1];
    if (next) this.play(next);
  }

  /** `sim_dt`: seconds of physics stepped this frame, 0 while the sim is paused. */
  update(sim_dt: number, car: Driven) {
    if (this.park) return this.update_park(sim_dt, car, this.park);
    const { run, view, level } = this;
    if (!run || !view || !level) return;
    const was = run.status;
    const hits = run.update(sim_dt * 1000, { x: car.pos.x, z: car.pos.z, heading: car.heading, speed: car.vel.length() }, {
      circles: car.spec.circles,
      radius: car.spec.radius,
      length: car.spec.body.length,
      width: car.spec.body.width,
    });
    view.knock(hits);
    view.update(sim_dt);
    const step = run.step;
    view.target(step === Step.SPIN ? "spin" : step === Step.STOP ? "stop" : null);
    if (was !== RunStatus.DONE && run.status === RunStatus.DONE) this.finish(run, level);
    const doing =
      run.status === RunStatus.READY
        ? "cross the start line"
        : step === Step.SLALOM
          ? `slalom ${run.next + 1}/${run.course.sides.length}`
          : step === Step.SPIN
            ? "spin 180° in the box"
            : step === Step.STOP
              ? "stop in the box, facing back"
              : "done";
    const penalty = run.penalty_ms();
    this.show_status(`${level.name} · ${format(run.total())}${penalty ? ` (+${penalty / 1000} s)` : ""} · ${doing}`);
  }

  private update_park(sim_dt: number, car: Driven, run: ParkRun) {
    const was = run.status;
    run.update(sim_dt * 1000, { x: car.pos.x, z: car.pos.z, heading: car.heading, speed: car.vel.length() }, {
      circles: car.spec.circles,
      radius: car.spec.radius,
      length: car.spec.body.length,
      width: car.spec.body.width,
    });
    const verdict = run.last.verdict;
    this.park_view?.inside(verdict === Verdict.INSIDE);
    if (was !== ParkStatus.DONE && run.status === ParkStatus.DONE) this.finish_park(run);
    const doing =
      run.status === ParkStatus.READY
        ? `park in the marked bay · C ${this.high ? "chase" : "high"} view`
        : run.status === ParkStatus.DONE
          ? "parked"
          : verdict === Verdict.INSIDE
            ? run.held > 0
              ? "hold it"
              : "stop to park"
            : verdict === Verdict.BACKWARDS
              ? "facing the wrong way"
              : verdict === Verdict.CROOKED
                ? "straighten up"
                : "park in the marked bay";
    const touches = run.touches ? ` · touches ${run.touches}` : "";
    this.show_status(`${run.level.name} · ${format(run.elapsed())}${touches} · ${doing}`);
  }

  private notice(text: string) {
    this.show_status(text);
    setTimeout(() => {
      if (this.status_key === text && !this.active) this.el.status.hidden = true;
    }, NOTICE_MS);
  }

  private show_status(text: string) {
    if (text === this.status_key) return;
    this.status_key = text;
    this.el.status.hidden = false;
    this.el.status.textContent = text;
  }

  private finish(run: GymRun, level: GymLevel) {
    const stars = run.stars();
    const ms = Math.round(run.total());
    const { improved, first } = this.track.record(level.id, { stars, ms });
    const best = this.track.runs[level.id];
    const { el } = this;
    el.title.textContent = `${level.name}${improved && !first ? " · new best" : ""}`;
    el.result_stars.textContent = star_text(stars);
    el.result_stars.setAttribute("aria-label", `${stars} of ${MAX_STARS} stars`);
    el.lines.replaceChildren(
      line("time", format(run.elapsed())),
      line(`cones ×${run.hits}`, `+${(run.hits * HIT_MS) / 1000} s`),
      line(`missed ×${run.misses}`, `+${(run.misses * MISS_MS) / 1000} s`),
      line("total", format(ms)),
      line("par", format(run.course.par_ms)),
      line("best", best ? `${format(best.ms)} ${star_text(best.stars)}` : "--"),
    );
    const index = LEVEL_IDS.indexOf(level.id);
    el.next.hidden = index + 1 >= LEVEL_IDS.length;
    el.next.disabled = !this.track.is_open(LEVEL_IDS[index + 1] ?? "");
    el.result.hidden = false;
  }

  private finish_park(run: ParkRun) {
    const { level } = run;
    const stars = run.stars();
    const result = run.result();
    const ms = Math.round(result.ms);
    const { improved, first } = this.park_track.record(level.id, { stars, ms });
    const best = this.park_track.runs[level.id];
    const { el } = this;
    el.title.textContent = `${level.name}${improved && !first ? " · new best" : ""}`;
    el.result_stars.textContent = star_text(stars);
    el.result_stars.setAttribute("aria-label", `${stars} of ${MAX_STARS} stars`);
    el.lines.replaceChildren(
      line("time", format(ms)),
      line("par", format(level.par_ms)),
      line("touches", String(result.touches)),
      line("angle", `${(result.angle * DEG).toFixed(1)}°`),
      line("off centre", `${result.offset.toFixed(2)} m`),
      line("best", best ? `${format(best.ms)} ${star_text(best.stars)}` : "--"),
    );
    const index = PARK_IDS.indexOf(level.id);
    el.next.hidden = index + 1 >= PARK_IDS.length;
    el.next.disabled = !this.park_track.is_open(PARK_IDS[index + 1] ?? "");
    el.result.hidden = false;
  }

  private render_levels(list: HTMLOListElement, total: HTMLElement, levels: readonly Listed[], track: Track) {
    total.textContent = `${track.stars} / ${levels.length * MAX_STARS} ★`;
    list.replaceChildren(
      ...levels.map((level, i) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.level = level.id;
        const open = track.is_open(level.id);
        button.disabled = !open;
        const run = track.runs[level.id];
        const name = document.createElement("span");
        name.textContent = `${i + 1}. ${level.name}`;
        const score = document.createElement("span");
        score.className = "dim";
        score.textContent = !open ? "locked" : run ? `${star_text(run.stars)} ${format(run.ms)}` : "new";
        button.title = level.brings;
        button.append(name, score);
        item.append(button);
        return item;
      }),
    );
  }

  private render_menu() {
    const { el } = this;
    this.render_levels(el.levels, el.stars, LEVELS, this.track);
    this.render_levels(el.park_levels, el.park_stars, PARK_LEVELS, this.park_track);
    const record = this.race_record();
    const bests = Object.entries(record.best)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([laps, ms]) => `${laps} lap${laps === "1" ? "" : "s"} ${format(ms)}`);
    el.race.textContent = `${bests.length ? bests.join(" · ") : "no finishes yet"} · wins ${record.wins} · podiums ${record.podiums}`;
  }
}

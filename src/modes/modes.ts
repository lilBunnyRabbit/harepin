import * as THREE from "three";
import type { CarSpec } from "../cars";
import { Ghost } from "../ghost";
import { $, format } from "../hud";
import { ROAD_HALF, type World } from "../world";
import { world_key } from "../worldgen/types";
import { ComboEnd, DRIFT_IDS, DRIFT_LEVELS, DriftRun, DriftStatus, LEAD, build_zone, type DriftLevel } from "./drift";
import { DriftView } from "./drift-view";
import { HUNT_IDS, HUNT_LEVELS, HuntRun, HuntStatus, build_hunt, type HuntLevel } from "./hunt";
import { HuntView } from "./hunt-view";
import { DUEL_IDS, DUEL_LEAD, DUEL_LEVELS, DuelRun, DuelStatus, build_route, type DuelLevel } from "./duel";
import { DuelView } from "./duel-view";
import { GymRun, HIT_MS, LEVELS, LEVEL_IDS, MISS_MS, RunStatus, Step, build_course, find_site, to_world, type Course, type GymLevel, type Site } from "./gymkhana";
import { GymkhanaView } from "./gymkhana-view";
import { PARK_IDS, PARK_LEVELS, ParkRun, ParkStatus, Verdict, park_footprint, park_solids, type ParkLevel } from "./parking";
import { ParkingView } from "./parking-view";
import { MAX_STARS, Track, local_store, type RaceRecord, type StarRun } from "./track";

const SPAWN_LIFT = 0.75;
const NOTICE_MS = 2500;
const DEG = 180 / Math.PI;
const LOST_MS = 1500;

export interface Driven {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  readonly heading: number;
  readonly spec: CarSpec;
}

interface Listed {
  id: string;
  name: string;
  brings: string;
}

function star_row(stars: number): HTMLSpanElement {
  const row = document.createElement("span");
  row.className = "stars";
  const empty = document.createElement("span");
  empty.className = "star-empty";
  empty.textContent = "☆".repeat(MAX_STARS - stars);
  row.append("★".repeat(stars), empty);
  return row;
}
const points = (score: number) => Math.round(score).toLocaleString("en-US");
const run_text = (run: StarRun) => (run.score === undefined ? format(run.ms) : `${points(run.score)} pts`);

function line(label: string, ...value: (string | Node)[]): HTMLElement {
  const row = document.createElement("div");
  const name = document.createElement("span");
  name.className = "dim";
  name.textContent = label;
  const text = document.createElement("b");
  text.append(...value);
  row.append(name, text);
  return row;
}

export class Modes {
  private readonly track: Track;
  private readonly park_track: Track;
  private readonly drift_track: Track;
  private readonly hunt_track: Track;
  private readonly duel_track: Track;
  private site: Site | null | undefined;
  private park_site: Site | null | undefined;
  private level: GymLevel | null = null;
  private course: Course | null = null;
  private run: GymRun | null = null;
  private view: GymkhanaView | null = null;
  private park_level: ParkLevel | null = null;
  private drift_level: DriftLevel | null = null;
  private hunt_level: HuntLevel | null = null;
  private duel_level: DuelLevel | null = null;
  private park: ParkRun | null = null;
  private park_view: ParkingView | null = null;
  private drift: DriftRun | null = null;
  private drift_view: DriftView | null = null;
  private hunt: HuntRun | null = null;
  private hunt_view: HuntView | null = null;
  private duel: DuelRun | null = null;
  private duel_view: DuelView | null = null;
  private ghost: Ghost | null = null;
  private ghost_id = "";
  private readonly ghost_at = new THREE.Vector3();
  private unplace: (() => void) | null = null;
  private high = true;
  private readonly park_area = park_footprint();
  private abort: AbortController | null = null;
  private status_key = "";
  private lost_at = -Infinity;
  private readonly el = {
    menu: $("modes"),
    levels: $("gym-levels", HTMLOListElement),
    stars: $("gym-stars"),
    park_levels: $("park-levels", HTMLOListElement),
    park_stars: $("park-stars"),
    drift_levels: $("drift-levels", HTMLOListElement),
    drift_stars: $("drift-stars"),
    hunt_levels: $("hunt-levels", HTMLOListElement),
    hunt_stars: $("hunt-stars"),
    duel_levels: $("duel-levels", HTMLOListElement),
    duel_stars: $("duel-stars"),
    hint: $("mode-hint"),
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
    private readonly chime: () => void,
    private readonly camera: THREE.Camera,
  ) {
    this.track = new Track("gymkhana", world.seed, LEVEL_IDS, local_store(), world.kind);
    this.park_track = new Track("parking", world.seed, PARK_IDS, local_store(), world.kind);
    this.drift_track = new Track("drift", world.seed, DRIFT_IDS, local_store(), world.kind);
    this.hunt_track = new Track("hunt", world.seed, HUNT_IDS, local_store(), world.kind);
    this.duel_track = new Track("duel", world.seed, DUEL_IDS, local_store(), world.kind);
  }

  get active(): boolean {
    return this.run !== null || this.park !== null || this.drift !== null || this.hunt !== null || this.duel !== null;
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
    this.el.drift_levels.addEventListener("click", pick, { signal });
    this.el.hunt_levels.addEventListener("click", pick, { signal });
    this.el.duel_levels.addEventListener("click", pick, { signal });
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
    if (this.world.kind === "sky" && !DRIFT_IDS.includes(id) && !DUEL_IDS.includes(id)) return this.notice("Gymkhana, parking and gate hunts need open ground: drive the island for them");
    if (PARK_IDS.includes(id)) return this.play_park(id);
    if (DRIFT_IDS.includes(id)) return this.play_drift(id);
    if (HUNT_IDS.includes(id)) return this.play_hunt(id);
    if (DUEL_IDS.includes(id)) return this.play_duel(id);
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

  private play_drift(id: string) {
    const level = DRIFT_LEVELS.find((l) => l.id === id);
    if (!level || !this.drift_track.is_open(id)) return;
    if (this.race_busy()) return this.notice("Leave the lobby race to drift");
    this.clear();
    this.level = null;
    this.drift_level = level;
    this.restart();
  }

  private restart_drift(level: DriftLevel) {
    const zone = build_zone(this.world.seed, this.world.road, level);
    this.drift_view?.dispose();
    this.drift_view = new DriftView(zone, this.world);
    this.scene.add(this.drift_view.root);
    this.drift = new DriftRun(zone, this.world.solids);
    this.lost_at = -Infinity;
    this.el.result.hidden = true;
    this.place_on(zone.points[0]);
  }

  private play_hunt(id: string) {
    const level = HUNT_LEVELS.find((l) => l.id === id);
    if (!level || !this.hunt_track.is_open(id)) return;
    if (this.race_busy()) return this.notice("Leave the lobby race to hunt gates");
    this.clear();
    this.level = null;
    this.hunt_level = level;
    this.restart();
  }

  private restart_hunt(level: HuntLevel) {
    const from = this.world.road[(this.start_index + this.world.road.length) % this.world.road.length];
    const hunt = build_hunt(this.world.seed, this.world, from, level);
    this.hunt_view?.dispose();
    this.hunt_view = new HuntView(hunt, this.world);
    this.scene.add(this.hunt_view.root);
    this.hunt = new HuntRun(hunt);
    this.el.result.hidden = true;
    this.place_on(from);
  }

  private play_duel(id: string) {
    const level = DUEL_LEVELS.find((l) => l.id === id);
    if (!level || !this.duel_track.is_open(id)) return;
    if (this.race_busy()) return this.notice("Leave the lobby race to duel your ghost");
    this.clear();
    this.level = null;
    this.duel_level = level;
    this.restart();
  }

  private restart_duel(level: DuelLevel) {
    const route = build_route(this.world.seed, this.world.road, level, (index) => this.world.clear_spawn(index));
    this.duel_view?.dispose();
    this.duel_view = new DuelView(route, this.world);
    this.scene.add(this.duel_view.root);
    if (this.ghost_id !== level.id) {
      this.ghost?.dispose();
      this.ghost = new Ghost(this.scene, this.world.seed, `harepin:ghost:duel:${level.id}:${world_key(this.world.seed, this.world.kind)}`);
      this.ghost_id = level.id;
    }
    this.ghost?.start();
    this.duel = new DuelRun(route);
    this.el.result.hidden = true;
    this.place_on(route.points[0]);
  }

  private place_on(p: { x: number; z: number; tx: number; tz: number }) {
    this.place(p.x, this.world.height(p.x, p.z) + SPAWN_LIFT, p.z, Math.atan2(p.tx, p.tz));
  }

  restart() {
    if (this.park_level) return this.restart_park(this.park_level);
    if (this.drift_level) return this.restart_drift(this.drift_level);
    if (this.hunt_level) return this.restart_hunt(this.hunt_level);
    if (this.duel_level) return this.restart_duel(this.duel_level);
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
    this.drift_view?.dispose();
    this.drift_view = null;
    this.drift = null;
    this.drift_level = null;
    this.hunt_view?.dispose();
    this.hunt_view = null;
    this.hunt = null;
    this.hunt_level = null;
    this.duel_view?.dispose();
    this.duel_view = null;
    this.duel = null;
    this.duel_level = null;
    this.ghost?.update(null, this.camera.position);
    this.el.hint.hidden = true;
    this.el.result.hidden = true;
    this.status_key = "";
  }

  private play_next() {
    const ids = this.park_level ? PARK_IDS : this.drift_level ? DRIFT_IDS : this.hunt_level ? HUNT_IDS : this.duel_level ? DUEL_IDS : LEVEL_IDS;
    const current = this.park_level ?? this.drift_level ?? this.hunt_level ?? this.duel_level ?? this.level;
    const next = ids[ids.indexOf(current?.id ?? "") + 1];
    if (next) this.play(next);
  }

  /** `sim_dt`: seconds of physics stepped this frame, 0 while the sim is paused. */
  update(sim_dt: number, car: Driven) {
    if (this.park) return this.update_park(sim_dt, car, this.park);
    if (this.drift) return this.update_drift(sim_dt, car, this.drift);
    if (this.hunt) return this.update_hunt(sim_dt, car, this.hunt);
    if (this.duel) return this.update_duel(sim_dt, car, this.duel);
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

  private update_drift(sim_dt: number, car: Driven, run: DriftRun) {
    const was = run.status;
    const end = run.update(
      sim_dt * 1000,
      { x: car.pos.x, z: car.pos.z, heading: car.heading, vx: car.vel.x, vz: car.vel.z },
      { circles: car.spec.circles, radius: car.spec.radius, length: car.spec.body.length, width: car.spec.body.width },
      ROAD_HALF,
    );
    if (end === ComboEnd.LOST) this.lost_at = run.clock;
    if (was !== DriftStatus.DONE && run.status === DriftStatus.DONE) this.finish_drift(run);
    const { level } = run.zone;
    const { combo } = run;
    if (run.status === DriftStatus.READY) {
      this.show_status(`${level.name} · zone in ${Math.round((LEAD - Math.max(0, run.tracker.index)) * 2)} m`);
      return;
    }
    const live = combo.chain > 0 ? ` · ×${combo.mult} +${points(combo.chain)}` : run.clock - this.lost_at < LOST_MS ? " · wall, combo lost" : "";
    this.show_status(`${level.name} · ${points(combo.score)} pts${live}`);
  }

  private update_hunt(sim_dt: number, car: Driven, run: HuntRun) {
    const was = run.status;
    const hit = run.update(sim_dt * 1000, car.pos.x, car.pos.z, car.vel.length());
    if (hit >= 0) {
      this.hunt_view?.found(hit);
      if (run.status !== HuntStatus.DONE) this.chime();
    }
    if (was !== HuntStatus.DONE && run.status === HuntStatus.DONE) {
      this.el.hint.hidden = true;
      this.finish_hunt(run);
      return;
    }
    const next = run.nearest(car.pos.x, car.pos.z);
    this.hunt_view?.aim(next);
    this.hunt_view?.update(sim_dt);
    const gate = run.hunt.gates[next];
    const { gates, level } = run.hunt;
    if (!gate) return;
    const dx = gate.x - car.pos.x;
    const dz = gate.z - car.pos.z;
    const turn = Math.atan2(Math.sin(Math.atan2(dx, dz) - car.heading), Math.cos(Math.atan2(dx, dz) - car.heading));
    this.el.hint.hidden = false;
    this.el.hint.style.setProperty("--turn", `${(-turn * DEG).toFixed(1)}deg`);
    const doing = run.status === HuntStatus.READY ? "drive to start the clock" : format(run.elapsed());
    this.show_status(`${level.name} · ${run.found.size}/${gates.length} · ${doing} · ${Math.round(Math.hypot(dx, dz))} m`);
  }

  private update_duel(sim_dt: number, car: Driven, run: DuelRun) {
    const was = run.status;
    run.update(sim_dt * 1000, car.pos.x, car.pos.z);
    const { ghost } = this;
    const running = run.status === DuelStatus.RUNNING;
    if (running && sim_dt > 0) ghost?.record(run.elapsed(), car);
    ghost?.update(running ? run.elapsed() : null, this.camera.position);
    if (was !== DuelStatus.DONE && run.status === DuelStatus.DONE) {
      ghost?.record(run.elapsed(), car);
      this.finish_duel(run);
      return;
    }
    const { level } = run.route;
    if (run.status === DuelStatus.READY) {
      const to_line = Math.max(0, Math.round(-run.route.at[Math.max(0, run.tracker.index)]));
      this.show_status(`${level.name} · start line in ${to_line} m${ghost?.has_best ? "" : " · this run sets your ghost"}`);
      return;
    }
    const gap = run.gap(ghost?.position(run.elapsed(), this.ghost_at) ?? null);
    const versus = gap === null ? (ghost?.has_best ? "ghost finished" : "no ghost yet") : `${gap >= 0 ? "ahead" : "behind"} ${Math.abs(Math.round(gap))} m`;
    this.show_status(`${level.name} · ${format(run.elapsed())} · ${versus}`);
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

  private show_result(title: string, stars: number, lines: HTMLElement[], ids: readonly string[], id: string, track: Track) {
    const { el } = this;
    el.title.textContent = title;
    el.result_stars.replaceChildren(star_row(stars));
    el.result_stars.setAttribute("aria-label", `${stars} of ${MAX_STARS} stars`);
    el.lines.replaceChildren(...lines);
    const index = ids.indexOf(id);
    el.next.hidden = index + 1 >= ids.length;
    el.next.disabled = !track.is_open(ids[index + 1] ?? "");
    el.result.hidden = false;
    this.chime();
  }

  private finish_drift(run: DriftRun) {
    const { zone, combo } = run;
    const { level } = zone;
    const stars = run.stars();
    const score = Math.round(combo.score);
    const { improved, first } = this.drift_track.record(level.id, { stars, ms: Math.max(1, Math.round(run.elapsed())), score });
    const best = this.drift_track.runs[level.id];
    this.show_result(
      `${level.name}${run.timed_out ? " · time up" : improved && !first ? " · new best" : ""}`,
      stars,
      [
        line("score", points(score)),
        line("best chain", points(combo.best_chain)),
        line("walls", String(combo.lost)),
        line("time", format(run.elapsed())),
        line("★★ / ★★★", `${points(zone.silver)} / ${points(zone.gold)}`),
        line("best", ...(best ? [`${run_text(best)} `, star_row(best.stars)] : ["--"])),
      ],
      DRIFT_IDS,
      level.id,
      this.drift_track,
    );
  }

  private finish_hunt(run: HuntRun) {
    const { level, par_ms, gates } = run.hunt;
    const stars = run.stars();
    const ms = Math.round(run.elapsed());
    const { improved, first } = this.hunt_track.record(level.id, { stars, ms });
    const best = this.hunt_track.runs[level.id];
    this.show_result(
      `${level.name}${improved && !first ? " · new best" : ""}`,
      stars,
      [line("time", format(ms)), line("gates", String(gates.length)), line("par", format(par_ms)), line("best", ...(best ? [`${run_text(best)} `, star_row(best.stars)] : ["--"]))],
      HUNT_IDS,
      level.id,
      this.hunt_track,
    );
  }

  private finish_duel(run: DuelRun) {
    const { level, par_ms } = run.route;
    const stars = run.stars();
    const ms = Math.round(run.elapsed());
    const before = this.duel_track.runs[level.id];
    const { improved, first } = this.duel_track.record(level.id, { stars, ms });
    this.ghost?.finish(improved);
    const best = this.duel_track.runs[level.id];
    const versus = !before ? "new ghost" : `${ms <= before.ms ? "−" : "+"}${(Math.abs(before.ms - ms) / 1000).toFixed(2)} s`;
    this.show_result(
      `${level.name}${improved && !first ? " · new best" : ""}`,
      stars,
      [line("time", format(ms)), line("vs ghost", versus), line("par", format(par_ms)), line("best", ...(best ? [`${run_text(best)} `, star_row(best.stars)] : ["--"]))],
      DUEL_IDS,
      level.id,
      this.duel_track,
    );
  }

  private finish(run: GymRun, level: GymLevel) {
    const stars = run.stars();
    const ms = Math.round(run.total());
    const { improved, first } = this.track.record(level.id, { stars, ms });
    const best = this.track.runs[level.id];
    const { el } = this;
    el.title.textContent = `${level.name}${improved && !first ? " · new best" : ""}`;
    el.result_stars.replaceChildren(star_row(stars));
    el.result_stars.setAttribute("aria-label", `${stars} of ${MAX_STARS} stars`);
    el.lines.replaceChildren(
      line("time", format(run.elapsed())),
      line(`cones ×${run.hits}`, `+${(run.hits * HIT_MS) / 1000} s`),
      line(`missed ×${run.misses}`, `+${(run.misses * MISS_MS) / 1000} s`),
      line("total", format(ms)),
      line("par", format(run.course.par_ms)),
      line("best", ...(best ? [`${format(best.ms)} `, star_row(best.stars)] : ["--"])),
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
    el.result_stars.replaceChildren(star_row(stars));
    el.result_stars.setAttribute("aria-label", `${stars} of ${MAX_STARS} stars`);
    el.lines.replaceChildren(
      line("time", format(ms)),
      line("par", format(level.par_ms)),
      line("touches", String(result.touches)),
      line("angle", `${(result.angle * DEG).toFixed(1)}°`),
      line("off centre", `${result.offset.toFixed(2)} m`),
      line("best", ...(best ? [`${format(best.ms)} `, star_row(best.stars)] : ["--"])),
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
        if (run && open) score.append(star_row(run.stars), ` ${run_text(run)}`);
        else score.textContent = open ? "new" : "locked";
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
    this.render_levels(el.drift_levels, el.drift_stars, DRIFT_LEVELS, this.drift_track);
    this.render_levels(el.hunt_levels, el.hunt_stars, HUNT_LEVELS, this.hunt_track);
    this.render_levels(el.duel_levels, el.duel_stars, DUEL_LEVELS, this.duel_track);
    const record = this.race_record();
    const bests = Object.entries(record.best)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([laps, ms]) => `${laps} lap${laps === "1" ? "" : "s"} ${format(ms)}`);
    el.race.textContent = `${bests.length ? bests.join(" · ") : "no finishes yet"} · wins ${record.wins} · podiums ${record.podiums}`;
  }
}

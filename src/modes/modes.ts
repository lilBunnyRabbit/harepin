import type * as THREE from "three";
import { drop_height } from "../car/car";
import { car_sized, type CarSpec } from "../car/cars";
import { DEFAULT_BINDINGS, keys_text, type Bindings } from "../hud/bindings";
import { $, format } from "../hud/hud";
import type { World } from "../world/world";
import { KINDS } from "../worldgen/kinds/kinds";
import { LISTED } from "../worlds/worlds";
import { DRIFT_MODE } from "./drift-mode";
import { DUEL_MODE } from "./duel-mode";
import { GYMKHANA_MODE } from "./gymkhana-mode";
import { HUNT_MODE } from "./hunt-mode";
import type { Driven, Finish, Level, ModeCtx, ModeDef, ModeRun, RouteRun } from "./mode";
import { PARKING_MODE } from "./parking-mode";
import { RACE_MODE } from "./race-mode";
import { race_levels } from "./races";
import { run_text, star_row } from "./result";
import { MAX_STARS, Track, local_store, type RaceRecord } from "./track";
import "./modes.css";

export type { Driven } from "./mode";

export const MODES: readonly ModeDef[] = [RACE_MODE, GYMKHANA_MODE, PARKING_MODE, DRIFT_MODE, HUNT_MODE, DUEL_MODE];

const SPAWN_LIFT = 0.75;
const NOTICE_MS = 2500;
const DEG = 180 / Math.PI;
const OPEN_WORLDS = LISTED.filter((w) => KINDS[w.kind].open_ground).map((w) => `the ${w.map_label}`).join(" or ");
const OPEN_GROUND = `Needs open ground: drive ${OPEN_WORLDS} for it`;
const NO_GROUND_NOTICE = `Gymkhana, parking and gate hunts need open ground: drive ${OPEN_WORLDS} for them`;
const TOO_BIG = "Too big for this mode";

export interface LevelEntry {
  id: string;
  name: string;
  brings: string;
  stars: number;
  best: string | null;
  open: boolean;
  /** Race routes only: metres, and the par time in ms. */
  length: number | null;
  par_ms: number | null;
}

export interface ModeEntry {
  id: string;
  name: string;
  stars: number;
  max: number;
  blocked: string | null;
  levels: LevelEntry[];
}

interface Mode {
  def: ModeDef;
  levels: readonly Level[];
  track: Track;
}

interface Active {
  mode: Mode;
  level: Level;
  run: ModeRun | null;
  shown: boolean;
}

export class Modes {
  private readonly modes: Mode[];
  private current: Active | null = null;
  private lobby_lap: (() => boolean) | null = null;
  private high = true;
  private abort: AbortController | null = null;
  private status_key = "";
  private readonly el = {
    hint: $("mode-hint"),
    status: $("mode-status"),
    result: $("mode-result"),
    title: $("mode-result-title"),
    result_stars: $("mode-result-stars"),
    lines: $("mode-result-lines"),
    retry: $("mode-retry", HTMLButtonElement),
    next: $("mode-next", HTMLButtonElement),
    exit: $("mode-exit", HTMLButtonElement),
  };

  bindings: () => Bindings = () => DEFAULT_BINDINGS;
  /** Shows that a start waits on the rest of the world. */
  cover: (wait: Promise<void>) => Promise<void> = (wait) => wait;
  on_finish: ((mode: string) => void) | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly start_index: number,
    private readonly race_record: () => RaceRecord,
    private readonly place: (x: number, y: number, z: number, heading: number) => void,
    private readonly race_busy: () => boolean,
    private readonly chime: () => void,
    private readonly camera: THREE.Camera,
    private readonly spec: () => CarSpec,
  ) {
    this.modes = MODES.map((def) => {
      const levels = def.levels(world);
      const track = new Track(def.id, world.seed, levels.map((level) => level.id), local_store(), world.kind);
      return { def, levels, track };
    });
  }

  get active(): boolean {
    return (this.current?.run ?? null) !== null;
  }

  /** The route the running mode drives, null when it drives none of its own. */
  get route(): RouteRun | null {
    return this.current?.run?.route ?? null;
  }

  /** A solo race counting down: the car stays on the line. */
  get holding(): boolean {
    return this.current?.run?.holding === true;
  }

  /** Runs the lobby's race on `id` instead of the circuit; the lobby keeps the time, so there is no countdown or record here. */
  lobby_race(id: string, on_lap: () => boolean) {
    const route = this.world.routes.find((r) => r.id === id);
    const mode = this.modes.find((m) => m.def === RACE_MODE);
    if (!route || !mode) return;
    this.clear();
    this.lobby_lap = on_lap;
    this.begin(mode, race_levels([route])[0] ?? { id, name: id, brings: "" });
  }

  get parking(): boolean {
    return this.active && this.current?.mode.def.high_view === true;
  }

  get high_view(): boolean {
    return this.parking && this.high;
  }

  toggle_view() {
    this.high = !this.high;
  }

  start() {
    this.abort = new AbortController();
    const { signal } = this.abort;
    this.el.retry.addEventListener("click", () => this.restart(), { signal });
    this.el.next.addEventListener("click", () => this.play_next(), { signal });
    this.el.exit.addEventListener("click", () => this.exit(), { signal });
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
    this.exit();
  }

  play(id: string) {
    for (const mode of this.modes) {
      const level = mode.levels.find((l) => l.id === id);
      if (!level) continue;
      if (mode.def.needs_ground && !KINDS[this.world.kind].open_ground) return this.notice(NO_GROUND_NOTICE);
      if (mode.def.car_sized_only && !car_sized(this.spec())) return this.notice(TOO_BIG);
      if (!mode.track.is_open(id)) return;
      if (this.race_busy()) return this.notice(mode.def.busy_notice);
      this.clear();
      return this.begin(mode, level);
    }
  }

  private begin(mode: Mode, level: Level) {
    this.current = { mode, level, run: null, shown: false };
    this.launch(this.current);
  }

  private launch(active: Active) {
    // Mode sites and views read terrain anywhere on the map: a start before every chunk is in waits for the rest.
    if (!this.world.tiles.complete) {
      void this.cover(this.world.tiles.whole()).then(() => {
        if (this.current === active && !active.run) this.launch(active);
      }, (error: unknown) => console.error(error));
      return;
    }
    const run = active.mode.def.start(this.ctx(active.mode.track), active.level);
    if (typeof run === "string") return this.show_status(run);
    if (!run) return;
    active.run = run;
    active.shown = false;
    this.el.result.hidden = true;
  }

  private ctx(track: Track): ModeCtx {
    const { scene, world, start_index, camera } = this;
    const spawn = (x: number, z: number, heading: number) => this.place(x, world.height(x, z) + drop_height(this.spec(), SPAWN_LIFT), z, heading);
    return {
      scene,
      world,
      start_index,
      camera,
      track,
      lobby_lap: () => this.lobby_lap,
      race_busy: () => this.race_busy(),
      high: () => this.high,
      key_of: (action) => keys_text(this.bindings()[action]),
      spawn,
      spawn_on: (p) => spawn(p.x, p.z, Math.atan2(p.tx, p.tz)),
      chime: () => this.chime(),
      hint: (turn) => this.show_hint(turn),
      hide_hint: () => {
        this.el.hint.hidden = true;
      },
      exit: () => this.exit(),
    };
  }

  restart() {
    const active = this.current;
    if (!active) return;
    if (this.lobby_lap) return this.notice("Lobby race is running");
    active.run?.dispose();
    active.run = null;
    this.launch(active);
  }

  exit() {
    this.clear();
    this.el.status.hidden = true;
  }

  private clear() {
    this.current?.run?.dispose();
    this.current = null;
    this.lobby_lap = null;
    this.el.hint.hidden = true;
    this.el.result.hidden = true;
    this.status_key = "";
  }

  private play_next() {
    const active = this.current;
    if (!active) return;
    const ids = active.mode.levels.map((level) => level.id);
    const next = ids[ids.indexOf(active.level.id) + 1];
    if (next) this.play(next);
  }

  update(sim_dt: number, car: Driven) {
    const active = this.current;
    const run = active?.run;
    if (!active || !run) return;
    const status = run.update(sim_dt, car);
    if (this.current !== active || active.run !== run) return;
    const finish = active.shown ? null : run.finished();
    if (finish) {
      active.shown = true;
      this.show_result(finish, active);
    }
    if (status !== null) this.show_status(status);
  }

  private show_hint(turn: number) {
    this.el.hint.hidden = false;
    this.el.hint.style.setProperty("--turn", `${(-turn * DEG).toFixed(1)}deg`);
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

  private show_result(finish: Finish, active: Active) {
    const { el } = this;
    const { stars } = finish;
    const { levels, track } = active.mode;
    el.title.textContent = finish.title;
    el.result_stars.replaceChildren(star_row(stars));
    el.result_stars.setAttribute("aria-label", `${stars} of ${MAX_STARS} stars`);
    el.lines.replaceChildren(...finish.lines);
    const index = levels.findIndex((level) => level.id === active.level.id);
    el.next.hidden = index + 1 >= levels.length;
    el.next.disabled = !track.is_open(levels[index + 1]?.id ?? "");
    el.result.hidden = false;
    this.on_finish?.(active.mode.def.id);
    if (!finish.quiet) this.chime();
  }

  mode_list(): ModeEntry[] {
    const ground = KINDS[this.world.kind].open_ground;
    const fits = car_sized(this.spec());
    return this.modes
      .filter(({ levels }) => levels.length)
      .map(({ def, levels, track }) => ({
        id: def.id,
        name: def.name,
        stars: track.stars,
        max: levels.length * MAX_STARS,
        blocked: def.needs_ground && !ground ? OPEN_GROUND : def.car_sized_only && !fits ? TOO_BIG : null,
        levels: levels.map((level) => {
          const run = track.runs[level.id];
          const route = this.world.routes.find((r) => r.id === level.id);
          return {
            id: level.id,
            name: level.name,
            brings: level.brings,
            stars: run?.stars ?? 0,
            best: run ? run_text(run) : null,
            open: track.is_open(level.id),
            length: route?.length ?? null,
            par_ms: route?.par_ms ?? null,
          };
        }),
      }));
  }

  lobby_record(): string {
    const record = this.race_record();
    const bests = Object.entries(record.best)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([laps, ms]) => `${laps} lap${laps === "1" ? "" : "s"} ${format(ms)}`);
    return `${bests.length ? bests.join(" · ") : "No finishes yet"} · wins ${record.wins} · podiums ${record.podiums}`;
  }
}

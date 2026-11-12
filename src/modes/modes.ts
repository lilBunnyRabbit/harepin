import type * as THREE from "three";
import { TIERS, TUNE_PARAM, next_event, spot_of, tier_line, tier_of, tier_open, type CareerEvent } from "../career/career";
import { event_track, type Career } from "../career/career-store";
import { dev_ghost } from "../career/dev-ghost";
import { limit_text, same_machine, within, type CarLimit } from "../car/car-pick";
import { car_sized, type CarSpec } from "../car/cars";
import { build_code, parse_build } from "../car/build";
import { rating } from "../car/pi";
import { PRESETS } from "../car/presets";
import { DEFAULT_BINDINGS, keys_text, type Bindings } from "../hud/bindings";
import { $, format } from "../hud/hud";
import type { World } from "../world/world";
import { chunk_of } from "../worldgen/chunk-grid";
import { KINDS } from "../worldgen/kinds/kinds";
import { LISTED, WORLDS } from "../worlds/worlds";
import { DRIFT_MODE } from "./drift-mode";
import { DUEL_MODE } from "./duel-mode";
import { GYMKHANA_MODE } from "./gymkhana-mode";
import { HUNT_MODE } from "./hunt-mode";
import { Hits } from "./hits";
import type { Ground } from "./marks";
import type { Driven, Finish, Level, ModeCtx, ModeDef, ModeRun, RouteRun } from "./mode";
import { PARKING_MODE } from "./parking-mode";
import { RACE_MODE } from "./race-mode";
import { race_levels } from "./races";
import { line, run_text, star_row } from "./result";
import { MAX_STARS, Track, local_store, type RaceRecord } from "./track";
import "./modes.css";

export type { Driven } from "./mode";

const preset_code = (name: string): string | null => {
  const build = parse_build(PRESETS.find((p) => p.name === name)?.code);
  return build && build_code(build);
};

export const MODES: readonly ModeDef[] = [RACE_MODE, GYMKHANA_MODE, PARKING_MODE, DRIFT_MODE, HUNT_MODE, DUEL_MODE];

const NOTICE_MS = 2500;
const GOAL_MS = 4000;
const DEG = 180 / Math.PI;
const OPEN_WORLDS = LISTED.filter((w) => KINDS[w.kind].open_ground).map((w) => `the ${w.map_label}`).join(" or ");
const OPEN_GROUND = `Needs open ground: drive ${OPEN_WORLDS} for it`;
const NO_GROUND_NOTICE = `Gymkhana, parking and gate hunts need open ground: drive ${OPEN_WORLDS} for them`;
const TOO_BIG = "Too big for this mode";
const NOT_THIS_CAR = "Not raced in this car";
const STREAMED = "This mode is not on this world yet";
const NO_EVENT = "This event is not on this map";
const NEXT_LEVEL = "Next level";
const NEXT_EVENT = "Next event";

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
  /** Why the car being driven can't run it; null when it can. */
  blocked: string | null;
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
  /** The mode's own records, or the event's for a career run, which never writes free play's. */
  track: Track;
  event: CareerEvent | null;
  run: ModeRun | null;
  /** On a streamed world, the run built and waiting for the chunks at its start; a later launch or a clear replaces it. */
  starting: ModeRun | null;
  shown: boolean;
  /** An event run's PI at its start: a garage change that moves it ends the run, a new look does not. */
  pi: number | null;
}

export class Modes {
  private readonly modes: Mode[];
  private current: Active | null = null;
  private lobby_lap: (() => boolean) | null = null;
  private high = false;
  private abort: AbortController | null = null;
  private status_key = "";
  private notice_until = 0;
  private readonly el = {
    hint: $("mode-hint"),
    status: $("mode-status"),
    result: $("mode-result"),
    title: $("mode-result-title"),
    result_stars: $("mode-result-stars"),
    lines: $("mode-result-lines"),
    note: $("mode-result-note"),
    retry: $("mode-retry", HTMLButtonElement),
    next: $("mode-next", HTMLButtonElement),
    exit: $("mode-exit", HTMLButtonElement),
  };

  /** `?debug&at=`: the point along its route a race run starts on. */
  route_at = 0;
  bindings: () => Bindings = () => DEFAULT_BINDINGS;
  ghosts: () => boolean = () => true;
  /** Shows that a start waits on the rest of the world. */
  cover: (wait: Promise<void>) => Promise<void> = (wait) => wait;
  on_finish: ((mode: string) => void) | null = null;
  /** A short note over the HUD; a run says its goal on it as it starts. */
  toast: ((text: string, label: string, hold: number) => void) | null = null;
  /** Starts an event here, or reloads onto its map. */
  start_event: ((id: string) => void) | null = null;
  /** The step before a start that asks which car runs it: its code, or null when the player backs out. Events only for now. */
  pick_car: ((title: string, limit: CarLimit, own: string, signal: AbortSignal) => Promise<string | null>) | null = null;
  /** Puts `code` on the car; unsaved, a reload brings back the player's own car. */
  fit_car: ((code: string, save: boolean) => void) | null = null;
  car_code: (() => string) | null = null;
  /** Writes `code` as the saved car without fitting it. */
  save_car: ((code: string) => void) | null = null;
  private pick: AbortController | null = null;
  /** The player's own car while an event runs on another one, put back when they leave the event. */
  private kept: string | null = null;
  private fitting_ = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly start_index: number,
    private readonly race_record: () => RaceRecord,
    private readonly park: (x: number, z: number, heading: number) => void,
    private readonly race_busy: () => boolean,
    private readonly chime: () => void,
    private readonly camera: THREE.Camera,
    private readonly spec: () => CarSpec,
    private readonly career: Career,
  ) {
    this.modes = MODES.map((def) => {
      const levels = def.levels(world);
      const track = new Track(def.id, world.seed, levels.map((level) => level.id), local_store(), world.kind, world.levels);
      return { def, levels, track };
    });
  }

  /** True while an event fits its car or gives the player's back: a garage change the player did not make. */
  get fitting(): boolean {
    return this.fitting_;
  }

  /** True while an event runs on a car it lent the player: a new look on it is not the player's own car. */
  get borrowed(): boolean {
    return this.kept !== null;
  }

  get active(): boolean {
    return (this.current?.run ?? null) !== null;
  }

  get running(): string | null {
    return this.current?.run ? this.current.mode.def.name : null;
  }

  /** The route the running mode drives, null when it drives none of its own. */
  get route(): RouteRun | null {
    return this.current?.run?.route ?? null;
  }

  /** A solo race counting down: the car stays on the line. */
  get holding(): boolean {
    return this.pick !== null || this.current?.run?.holding === true;
  }

  /** Runs the lobby's race on `id` instead of the circuit; the lobby keeps the time, so there is no countdown or record here. */
  lobby_race(id: string, on_lap: () => boolean) {
    this.pick?.abort();
    this.give_back();
    const route = this.world.routes.find((r) => r.id === id);
    const mode = this.modes.find((m) => m.def === RACE_MODE);
    if (!route || !mode) return;
    this.clear();
    this.lobby_lap = on_lap;
    this.begin(mode, race_levels([route], WORLDS[this.world.kind].map_label)[0] ?? { id, name: id, brings: "" });
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
      if (this.too_big(mode)) return this.notice(TOO_BIG);
      if (this.left_out(id)) return this.notice(NOT_THIS_CAR);
      if (!mode.track.is_open(id)) return;
      if (this.race_busy()) return this.notice(mode.def.busy_notice);
      this.clear();
      this.give_back();
      return this.begin(mode, level);
    }
  }

  /** The caller has checked this map is the event's. Career levels are all open: the mode's own unlock order is free play's. */
  play_event(event: CareerEvent) {
    const spot = spot_of(event);
    const mode = this.modes.find((m) => m.def.id === event.mode);
    const level = mode?.levels.find((l) => l.id === spot.level);
    if (!mode || !level) return this.notice(NO_EVENT);
    const tier = tier_of(event);
    const before = TIERS[TIERS.indexOf(tier) - 1];
    // `?tune` opens every tier so the owner can set the non-race stars before any are earnable.
    const tune = new URLSearchParams(location.search).has(TUNE_PARAM);
    if (!tune && !tier_open(this.career.stars, tier)) return this.notice(`${tier.name} opens at ${tier.opens_at} ★ in ${before?.name ?? "the tier before"}`);
    if (mode.def.needs_ground && !KINDS[this.world.kind].open_ground) return this.notice(NO_GROUND_NOTICE);
    if (this.race_busy()) return this.notice(mode.def.busy_notice);
    if (this.pick) return;
    this.clear();
    void this.event_car(event, mode).then((ready) => {
      if (!ready) return this.give_back();
      if (this.too_big(mode)) return this.refuse(TOO_BIG);
      if (this.left_out(level.id)) return this.refuse(NOT_THIS_CAR);
      if (this.race_busy()) return this.refuse(mode.def.busy_notice);
      this.clear();
      this.begin(mode, level, event_track(event, local_store()), event);
    });
  }

  // A fixed preset goes on with no step; a class cap asks, with the cars over it greyed.
  private async event_car(event: CareerEvent, mode: Mode): Promise<boolean> {
    const { car } = event;
    if ("preset" in car) {
      const code = preset_code(car.preset);
      if (code) this.wear(code);
      return true;
    }
    if (!this.pick_car) return true;
    const pick = new AbortController();
    this.pick = pick;
    try {
      const own = this.kept ?? this.car_code?.() ?? "";
      const excludes = this.world.routes.find((r) => r.id === spot_of(event).level)?.excludes;
      const code = await this.pick_car(event.name, { cap: car.cap, car_sized_only: mode.def.car_sized_only, excludes }, own, pick.signal);
      if (code === null) return false;
      this.wear(code);
      return true;
    } finally {
      if (this.pick === pick) this.pick = null;
    }
  }

  private wear(code: string) {
    if (!this.fit_car || !this.car_code || code === this.car_code()) return;
    this.kept ??= this.car_code();
    this.fit(code, false);
  }

  private give_back() {
    const kept = this.kept;
    this.kept = null;
    if (kept !== null) this.fit(kept, true);
  }

  private fit(code: string, save: boolean) {
    this.fitting_ = true;
    try {
      this.fit_car?.(code, save);
    } finally {
      this.fitting_ = false;
    }
  }

  // A refused start leaves the event, so the player's car goes back on.
  private refuse(text: string) {
    this.clear();
    this.give_back();
    this.notice(text);
  }

  private wrong_car(event: CareerEvent | null): string | null {
    if (!event || !this.car_code) return null;
    const { car } = event;
    const code = this.car_code();
    const build = parse_build(code);
    if (!build) return null;
    if ("preset" in car) {
      const preset = parse_build(preset_code(car.preset));
      return !preset || same_machine(build, preset) ? null : `${event.name}: ${car.preset} only`;
    }
    return within(rating(build).class, car.cap) ? null : `${event.name}: ${limit_text(car.cap)}`;
  }

  private car_pi(): number | null {
    const build = parse_build(this.car_code?.());
    return build && rating(build).pi;
  }

  /**
   * A garage change the player made. A new look keeps an event run going on the event's car, and the player's own car
   * still comes back after it. Anything else makes the change their car; an event run it moves off its PI or its fit ends.
   */
  car_changed() {
    if (this.fitting_) return;
    const active = this.current?.run ? this.current : null;
    const event = active?.event ?? null;
    if (!active || !event) {
      this.kept = null;
      return;
    }
    const why = this.wrong_car(event) ?? (this.car_pi() === active.pi ? null : `${event.name}: car changed mid-run`);
    if (!why) {
      // The garage saved the repainted event car; the player's own stays the saved one, for a reload mid-run.
      if (this.kept !== null) this.save_car?.(this.kept);
      return;
    }
    this.kept = null;
    this.exit();
    this.notice(why);
  }

  private too_big(mode: Mode): boolean {
    return mode.def.car_sized_only && !car_sized(this.spec());
  }

  /** The level is a route the car being driven is not raced in. */
  private left_out(id: string): boolean {
    return this.world.routes.find((r) => r.id === id)?.excludes?.includes(this.spec().id) === true;
  }

  private begin(mode: Mode, level: Level, track = mode.track, event: CareerEvent | null = null) {
    this.current = { mode, level, track, event, run: null, starting: null, shown: false, pi: null };
    this.launch(this.current);
  }

  private launch(active: Active) {
    const { tiles } = this.world;
    if (tiles.streamed && !active.mode.def.streams) {
      return this.refuse(STREAMED);
    }
    // Mode sites and views read terrain anywhere on a compact map: a start before every chunk is in waits for the rest.
    if (!tiles.streamed && !tiles.complete) {
      void this.cover(tiles.whole()).then(() => {
        if (this.current === active && !active.run) this.launch(active);
      }, (error: unknown) => console.error(error));
      return;
    }
    const over = this.wrong_car(active.event);
    if (over) {
      return this.refuse(over);
    }
    // A streamed world holds only the chunks round the car: the run is built first, and the car goes down on its start
    // once the chunks there are in.
    let spot = null as { x: number; z: number; heading: number } | null;
    const hold = tiles.streamed ? (x: number, z: number, heading: number) => (spot = { x, z, heading }) : null;
    const run = active.mode.def.start(this.ctx(active.track, active.event, hold), active.level);
    if (typeof run === "string") {
      return this.refuse(run);
    }
    if (!run) return;
    if (!spot) return this.go(active, run);
    const { x, z, heading } = spot;
    active.starting = run;
    void this.cover(tiles.ensure(x, z)).then(() => {
      if (this.current !== active || active.starting !== run) return run.dispose();
      active.starting = null;
      this.park(x, z, heading);
      this.go(active, run);
    }, (error: unknown) => {
      run.dispose();
      console.error(error);
    });
  }

  private go(active: Active, run: ModeRun) {
    active.run = run;
    if (!this.lobby_lap) this.toast?.(active.mode.def.goal, active.event?.name ?? active.level.name, GOAL_MS);
    active.pi = active.event ? this.car_pi() : null;
    active.shown = false;
    this.el.result.hidden = true;
  }

  /** `hold`: takes the run's start in place of parking the car on it. */
  private ctx(track: Track, event: CareerEvent | null, hold: ((x: number, z: number, heading: number) => void) | null): ModeCtx {
    const { scene, world, start_index, camera } = this;
    const spawn = hold ?? ((x: number, z: number, heading: number) => this.park(x, z, heading));
    const { tiles } = world;
    const ground: Ground = tiles.streamed ? { height: (x, z) => (tiles.get(chunk_of(x, z, tiles.ext)) ? world.height(x, z) : world.nearest_road(x, z).y) } : world;
    const tuned = event?.tuned === world.key;
    return {
      scene,
      world,
      ground,
      start_index,
      route_at: this.route_at,
      camera,
      track,
      lobby_lap: () => this.lobby_lap,
      race_busy: () => this.race_busy(),
      hits: () => (event ? new Hits(() => world.contacts) : null),
      // Tuned on another world version, an event's times and ghost no longer fit its road: the mode's par grades it, no ghost.
      thresholds: (own) => (tuned && event?.stars) || own,
      dev_ghost: () => (tuned && event?.ghost ? dev_ghost(event) : Promise.resolve(null)),
      ghosts: () => this.ghosts(),
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
    if (this.too_big(active.mode)) return this.notice(TOO_BIG);
    if (this.left_out(active.level.id)) return this.notice(NOT_THIS_CAR);
    active.run?.dispose();
    active.run = null;
    const car = active.event?.car;
    const code = car && "preset" in car ? preset_code(car.preset) : null;
    if (code) this.wear(code);
    this.launch(active);
  }

  exit() {
    this.clear();
    this.give_back();
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
    if (active.event) {
      const next = next_event(this.career.stars, active.event);
      if (next) this.start_event?.(next.id);
      return;
    }
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
    // A notice holds the status line for its time against the run's own status.
    if (status !== null && performance.now() >= this.notice_until) this.show_status(status);
  }

  private show_hint(turn: number) {
    this.el.hint.hidden = false;
    this.el.hint.style.setProperty("--turn", `${(-turn * DEG).toFixed(1)}deg`);
  }

  // The status line hides behind the result card, so a refused Next or Retry says why on the card itself.
  private notice(text: string) {
    if (!this.el.result.hidden) {
      this.el.note.textContent = text;
      this.el.note.hidden = false;
      return;
    }
    this.show_status(text);
    this.notice_until = performance.now() + NOTICE_MS;
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
    el.note.hidden = true;
    if (active.event) this.show_event(active.event, stars);
    else {
      const index = levels.findIndex((level) => level.id === active.level.id);
      el.next.textContent = NEXT_LEVEL;
      el.next.hidden = index + 1 >= levels.length;
      el.next.disabled = !track.is_open(levels[index + 1]?.id ?? "") || this.left_out(levels[index + 1]?.id ?? "");
    }
    el.result.hidden = false;
    this.on_finish?.(active.mode.def.id);
    if (!finish.quiet) this.chime();
  }

  private show_event(event: CareerEvent, stars: number) {
    const { el, career } = this;
    career.record(event, stars);
    el.lines.append(line("career", tier_line(career.stars, tier_of(event))));
    el.next.textContent = NEXT_EVENT;
    el.next.hidden = next_event(career.stars, event) === null;
    el.next.disabled = false;
  }

  mode_list(): ModeEntry[] {
    const ground = KINDS[this.world.kind].open_ground;
    const fits = car_sized(this.spec());
    const streamed = this.world.tiles.streamed;
    return this.modes
      .filter(({ levels }) => levels.length)
      .map(({ def, levels, track }) => ({
        id: def.id,
        name: def.name,
        stars: track.stars,
        max: levels.length * MAX_STARS,
        blocked: streamed && !def.streams ? STREAMED : def.needs_ground && !ground ? OPEN_GROUND : def.car_sized_only && !fits ? TOO_BIG : null,
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
            blocked: this.left_out(level.id) ? NOT_THIS_CAR : null,
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

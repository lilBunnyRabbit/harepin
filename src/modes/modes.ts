import type * as THREE from "three";
import { TIERS, TUNE_PARAM, next_event, spot_of, tier_line, tier_of, tier_open, type CareerEvent } from "../career/career";
import { event_track, type Career } from "../career/career-store";
import { dev_ghost } from "../career/dev-ghost";
import { earned, garage_reward, unlocks, type Reward } from "../career/rewards";
import { unlock_card } from "../career/unlock-card";
import type { CarLimit } from "../car/car-pick";
import { car_sized, type CarSpec } from "../car/cars";
import { PRESETS } from "../car/presets";
import type { CarClass } from "../car/pi";
import { DEFAULT_BINDINGS, keys_text, type Bindings } from "../hud/bindings";
import { $, format } from "../hud/hud";
import type { World } from "../world/world";
import { chunk_of } from "../worldgen/chunk-grid";
import { KINDS } from "../worldgen/kinds/kinds";
import { LISTED, WORLDS } from "../worlds/worlds";
import { DRIFT_MODE } from "./drift-mode";
import { DUEL_MODE } from "./duel-mode";
import { EventCar, held_car, type CarHooks } from "./event-car";
import { GYMKHANA_MODE } from "./gymkhana-mode";
import { HUNT_MODE } from "./hunt-mode";
import { CUP_RECORD, Cup, stage_points, type Stage } from "./championship";
import { JUMP_MODE } from "./jump-mode";
import { Hits } from "./hits";
import type { Ground } from "./marks";
import type { Driven, Finish, Level, ModeCtx, ModeDef, ModeRun, RouteRun } from "./mode";
import { PARKING_MODE } from "./parking-mode";
import type { RunPlay } from "../runs/run-play";
import { RACE_MODE } from "./race-mode";
import { level_route, race_levels } from "./races";
import { line, run_text, star_row } from "./result";
import { MAX_STARS, Track, local_store, type RaceRecord } from "./track";
import "./modes.css";

export type { Driven } from "./mode";

/** A championship stage grades on its own marks, never the championship's points, and has no ghost of its own yet. */
function graded({ event, cup }: Active): CareerEvent | null {
  if (!event || !cup) return event;
  const { mode, level, stars } = cup.cup.stage;
  return { ...event, mode, level, stars, ghost: undefined };
}

export const MODES: readonly ModeDef[] = [RACE_MODE, GYMKHANA_MODE, PARKING_MODE, DRIFT_MODE, HUNT_MODE, DUEL_MODE, JUMP_MODE];

const NOTICE_MS = 2500;
const GOAL_MS = 4000;
const DEG = 180 / Math.PI;
const OPEN_WORLDS = LISTED.filter((w) => KINDS[w.kind].open_ground).map((w) => `the ${w.map_label}`).join(" or ");
const OPEN_GROUND = `Needs open ground: drive ${OPEN_WORLDS} for it`;
const NO_GROUND_NOTICE = `Gymkhana, parking and gate hunts need open ground: drive ${OPEN_WORLDS} for them`;
const TOO_BIG = "Too big for this mode";
const NOT_THIS_CAR = "Not raced in this car";
const LENT_CAR = `That car is a career reward: this run lends you the ${PRESETS[0].name}`;
const STREAMED = "This mode is not on this world yet";
const NO_EVENT = "This event is not on this map";
const NEXT_LEVEL = "Next level";
const NEXT_EVENT = "Next event";
const NEXT_STAGE = "Next stage";
const RETRY_STAGE = "Retry stage";
const STAGE_NEEDS_STAR = "A stage needs 1★ to go on";

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

interface Leg {
  mode: Mode;
  level: Level;
}

/** A championship's stages, each found on this world before the first starts. */
interface CupRun {
  cup: Cup;
  legs: readonly Leg[];
}

interface Active {
  mode: Mode;
  level: Level;
  /** The mode's own records, or the event's for a career run, which never writes free play's. */
  track: Track;
  event: CareerEvent | null;
  /** A Runs pick: its marks, records and season stars in place of the career's. */
  play: RunPlay | null;
  cup: CupRun | null;
  run: ModeRun | null;
  /** On a streamed world, the run built and waiting for the chunks at its start; a later launch or a clear replaces it. */
  starting: ModeRun | null;
  shown: boolean;
  /** An event run's PI at its start: a garage change that moves it ends the run, a new look does not. */
  pi: number | null;
}

export class Modes implements CarHooks {
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
    standings: $("mode-result-standings"),
    note: $("mode-result-note"),
    unlock: $("mode-result-unlock"),
    retry: $("mode-retry", HTMLButtonElement),
    next: $("mode-next", HTMLButtonElement),
    try_on: $("mode-try", HTMLButtonElement),
    car: $("mode-car", HTMLButtonElement),
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
  /** Opens the garage with a reward the run just earned tried on. */
  try_reward: ((reward: Reward) => void) | null = null;
  /** The garage reward the shown result just earned, for its Try it button. */
  private reward: Reward | null = null;
  pick_car: CarHooks["pick_car"] = null;
  fit_car: CarHooks["fit_car"] = null;
  car_code: CarHooks["car_code"] = null;
  save_car: CarHooks["save_car"] = null;
  private readonly car = new EventCar(this);

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
    return this.car.fitting;
  }

  /** True while an event runs on a car it lent the player: a new look on it is not the player's own car. */
  get borrowed(): boolean {
    return this.car.borrowed;
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
    return this.car.picking || this.current?.run?.holding === true;
  }

  /** Runs the lobby's race on `id` instead of the circuit; the lobby keeps the time, so there is no countdown or record here. */
  lobby_race(id: string, on_lap: () => boolean) {
    this.car.cancel_pick();
    this.car.give_back();
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
    this.el.try_on.addEventListener("click", () => this.reward && this.try_reward?.(this.reward), { signal });
    this.el.car.addEventListener("click", () => void this.change_car(), { signal });
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
      this.car.give_back();
      return this.begin(mode, level);
    }
  }

  /** The caller has checked this map is the event's. Career levels are all open: the mode's own unlock order is free play's. */
  play_event(asked: CareerEvent, play: RunPlay | null = null) {
    const event = held_car(asked, unlocks(this.career.stars).cars);
    // A stand-in runs one level on another map; a championship's stages name their levels on its own map only.
    if (event.stages && event.stand_in) return this.notice(NO_EVENT);
    const legs = this.legs(event.stages ?? [{ mode: event.mode, level: spot_of(event).level, name: event.name }]);
    if (!legs) return this.notice(NO_EVENT);
    if (this.world.tiles.streamed && legs.some((leg) => !leg.mode.def.streams)) return this.notice(STREAMED);
    const [{ mode, level }] = legs;
    const tier = tier_of(event);
    const before = TIERS[TIERS.indexOf(tier) - 1];
    // `?tune` opens every tier so the owner can set the non-race stars before any are earnable.
    const tune = new URLSearchParams(location.search).has(TUNE_PARAM);
    if (!play && !tune && !tier_open(this.career.stars, tier)) return this.notice(`${tier.name} opens at ${tier.opens_at} ★ in ${before?.name ?? "the tier before"}`);
    if (legs.some((leg) => leg.mode.def.needs_ground) && !KINDS[this.world.kind].open_ground) return this.notice(NO_GROUND_NOTICE);
    if (this.race_busy()) return this.notice(mode.def.busy_notice);
    if (this.car.picking) return;
    this.clear();
    void this.car.ready(event, (cap) => this.limit(cap, legs)).then((ready) => {
      if (!ready) return this.car.give_back();
      if (legs.some((leg) => this.too_big(leg.mode))) return this.refuse(TOO_BIG);
      if (legs.some((leg) => this.left_out(leg.level.id))) return this.refuse(NOT_THIS_CAR);
      if (this.race_busy()) return this.refuse(mode.def.busy_notice);
      this.clear();
      const cup = event.stages ? { cup: new Cup(event.stages, event.stars), legs } : null;
      this.begin(mode, level, play?.track ?? event_track(event, local_store()), event, play, cup);
      if (event !== asked) this.notice(LENT_CAR);
    });
  }

  private legs(stages: readonly Stage[]): Leg[] | null {
    const legs: Leg[] = [];
    for (const stage of stages) {
      const mode = this.modes.find((m) => m.def.id === stage.mode);
      const level = mode?.levels.find((l) => l.id === stage.level);
      if (!mode || !level) return null;
      legs.push({ mode, level: { ...level, name: stage.name ?? level.name } });
    }
    return legs;
  }

  /** A class-capped event under way, mid-run or on its result: its car can change, which starts the run over. */
  get can_change_car(): boolean {
    const car = this.current?.event?.car;
    return car !== undefined && "cap" in car && this.car.can_pick;
  }

  /** Asks again which car runs the event; a pick restarts the run on it, a cancel leaves the run and the car as they were. */
  async change_car() {
    const active = this.current;
    const car = active?.event?.car;
    if (!active?.event || !car || !("cap" in car) || this.car.picking) return;
    const code = await this.car.ask(active.event.name, this.limit(car.cap, active.cup?.legs ?? [active]));
    if (code === null || this.current !== active) return;
    // The player's own car back on is no longer a loan: their garage edits stay theirs, and its build goals count again.
    this.car.swap(code);
    this.restart();
  }

  private limit(cap: CarClass, legs: readonly Leg[]): CarLimit {
    const excludes = legs.flatMap((leg) => this.excludes(leg.level.id));
    const car_sized_only = legs.some((leg) => leg.mode.def.car_sized_only);
    return { cap, car_sized_only, excludes: excludes.length ? excludes : undefined };
  }

  // A refused start leaves the event, so the player's car goes back on; a championship says where it ended.
  private refuse(text: string, active: Active | null = null) {
    const cup = active?.cup?.cup;
    const ended = cup && cup.index > 0 ? ` · championship over at stage ${cup.index + 1}/${cup.stages.length}, ${cup.total} pts` : "";
    this.clear();
    this.car.give_back();
    this.notice(`${text}${ended}`);
  }

  /**
   * A garage change the player made. A new look keeps an event run going on the event's car, and the player's own car
   * still comes back after it. Anything else makes the change their car; an event run it moves off its PI or its fit ends.
   */
  car_changed() {
    if (this.car.fitting) return;
    const active = this.current?.run ? this.current : null;
    const event = active?.event ?? null;
    if (!active || !event) {
      this.car.release();
      return;
    }
    const why = this.car.wrong(event) ?? (this.car.pi() === active.pi ? null : `${event.name}: car changed mid-run`);
    if (!why) {
      this.car.save_kept();
      return;
    }
    this.car.release();
    this.exit();
    this.notice(why);
  }

  private too_big(mode: Mode): boolean {
    return mode.def.car_sized_only && !car_sized(this.spec());
  }

  /** The level is a route the car being driven is not raced in. */
  private left_out(id: string): boolean {
    return this.excludes(id).includes(this.spec().id);
  }

  private excludes(id: string): readonly string[] {
    const route = level_route(this.world.routes, id);
    return this.world.routes.find((r) => r.id === route)?.excludes ?? [];
  }

  private begin(mode: Mode, level: Level, track = mode.track, event: CareerEvent | null = null, play: RunPlay | null = null, cup: CupRun | null = null) {
    this.current = { mode, level, track, event, play, cup, run: null, starting: null, shown: false, pi: null };
    this.launch(this.current);
  }

  private launch(active: Active) {
    const { tiles } = this.world;
    if (tiles.streamed && !active.mode.def.streams) {
      return this.refuse(STREAMED, active);
    }
    // Mode sites and views read terrain anywhere on a compact map: a start before every chunk is in waits for the rest.
    if (!tiles.streamed && !tiles.complete) {
      void this.cover(tiles.whole()).then(() => {
        if (this.current === active && !active.run) this.launch(active);
      }, (error: unknown) => console.error(error));
      return;
    }
    const over = this.car.wrong(active.event);
    if (over) {
      return this.refuse(over, active);
    }
    // A streamed world holds only the chunks round the car: the run is built first, and the car goes down on its start
    // once the chunks there are in.
    let spot = null as { x: number; z: number; heading: number } | null;
    const hold = tiles.streamed ? (x: number, z: number, heading: number) => (spot = { x, z, heading }) : null;
    const run = active.mode.def.start(this.ctx(active.track, graded(active), hold, active.play), active.level);
    if (typeof run === "string") {
      return this.refuse(run, active);
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
    if (!this.lobby_lap) this.toast?.(active.level.goal ?? active.mode.def.goal, active.level.name, GOAL_MS);
    active.pi = active.event ? this.car.pi() : null;
    active.shown = false;
    this.el.result.hidden = true;
    if (active.cup) this.el.status.dataset.cup = active.cup.cup.status;
  }

  /** `hold`: takes the run's start in place of parking the car on it. */
  private ctx(track: Track, event: CareerEvent | null, hold: ((x: number, z: number, heading: number) => void) | null, play: RunPlay | null): ModeCtx {
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
      laps: play?.laps ?? 1,
      hits: () => (event ? new Hits(() => world.contacts) : null),
      // Tuned on another world version, an event's times and ghost no longer fit its road: the mode's par grades it, no ghost.
      thresholds: (own) => (play ? play.grade(own) : (tuned && event?.stars) || own),
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
    this.car.wear_preset(active.event);
    this.launch(active);
  }

  exit() {
    this.clear();
    this.car.give_back();
    this.el.status.hidden = true;
  }

  private clear() {
    this.current?.run?.dispose();
    this.current = null;
    this.lobby_lap = null;
    this.el.hint.hidden = true;
    this.el.result.hidden = true;
    delete this.el.status.dataset.cup;
    this.status_key = "";
  }

  private play_next() {
    const active = this.current;
    if (!active) return;
    if (active.cup && !active.cup.cup.cleared) return this.restart();
    if (active.cup && !active.cup.cup.done) return this.next_stage(active, active.cup);
    if (active.play) return active.play.next?.go();
    if (active.event) {
      const next = next_event(this.career.stars, active.event);
      if (next) this.start_event?.(next.id);
      return;
    }
    const ids = active.mode.levels.map((level) => level.id);
    const next = ids[ids.indexOf(active.level.id) + 1];
    if (next) this.play(next);
  }

  private next_stage(active: Active, cup: CupRun) {
    const leg = cup.legs[cup.cup.index + 1];
    if (!leg) return;
    if (this.race_busy()) return this.notice(leg.mode.def.busy_notice);
    if (this.too_big(leg.mode)) return this.notice(TOO_BIG);
    if (this.left_out(leg.level.id)) return this.notice(NOT_THIS_CAR);
    if (!cup.cup.advance()) return;
    this.clear();
    this.begin(leg.mode, leg.level, active.track, active.event, active.play, cup);
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
    const { levels, track } = active.mode;
    const cup = active.cup?.cup ?? null;
    cup?.score(finish.stars);
    // No time of its own: a championship ranks by its points, which the career page shows.
    if (cup?.done && cup.stars) active.track.record(CUP_RECORD, { stars: cup.stars, ms: 1, score: cup.total });
    const stars = cup?.done ? cup.stars : finish.stars;
    el.title.textContent = cup?.done && active.event ? `${active.event.name} · ${cup.total} pts` : finish.title;
    el.result_stars.replaceChildren(star_row(stars));
    el.result_stars.setAttribute("aria-label", `${stars} of ${MAX_STARS} stars`);
    el.lines.replaceChildren(...finish.lines);
    el.note.hidden = true;
    el.unlock.replaceChildren();
    this.reward = null;
    el.try_on.hidden = true;
    el.car.hidden = !this.can_change_car;
    el.standings.hidden = !active.cup;
    if (active.cup) this.show_standings(active.cup);
    if (cup && !cup.done) {
      el.next.textContent = cup.cleared ? NEXT_STAGE : RETRY_STAGE;
      el.next.hidden = false;
      el.next.disabled = false;
      if (!cup.cleared) {
        el.note.textContent = STAGE_NEEDS_STAR;
        el.note.hidden = false;
      }
    } else if (active.play) this.show_play(active.play, stars, cup?.total);
    else if (active.event) this.show_event(active.event, stars);
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
    const before = career.stars;
    career.record(event, stars);
    const won = earned(before, career.stars, tier_of(event));
    if (won.length) el.unlock.append(unlock_card(won));
    this.reward = garage_reward(won);
    el.try_on.hidden = this.reward === null;
    el.lines.append(line("career", tier_line(career.stars, tier_of(event))));
    el.next.textContent = NEXT_EVENT;
    el.next.hidden = next_event(career.stars, event) === null;
    el.next.disabled = false;
  }

  private show_play(play: RunPlay, stars: number, total?: number) {
    const { el } = this;
    el.lines.append(...play.finish(stars, total));
    el.next.textContent = play.next?.label ?? NEXT_EVENT;
    el.next.hidden = play.next === null;
    el.next.disabled = false;
  }

  private show_standings({ cup, legs }: CupRun) {
    const rows = legs.map((leg, i) => {
      const stars = cup.results[i];
      const row = document.createElement("li");
      row.dataset.now = String(i === cup.index);
      const place = document.createElement("span");
      place.className = "dim";
      place.textContent = String(i + 1);
      const name = document.createElement("span");
      name.textContent = leg.level.name;
      const score = document.createElement("b");
      score.textContent = stars === null ? "--" : `${stage_points(stars)} pts`;
      row.append(place, name, score, stars === null ? document.createElement("span") : star_row(stars));
      return row;
    });
    const total = document.createElement("li");
    total.className = "cup-total";
    const label = document.createElement("span");
    label.textContent = "Total";
    const sum = document.createElement("b");
    sum.textContent = `${cup.total} pts`;
    total.append(label, sum);
    this.el.standings.replaceChildren(...rows, total);
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
            best: run ? run_text(run, def.score_text) : null,
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

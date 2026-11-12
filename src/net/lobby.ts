import { add_race, placing, local_store, parse_race_record, read_json, write_json, type RaceRecord, type Store } from "../modes/track";
import type { Net, RaceEvent, Sender } from "./net";
import type { Route } from "../worldgen/types";
import { READY_RESEND_MS, READY_TTL_MS, ReadySet, type RaceCall, type ReadyStatus } from "./ready";

export const COUNTDOWN_MS = 3000;
const MAX_SPEED = 90;
const LATE_START_MS = 1000;
const EARLY_START_MS = 10_000;
const FINISH_SLACK_MS = 2000;
const RESULTS_MS = 30_000;
// A leader that is busy or gone never answers a request; past this the caller hears so instead of waiting on nothing.
const REQUEST_MS = 4000;
// A timer, not the render loop: rAF stops in a background tab, and a ready player there would lapse.
const READY_TICK_MS = 250;
export const NOT_THIS_CAR = "Not raced in this car";
export const SITTING_OUT = "Not raced in this car: you sit this race out";
export const RACE_RUNNING = "Lobby race is running";

export interface Finisher {
  id: string;
  name: string;
  time: number;
  you: boolean;
}

interface Running {
  race: number;
  route: string;
  laps: number;
  /** Local `performance.now()` ms when the countdown ends. */
  go: number;
  /** Peers in the room when the race began; wins and podiums count against them (see `placing`). */
  rivals: number;
}

export type LobbyState =
  | { kind: "idle" }
  | ({ kind: "countdown" } & Running)
  | ({ kind: "racing"; lap: number } & Running)
  | ({ kind: "done"; time: number; until: number; place: number; improved: boolean } & Running);

export interface LobbyRoute {
  closed: boolean;
  /** Fastest physically possible lap, ms: a finish claimed under laps × this is dropped. */
  min_lap: number;
  /** Car ids the route leaves out. */
  excludes: readonly string[];
}

export function lobby_routes(routes: readonly Pick<Route, "id" | "closed" | "length" | "excludes">[]): Map<string, LobbyRoute> {
  return new Map(routes.map((r) => [r.id, { closed: r.closed, min_lap: (r.length / MAX_SPEED) * 1000, excludes: r.excludes ?? [] }]));
}

/** Laps only mean something on a closed route; point to point is always one run. */
export function race_laps(route: LobbyRoute, laps: number): number {
  return route.closed ? laps : 1;
}

// No referee: each client claims its own finish time, and a claim survives only if it is physically possible.
// Route excludes are checked against this player's own car only: peers' cars are hostile data, missing from old builds
// and can change mid-countdown, so a left-out player sits the race out instead of the leader refusing to start it.
export class Lobby {
  state: LobbyState = { kind: "idle" };
  finishers: Finisher[] = [];
  on_start: (() => void) | null = null;
  on_unanswered: (() => void) | null = null;
  /** Something this player tried or was pulled into that didn't happen, as a line to show. */
  on_notice: ((notice: string) => void) | null = null;
  /** Id of the car this player drives. */
  car: (() => string) | null = null;
  record: RaceRecord;
  private readonly record_key: string;
  private asked_until = 0;
  private unsubscribe: (() => void) | null = null;
  private unsubscribe_ready: (() => void) | null = null;
  private readonly readies = new ReadySet();
  /** The race this player readied for; null while not ready. */
  private own_ready: RaceCall | null = null;
  private ready_due = Infinity;
  /** Until when a cancel keeps being resent: a lost one would leave this player counted ready till the TTL. */
  private cancel_until = 0;
  private ready_timer: ReturnType<typeof setInterval> | undefined;
  /** A race this player sat out can't end before this; a leader starts nothing new till then, or it splits the room. */
  private out_until = 0;

  constructor(
    private net: Net,
    private readonly routes: ReadonlyMap<string, LobbyRoute>,
    /** `world_key` of the map the race runs on. */
    world: string,
    private readonly store: Store | null = local_store(),
  ) {
    this.record_key = `harepin:lobby:${world}`;
    this.record = parse_race_record(read_json(store, this.record_key));
  }

  start() {
    this.unsubscribe = this.net.on_event((event, from) => this.receive(event, from));
    this.unsubscribe_ready = this.net.on_ready((msg, from) => this.readies.hear(from.id, from.name, msg, performance.now()));
    this.ready_timer = setInterval(() => this.tick(performance.now()), READY_TICK_MS);
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribe_ready?.();
    this.unsubscribe_ready = null;
    clearInterval(this.ready_timer);
  }

  get ready(): boolean {
    return this.own_ready !== null;
  }

  /** Readies for the next race with this call, or takes it back with null; ignored while a race runs. */
  set_ready(call: RaceCall | null, now = performance.now()) {
    if (this.busy) return;
    if (call && this.left_out(call.route)) {
      this.on_notice?.(NOT_THIS_CAR);
      call = null;
    }
    if (!call && this.own_ready) this.cancel_until = now + READY_TTL_MS;
    this.own_ready = call;
    this.ready_due = 0;
  }

  ready_status(now: number): ReadyStatus {
    const { net } = this;
    const status = this.readies.status(this.own_ready, net.same_map.keys(), (id) => net.name_of(id), net.leader_id, net.id, now, net.electing);
    return { ...status, left_out: status.next !== null && this.left_out(status.next.route) };
  }

  /** The route leaves out the car this player drives. */
  left_out(route: string): boolean {
    const car = this.car?.();
    return car !== undefined && this.routes.get(route)?.excludes.includes(car) === true;
  }

  /** Route of the race in progress or just run; the circuit when idle. */
  get route(): string {
    return this.state.kind === "idle" ? "circuit" : this.state.route;
  }

  get busy() {
    return this.state.kind === "countdown" || this.state.kind === "racing";
  }

  private get leading(): boolean {
    return this.net.leader_id === this.net.id && !this.net.settling;
  }

  call(laps: number, route = "circuit") {
    if (this.busy || !this.routes.has(route)) return;
    if (this.left_out(route)) return this.on_notice?.(NOT_THIS_CAR);
    if (this.leading && this.sitting_out) return this.on_notice?.(RACE_RUNNING);
    if (this.leading) this.begin(laps, route);
    else {
      this.net.send_event({ kind: "request", laps, route });
      this.asked_until = performance.now() + REQUEST_MS;
    }
  }

  private get sitting_out(): boolean {
    return performance.now() < this.out_until;
  }

  /** Leaves a race the car just swapped in is left out of; true when it did. */
  car_changed(): boolean {
    if (!this.busy || !this.left_out(this.route)) return false;
    this.leave();
    this.on_notice?.(SITTING_OUT);
    return true;
  }

  leave() {
    this.state = { kind: "idle" };
    this.finishers = [];
  }

  lap(now: number) {
    const { state } = this;
    if (state.kind !== "racing") return;
    const lap = state.lap + 1;
    if (lap < state.laps) {
      this.state = { ...state, lap };
      return;
    }
    const time = now - state.go;
    this.add({ id: this.net.id, name: this.net.name, time, you: true });
    const place = this.finishers.findIndex((f) => f.you) + 1;
    const result = add_race(this.record, state.route === "circuit" ? state.laps : null, time, placing(place, state.rivals + 1));
    this.record = result.record;
    write_json(this.store, this.record_key, this.record);
    this.state = { kind: "done", race: state.race, route: state.route, laps: state.laps, go: state.go, rivals: state.rivals, time, until: now + RESULTS_MS, place, improved: result.improved };
    this.net.send_event({ kind: "finish", race: state.race, time });
  }

  update(now: number) {
    const { state } = this;
    if (state.kind === "countdown" && now >= state.go) this.state = { ...state, kind: "racing", lap: 0 };
    else if (state.kind === "done" && now >= state.until) this.leave();
    if (this.asked_until && now >= this.asked_until) {
      this.asked_until = 0;
      this.on_unanswered?.();
    }
  }

  /** Sends this player's ready on its beat; on the leader, starts the race once everyone is ready. */
  tick(now: number) {
    if (this.busy) return;
    const own = this.own_ready;
    if (now >= this.ready_due) {
      this.net.send_ready(own ? { ready: true, ...own } : { ready: false });
      this.ready_due = own || now < this.cancel_until ? now + READY_RESEND_MS : Infinity;
    }
    if (own && this.leading && this.readies.everyone(own, this.net.same_map.keys(), now)) this.begin(own.laps, own.route);
  }

  private begin(laps: number, route: string) {
    const known = this.routes.get(route);
    if (!known || this.sitting_out) return;
    const race = Math.floor(Math.random() * 0x7fffffff);
    const go = performance.now() + COUNTDOWN_MS;
    const run = race_laps(known, laps);
    this.net.send_event({ kind: "start", race, laps: run, start_at: go, route });
    this.enter(race, route, run, go);
  }

  private enter(race: number, route: string, laps: number, go: number) {
    this.asked_until = 0;
    this.own_ready = null;
    this.ready_due = Infinity;
    this.cancel_until = 0;
    this.readies.clear();
    if (this.left_out(route)) {
      this.out_until = go + laps * (this.routes.get(route)?.min_lap ?? 0);
      return this.on_notice?.(SITTING_OUT);
    }
    this.state = { kind: "countdown", race, route, laps, go, rivals: this.net.remotes.size };
    this.finishers = [];
    this.on_start?.();
  }

  private receive(event: RaceEvent, from: Sender) {
    const now = performance.now();
    const { state } = this;
    switch (event.kind) {
      case "request":
        if (!this.busy && this.leading) this.begin(event.laps, event.route);
        break;
      case "start": {
        const known = this.routes.get(event.route);
        if (this.busy || from.id !== this.net.leader_id || !known) return;
        const go = event.start_at + from.offset;
        if (go < now - LATE_START_MS || go > now + EARLY_START_MS) return;
        this.enter(event.race, event.route, race_laps(known, event.laps), go);
        break;
      }
      case "finish": {
        if (state.kind === "idle" || event.race !== state.race) return;
        const min_lap = this.routes.get(state.route)?.min_lap ?? Infinity;
        if (event.time < state.laps * min_lap || event.time > now - state.go + FINISH_SLACK_MS) return;
        this.add({ id: from.id, name: from.name, time: event.time, you: false });
        if (state.kind === "done") state.until = Math.max(state.until, now + RESULTS_MS);
        break;
      }
    }
  }

  private add(finisher: Finisher) {
    if (this.finishers.some((f) => f.id === finisher.id)) return;
    this.finishers.push(finisher);
    this.finishers.sort((a, b) => a.time - b.time);
  }
}

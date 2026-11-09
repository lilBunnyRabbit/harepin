import { add_race, placing, local_store, parse_race_record, read_json, write_json, type RaceRecord, type Store } from "./modes/track";
import type { Net, RaceEvent, Remote } from "./net";
import type { Route } from "./worldgen/types";

export const COUNTDOWN_MS = 3000;
const MAX_SPEED = 90;
const LATE_START_MS = 1000;
const EARLY_START_MS = 10_000;
const FINISH_SLACK_MS = 2000;
const RESULTS_MS = 30_000;

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
}

export function lobby_routes(routes: readonly Pick<Route, "id" | "closed" | "length">[]): Map<string, LobbyRoute> {
  return new Map(routes.map((r) => [r.id, { closed: r.closed, min_lap: (r.length / MAX_SPEED) * 1000 }]));
}

/** Laps only mean something on a closed route; point to point is always one run. */
export function race_laps(route: LobbyRoute, laps: number): number {
  return route.closed ? laps : 1;
}

// No referee: each client claims its own finish time, and a claim survives only if it is physically possible.
export class Lobby {
  state: LobbyState = { kind: "idle" };
  finishers: Finisher[] = [];
  on_start: (() => void) | null = null;
  record: RaceRecord;
  private readonly record_key: string;

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
    this.net.on_event = (event, from) => this.receive(event, from);
  }

  stop() {
    this.net.on_event = null;
  }

  /** Route of the race in progress or just run; the circuit when idle. */
  get route(): string {
    return this.state.kind === "idle" ? "circuit" : this.state.route;
  }

  get busy() {
    return this.state.kind === "countdown" || this.state.kind === "racing";
  }

  private get leader(): string {
    return [this.net.id, ...this.net.remotes.keys()].sort()[0];
  }

  call(laps: number, route = "circuit") {
    if (this.busy || !this.routes.has(route)) return;
    if (this.leader === this.net.id) this.begin(laps, route);
    else this.net.send_event({ kind: "request", laps, route });
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
  }

  private begin(laps: number, route: string) {
    const known = this.routes.get(route);
    if (!known) return;
    const race = Math.floor(Math.random() * 0x7fffffff);
    const go = performance.now() + COUNTDOWN_MS;
    const run = race_laps(known, laps);
    this.net.send_event({ kind: "start", race, laps: run, start_at: go, route });
    this.enter(race, route, run, go);
  }

  private enter(race: number, route: string, laps: number, go: number) {
    this.state = { kind: "countdown", race, route, laps, go, rivals: this.net.remotes.size };
    this.finishers = [];
    this.on_start?.();
  }

  private receive(event: RaceEvent, from: Remote) {
    const now = performance.now();
    const { state } = this;
    switch (event.kind) {
      case "request":
        if (!this.busy && this.leader === this.net.id) this.begin(event.laps, event.route);
        break;
      case "start": {
        const known = this.routes.get(event.route);
        if (this.busy || from.id !== this.leader || !known) return;
        const go = event.start_at + from.offset;
        if (go < now - LATE_START_MS || go > now + EARLY_START_MS) return;
        this.enter(event.race, event.route, race_laps(known, event.laps), go);
        break;
      }
      case "finish": {
        if (state.kind === "idle" || event.race !== state.race) return;
        const min_lap = this.routes.get(state.route)?.min_lap ?? Infinity;
        if (event.time < state.laps * min_lap || event.time > now - state.go + FINISH_SLACK_MS) return;
        this.add({ id: from.id, name: this.net.display_name(from), time: event.time, you: false });
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

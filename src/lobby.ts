import { add_race, placing, local_store, parse_race_record, read_json, write_json, type RaceRecord, type Store } from "./modes/track";
import type { Net, RaceEvent, Remote } from "./net";

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

export function min_lap_ms(gates: { x: number; z: number }[]): number {
  let length = 0;
  gates.forEach((g, i) => {
    const next = gates[(i + 1) % gates.length];
    length += Math.hypot(next.x - g.x, next.z - g.z);
  });
  return (length / MAX_SPEED) * 1000;
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
    private min_lap: number,
    seed: number,
    private readonly store: Store | null = local_store(),
  ) {
    this.record_key = `harepin:lobby:${seed}`;
    this.record = parse_race_record(read_json(store, this.record_key));
  }

  start() {
    this.net.on_event = (event, from) => this.receive(event, from);
  }

  stop() {
    this.net.on_event = null;
  }

  get busy() {
    return this.state.kind === "countdown" || this.state.kind === "racing";
  }

  private get leader(): string {
    return [this.net.id, ...this.net.remotes.keys()].sort()[0];
  }

  call(laps: number) {
    if (this.busy) return;
    if (this.leader === this.net.id) this.begin(laps);
    else this.net.send_event({ kind: "request", laps });
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
    const result = add_race(this.record, state.laps, time, placing(place, state.rivals + 1));
    this.record = result.record;
    write_json(this.store, this.record_key, this.record);
    this.state = { kind: "done", race: state.race, laps: state.laps, go: state.go, rivals: state.rivals, time, until: now + RESULTS_MS, place, improved: result.improved };
    this.net.send_event({ kind: "finish", race: state.race, time });
  }

  update(now: number) {
    const { state } = this;
    if (state.kind === "countdown" && now >= state.go) this.state = { ...state, kind: "racing", lap: 0 };
    else if (state.kind === "done" && now >= state.until) this.leave();
  }

  private begin(laps: number) {
    const race = Math.floor(Math.random() * 0x7fffffff);
    const go = performance.now() + COUNTDOWN_MS;
    this.net.send_event({ kind: "start", race, laps, start_at: go });
    this.enter(race, laps, go);
  }

  private enter(race: number, laps: number, go: number) {
    this.state = { kind: "countdown", race, laps, go, rivals: this.net.remotes.size };
    this.finishers = [];
    this.on_start?.();
  }

  private receive(event: RaceEvent, from: Remote) {
    const now = performance.now();
    const { state } = this;
    switch (event.kind) {
      case "request":
        if (!this.busy && this.leader === this.net.id) this.begin(event.laps);
        break;
      case "start": {
        if (this.busy || from.id !== this.leader) return;
        const go = event.start_at + from.offset;
        if (go < now - LATE_START_MS || go > now + EARLY_START_MS) return;
        this.enter(event.race, event.laps, go);
        break;
      }
      case "finish": {
        if (state.kind === "idle" || event.race !== state.race) return;
        if (event.time < state.laps * this.min_lap || event.time > now - state.go + FINISH_SLACK_MS) return;
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

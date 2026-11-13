import { mulberry32, sub } from "../rng";
import { RouteTracker, slice, type RoutePoint } from "./route";
import { stars_for } from "./track";

export const DUEL_LEAD = 15;
const PAR_SPEED = 21;
const ON_POINT = 1;
/** Route points kept between a gate and the start or finish line, so two bands never sit on top of each other. */
const GATE_CLEAR = 20;

export interface DuelLevel {
  id: string;
  name: string;
  brings: string;
  points: number;
}

export const DUEL_LEVELS: readonly DuelLevel[] = [
  { id: "v1", name: "Sprint", brings: "Six hundred metres of the circuit. Set a time, then beat your ghost.", points: 300 },
  { id: "v2", name: "Stretch", brings: "Nearly a kilometre against your best.", points: 450 },
  { id: "v3", name: "Run", brings: "Longer, with more corners to lose time in.", points: 650 },
  { id: "v4", name: "Long run", brings: "Two kilometres: stay ahead of the ghost.", points: 1000 },
  { id: "v5", name: "Marathon", brings: "Most of the circuit in one go.", points: 1500 },
];

export interface Route {
  level: DuelLevel;
  points: RoutePoint[];
  /** Distance from the start line to each point, metres; negative in the run-up. */
  at: number[];
  length: number;
  par_ms: number;
}

/** `clear` moves a start point off anything a car must not be put down on, such as a kicker on the circuit. */
export function build_route(seed: number, road: readonly RoutePoint[], level: DuelLevel, clear = (index: number) => index): Route {
  const rng = mulberry32(sub(seed, `duel:${level.id}`));
  const start = Math.floor(rng() * road.length);
  const points = slice(road, clear(start - DUEL_LEAD), level.points + DUEL_LEAD);
  const at = [0];
  for (let i = 1; i < points.length; i++) at.push(at[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  const zero = at[DUEL_LEAD];
  for (let i = 0; i < at.length; i++) at[i] -= zero;
  const length = at[at.length - 1];
  return { level, points, at, length, par_ms: Math.round((length / PAR_SPEED) * 2) * 500 };
}

/** Route indices of the circuit's own checkpoints the route passes, in driving order, then its finish. */
export function duel_gates(route: Route, checkpoints: readonly { x: number; z: number }[]): number[] {
  const { points } = route;
  const last = points.length - 1;
  const gates: number[] = [];
  for (const cp of checkpoints) {
    for (let i = DUEL_LEAD + GATE_CLEAR; i < last - GATE_CLEAR; i++) {
      if (Math.hypot(points[i].x - cp.x, points[i].z - cp.z) > ON_POINT) continue;
      gates.push(i);
      break;
    }
  }
  return [...gates.sort((a, b) => a - b), last];
}

export const DuelStatus = { READY: "ready", RUNNING: "running", DONE: "done" } as const;
export type DuelStatus = (typeof DuelStatus)[keyof typeof DuelStatus];

export class DuelRun {
  status: DuelStatus = DuelStatus.READY;
  clock = 0;
  started = 0;
  ended = 0;
  next = 0;
  readonly tracker: RouteTracker;
  readonly ghost: RouteTracker;

  constructor(
    readonly route: Route,
    readonly gates: readonly number[] = [route.points.length - 1],
  ) {
    this.tracker = new RouteTracker(route.points);
    this.ghost = new RouteTracker(route.points);
  }

  elapsed(): number {
    if (this.status === DuelStatus.READY) return 0;
    return (this.status === DuelStatus.DONE ? this.ended : this.clock) - this.started;
  }

  stars(): number {
    return stars_for(this.elapsed(), this.route.par_ms);
  }

  get metres(): number {
    return this.route.at[Math.max(0, this.tracker.index)];
  }

  get gate(): RoutePoint | null {
    return this.route.points[this.gates[this.next]] ?? null;
  }

  /** Metres ahead of the ghost at `ghost`, negative when behind; null without one. */
  gap(ghost: { x: number; z: number } | null): number | null {
    if (!ghost) return null;
    return this.metres - this.route.at[this.ghost.update(ghost.x, ghost.z)];
  }

  /** The last gate taken this step, or -1. */
  update(dt_ms: number, x: number, z: number): number {
    if (this.status === DuelStatus.DONE) return -1;
    this.clock += dt_ms;
    const index = this.tracker.update(x, z);
    if (this.status === DuelStatus.READY) {
      if (index < DUEL_LEAD) return -1;
      this.status = DuelStatus.RUNNING;
      this.started = this.clock;
    }
    let taken = -1;
    while (this.next < this.gates.length && index >= this.gates[this.next]) taken = this.next++;
    if (index >= this.route.points.length - 1) {
      this.next = this.gates.length;
      this.status = DuelStatus.DONE;
      this.ended = this.clock;
    }
    return taken;
  }
}

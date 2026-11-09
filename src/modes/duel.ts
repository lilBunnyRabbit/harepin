import { mulberry32, sub } from "../rng";
import { RouteTracker, slice, type RoutePoint } from "./route";
import { stars_for } from "./track";

export const DUEL_LEAD = 15;
const PAR_SPEED = 21;

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
export const DUEL_IDS = DUEL_LEVELS.map((level) => level.id);

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

export const DuelStatus = { READY: "ready", RUNNING: "running", DONE: "done" } as const;
export type DuelStatus = (typeof DuelStatus)[keyof typeof DuelStatus];

export class DuelRun {
  status: DuelStatus = DuelStatus.READY;
  clock = 0;
  started = 0;
  ended = 0;
  readonly tracker: RouteTracker;
  readonly ghost: RouteTracker;

  constructor(readonly route: Route) {
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

  /** Metres ahead of the ghost at `ghost`, negative when behind; null without one. */
  gap(ghost: { x: number; z: number } | null): number | null {
    if (!ghost) return null;
    return this.metres - this.route.at[this.ghost.update(ghost.x, ghost.z)];
  }

  update(dt_ms: number, x: number, z: number) {
    if (this.status === DuelStatus.DONE) return;
    this.clock += dt_ms;
    const index = this.tracker.update(x, z);
    if (this.status === DuelStatus.READY) {
      if (index < DUEL_LEAD) return;
      this.status = DuelStatus.RUNNING;
      this.started = this.clock;
    }
    if (index >= this.route.points.length - 1) {
      this.status = DuelStatus.DONE;
      this.ended = this.clock;
    }
  }
}

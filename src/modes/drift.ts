import { mulberry32, sub } from "../rng";
import type { Solid } from "../world/world";
import type { Body } from "./gymkhana";
import { touching } from "./parking";
import { RouteTracker, bendiest, length_of, slice, type RoutePoint } from "./route";
import { MAX_STARS } from "./track";

const DEG = Math.PI / 180;
export const MIN_SPEED = 7;
export const MIN_ANGLE = 10 * DEG;
export const MAX_ANGLE = 60 * DEG;
export const SPIN_ANGLE = 100 * DEG;
export const GRACE_MS = 700;
export const MULT_MS = 2000;
export const MAX_MULT = 5;
const RATE = 0.1;
export const LEAD = 25;
const PICK_FROM = 5;
const ROAD_SLACK = 3;
const SOLID_REACH = 12;
const MIN_ZONE_SPEED = 6;

export interface DriftLevel {
  id: string;
  name: string;
  brings: string;
  points: number;
  silver_per_m: number;
  gold_per_m: number;
}

export const DRIFT_LEVELS: readonly DriftLevel[] = [
  { id: "d1", name: "First slide", brings: "A short run of bends: hold any slide.", points: 110, silver_per_m: 1.5, gold_per_m: 3 },
  { id: "d2", name: "S bends", brings: "Link left into right without straightening.", points: 150, silver_per_m: 2, gold_per_m: 4 },
  { id: "d3", name: "Long chain", brings: "A longer zone: keep the combo alive.", points: 200, silver_per_m: 2.5, gold_per_m: 5 },
  { id: "d4", name: "Big angle", brings: "Higher targets: more angle, more speed.", points: 240, silver_per_m: 3, gold_per_m: 6 },
  { id: "d5", name: "Touge", brings: "The bendiest stretch of the island, end to end.", points: 300, silver_per_m: 3.5, gold_per_m: 7 },
];
export const DRIFT_IDS = DRIFT_LEVELS.map((level) => level.id);

export interface Zone {
  level: DriftLevel;
  points: RoutePoint[];
  length: number;
  silver: number;
  gold: number;
  max_ms: number;
}

const round = (n: number) => Math.max(50, Math.round(n / 50) * 50);

export function build_zone(seed: number, road: readonly RoutePoint[], level: DriftLevel): Zone {
  const starts = bendiest(road, level.points, PICK_FROM);
  const rng = mulberry32(sub(seed, `drift:${level.id}`));
  const start = starts[Math.floor(rng() * starts.length)] ?? 0;
  const points = slice(road, start - LEAD, level.points + LEAD);
  const length = length_of(points.slice(LEAD));
  return { level, points, length, silver: round(length * level.silver_per_m), gold: round(length * level.gold_per_m), max_ms: Math.round((length / MIN_ZONE_SPEED) * 1000) };
}

export function drift_stars(score: number, zone: Pick<Zone, "silver" | "gold">): number {
  if (score >= zone.gold) return MAX_STARS;
  return score >= zone.silver ? 2 : 1;
}

export interface Motion {
  heading: number;
  vx: number;
  vz: number;
}

export function slip(motion: Motion): number {
  const fx = Math.sin(motion.heading);
  const fz = Math.cos(motion.heading);
  return Math.abs(Math.atan2(fx * motion.vz - fz * motion.vx, fx * motion.vx + fz * motion.vz));
}

export const ComboEnd = { NONE: "none", BANKED: "banked", LOST: "lost" } as const;
export type ComboEnd = (typeof ComboEnd)[keyof typeof ComboEnd];

// A slide scores angle × speed × time at the live multiplier. Straightening for GRACE_MS banks the chain; a wall throws it away.
export class Combo {
  banked = 0;
  chain = 0;
  mult = 1;
  best_chain = 0;
  lost = 0;
  private slide_ms = 0;
  private calm_ms = 0;

  get score(): number {
    return this.banked + this.chain;
  }

  get sliding(): boolean {
    return this.calm_ms === 0 && this.slide_ms > 0;
  }

  step(dt_ms: number, angle: number, speed: number, scoring: boolean, wall: boolean): ComboEnd {
    if (wall) {
      const had = this.chain > 0;
      this.reset_chain();
      if (had) this.lost++;
      return had ? ComboEnd.LOST : ComboEnd.NONE;
    }
    if (scoring && speed >= MIN_SPEED && angle >= MIN_ANGLE && angle < SPIN_ANGLE) {
      this.calm_ms = 0;
      this.slide_ms += dt_ms;
      this.mult = Math.min(MAX_MULT, 1 + Math.floor(this.slide_ms / MULT_MS));
      this.chain += (Math.min(angle, MAX_ANGLE) / DEG) * speed * RATE * (dt_ms / 1000) * this.mult;
      return ComboEnd.NONE;
    }
    if (this.chain <= 0) return ComboEnd.NONE;
    this.calm_ms += dt_ms;
    if (this.calm_ms < GRACE_MS) return ComboEnd.NONE;
    this.bank();
    return ComboEnd.BANKED;
  }

  bank() {
    this.banked += this.chain;
    this.best_chain = Math.max(this.best_chain, this.chain);
    this.reset_chain();
  }

  private reset_chain() {
    this.chain = 0;
    this.mult = 1;
    this.slide_ms = 0;
    this.calm_ms = 0;
  }
}

export const DriftStatus = { READY: "ready", RUNNING: "running", DONE: "done" } as const;
export type DriftStatus = (typeof DriftStatus)[keyof typeof DriftStatus];

export interface DriftPose extends Motion {
  x: number;
  z: number;
}

export class DriftRun {
  status: DriftStatus = DriftStatus.READY;
  clock = 0;
  started = 0;
  ended = 0;
  timed_out = false;
  readonly combo = new Combo();
  readonly tracker: RouteTracker;
  private readonly solids: readonly Solid[];
  private in_touch = false;

  constructor(
    readonly zone: Zone,
    solids: readonly Solid[],
  ) {
    this.tracker = new RouteTracker(zone.points);
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const p of zone.points) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      z0 = Math.min(z0, p.z);
      z1 = Math.max(z1, p.z);
    }
    this.solids = solids.filter((s) => s.x > x0 - SOLID_REACH && s.x < x1 + SOLID_REACH && s.z > z0 - SOLID_REACH && s.z < z1 + SOLID_REACH);
  }

  elapsed(): number {
    if (this.status === DriftStatus.READY) return 0;
    return (this.status === DriftStatus.DONE ? this.ended : this.clock) - this.started;
  }

  stars(): number {
    return drift_stars(this.combo.score, this.zone);
  }

  update(dt_ms: number, pose: DriftPose, body: Body, road_half: number): ComboEnd {
    if (this.status === DriftStatus.DONE) return ComboEnd.NONE;
    this.clock += dt_ms;
    const index = this.tracker.update(pose.x, pose.z);
    const last = this.zone.points.length - 1;
    if (this.status === DriftStatus.READY) {
      if (index < LEAD) return ComboEnd.NONE;
      this.status = DriftStatus.RUNNING;
      this.started = this.clock;
    }
    const now = touching(this.solids, { x: pose.x, z: pose.z, heading: pose.heading, speed: 0 }, body);
    const wall = now && !this.in_touch;
    this.in_touch = now;
    const p = this.zone.points[index];
    const forward = pose.vx * p.tx + pose.vz * p.tz > MIN_SPEED / 2;
    const speed = Math.hypot(pose.vx, pose.vz);
    const end = this.combo.step(dt_ms, slip(pose), speed, forward && this.tracker.offset <= road_half + ROAD_SLACK, wall);
    const out_of_time = this.clock - this.started >= this.zone.max_ms;
    if (index >= last || out_of_time) {
      this.combo.bank();
      this.timed_out = out_of_time && index < last;
      this.status = DriftStatus.DONE;
      this.ended = this.clock;
    }
    return end;
  }
}

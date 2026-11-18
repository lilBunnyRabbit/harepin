import { atan2, cos, hypot, sin } from "../sim-math";
import type { RoutePoint } from "./route";

/** Seconds a run off the track must gain over the legal line before it counts as a cut. */
export const CUT_GAIN_S = 0.1;
/** Metres past the route's half width a car's centre sits with a wheel still on the edge: the legal inside line runs here. */
const EDGE_REACH = 1.5;
const CUT_SPEED = 2;
/** Metres the car's place along the line may move in one call before it reads as put back somewhere else, not driven. */
const JUMP_M = 25;
/** Lateral grip, in g, the legal line's bends are driven at: generous, so a cut is judged against a fast car, never a slow one. */
const CORNER_G = 1.5;
const GRAVITY = 9.81;

export const TrackSide = { ON: "on", OFF: "off", AIR: "air" } as const;
export type TrackSide = (typeof TrackSide)[keyof typeof TrackSide];

export interface LimitsGround {
  on_road(x: number, z: number): boolean;
  on_kerb(x: number, z: number): boolean;
}

export interface LimitsCar {
  readonly wheels: readonly { readonly contact: boolean; readonly point: { readonly x: number; readonly z: number } }[];
}

export function track_side(car: LimitsCar, ground: LimitsGround): TrackSide {
  let touching = false;
  for (const w of car.wheels) {
    if (!w.contact) continue;
    if (ground.on_road(w.point.x, w.point.z) || ground.on_kerb(w.point.x, w.point.z)) return TrackSide.ON;
    touching = true;
  }
  return touching ? TrackSide.OFF : TrackSide.AIR;
}

const wrap = (a: number) => atan2(sin(a), cos(a));

export class LineMeasure {
  readonly length: number;
  private readonly along: Float64Array;
  private readonly turn: Float64Array;

  constructor(private readonly line: readonly RoutePoint[]) {
    const n = line.length;
    this.along = new Float64Array(n);
    this.turn = new Float64Array(n);
    for (let i = 1; i < n; i++) {
      const a = line[i - 1];
      const b = line[i];
      this.along[i] = this.along[i - 1] + hypot(b.x - a.x, b.z - a.z);
      this.turn[i] = this.turn[i - 1] + Math.abs(wrap(atan2(b.tx, b.tz) - atan2(a.tx, a.tz)));
    }
    this.length = this.along[n - 1];
  }

  /** Metres from the start of lap `lap` (0 the first) to (x, z), projected on the tangent of point `index`, the nearest. */
  at(lap: number, index: number, x: number, z: number): number {
    const p = this.line[index];
    const s = this.along[index] + (x - p.x) * p.tx + (z - p.z) * p.tz;
    return lap * this.length + Math.max(0, Math.min(this.length, s));
  }

  turned(from: number, to: number): number {
    return this.turn_to(to) - this.turn_to(from);
  }

  private turn_to(s: number): number {
    const { along, turn, length } = this;
    const laps = Math.floor(s / length);
    const r = s - laps * length;
    let lo = 0;
    let hi = along.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (along[mid] <= r) lo = mid;
      else hi = mid;
    }
    const span = along[hi] - along[lo];
    const t = span > 0 ? (r - along[lo]) / span : 0;
    return laps * turn[turn.length - 1] + turn[lo] + (turn[hi] - turn[lo]) * t;
  }
}

/**
 * A cut is a run with every touching wheel off road and kerb that beats the legal line (the route cut short by its
 * inside edge on every bend) on both tests: shorter than it, and over it faster than the car's speed going off. A wide
 * run is longer; a cut that bogs down in the grass loses time; neither counts.
 */
export class CutCheck {
  cuts = 0;
  private off = false;
  private from = 0;
  private path = 0;
  private time = 0;
  private entry = 0;
  private last = 0;

  constructor(
    private readonly measure: LineMeasure,
    private readonly half: number,
  ) {}

  /** `s`: metres along the race (`LineMeasure.at`); `speed`: m/s over the ground; `dt`: s since the last call. True on the frame a cut ends. */
  update(side: TrackSide, s: number, speed: number, dt: number): boolean {
    if (this.off && Math.abs(s - this.last) > JUMP_M) this.off = false;
    this.last = s;
    if (side === TrackSide.ON) {
      const was = this.off;
      this.off = false;
      const cut = was && this.judge(s);
      this.entry = speed;
      return cut;
    }
    if (!this.off) {
      if (side === TrackSide.AIR) return false;
      this.off = true;
      this.from = s;
      this.path = 0;
      this.time = 0;
    }
    this.path += speed * dt;
    this.time += dt;
    return false;
  }

  gain(s: number): number {
    const { time, path, entry } = this;
    const turn = this.measure.turned(this.from, s);
    const legal = s - this.from - (this.half + EDGE_REACH) * turn;
    if (legal <= 0 || time <= 0 || entry < CUT_SPEED) return 0;
    // Straight through a bend keeps a speed the bend's own line could not: the legal time takes the slower of the two.
    const corner = turn > 0 ? Math.sqrt((CORNER_G * GRAVITY * legal) / turn) : Infinity;
    return legal / Math.min(corner, Math.max(entry, path / time)) - time;
  }

  private judge(s: number): boolean {
    if (this.gain(s) < CUT_GAIN_S) return false;
    this.cuts++;
    return true;
  }

  /** Judges a run still off the track where the race ends: over the line before the wheels are back on. */
  settle(s: number): boolean {
    if (!this.off) return false;
    this.off = false;
    return this.judge(s);
  }

  reset() {
    this.off = false;
  }
}

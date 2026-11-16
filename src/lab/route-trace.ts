import type { Car, Controls } from "../car/car";

/** About 9 laps of a 5 km circuit at one sample a route point; past it the trace stops and its head says `full`. */
export const TRACE_MAX = 30000;
export const RESETS_MAX = 64;
const FIELDS = 9;
/** Seconds between samples while the car holds one route point: a stop or a spin still shows. */
const HOLD = 0.25;
/** Pedals, wheel and slip to 2 decimals, a whole 0 or 1 bare: most samples are flat out. */
const short = (v: number) => String(Number(v.toFixed(2)));
const BEHIND = 5;
const AHEAD = 40;

/** A trace as its export lines: the live one, or one kept across a reload. */
export interface TraceLines {
  lines(): string[];
}

/** A trace read back from the tab's storage, its lines as they were kept. */
export class KeptTrace implements TraceLines {
  constructor(private readonly kept: readonly string[]) {}

  lines(): string[] {
    return [...this.kept];
  }
}

/** Whether `raw` reads as the lines `RouteTrace.lines` writes: a head, then samples and placements. */
export function trace_lines_of(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > TRACE_MAX + RESETS_MAX + 1) return null;
  if (!raw.every((line) => typeof line === "string")) return null;
  const [head, ...rest] = raw as string[];
  return head.startsWith(" trace ") && rest.every((line) => line.startsWith(" s ") || line.startsWith(" r ")) ? (raw as string[]) : null;
}

/**
 * The drive along a closed route, for `scripts/ai-ml/owner.ts`: one sample each time the car reaches another route
 * point (and every HOLD s while it does not), the laps it closes, and the placements. `step` runs at 360 Hz inside the
 * sim loop and writes preallocated arrays only.
 */
export class RouteTrace implements TraceLines {
  private readonly data = new Float32Array(TRACE_MAX * FIELDS);
  private readonly reset_at = new Float64Array(RESETS_MAX);
  private count = 0;
  private reset_count = 0;
  private index = 0;
  private wraps = 0;
  private closed = 0;
  private lost = true;
  private last_t = -Infinity;
  private last_index = -1;
  private steps = 0;
  private throttle = 0;
  private brake = 0;
  private steer = 0;
  private slip = 0;

  constructor(private readonly points: readonly { x: number; z: number }[]) {}

  get samples(): number {
    return this.count;
  }

  placed(t: number, moving: boolean) {
    this.lost = true;
    if (moving && this.reset_count < RESETS_MAX) this.reset_at[this.reset_count++] = t;
  }

  /** `slip` in rad. True on the step the car first gets past the start once more than ever before: a rewind back over it never counts a lap twice. */
  step(t: number, car: Car, input: Controls, slip: number): boolean {
    const n = this.points.length;
    const was = this.wraps * n + this.index;
    const index = this.nearest(car.pos.x, car.pos.z);
    if (this.lost) {
      this.wraps = Math.round((was - index) / n);
      this.lost = false;
    } else if (index < this.index - n / 2) this.wraps++;
    else if (index > this.index + n / 2) this.wraps--;
    this.index = index;
    this.steps++;
    this.throttle += input.throttle;
    this.brake += input.brake;
    this.steer += input.steer;
    this.slip = Math.max(this.slip, slip);
    if ((index !== this.last_index || t - this.last_t >= HOLD) && this.count < TRACE_MAX) {
      const o = this.count++ * FIELDS;
      const d = this.data;
      d[o] = t;
      d[o + 1] = index;
      d[o + 2] = car.pos.x;
      d[o + 3] = car.pos.z;
      d[o + 4] = Math.hypot(car.vel.x, car.vel.z);
      d[o + 5] = this.throttle / this.steps;
      d[o + 6] = this.brake / this.steps;
      d[o + 7] = this.steer / this.steps;
      d[o + 8] = this.slip;
      this.last_t = t;
      this.last_index = index;
      this.steps = this.throttle = this.brake = this.steer = this.slip = 0;
    }
    const progress = this.wraps * n + index;
    if (progress < (this.closed + 1) * n) return false;
    this.closed++;
    return true;
  }

  private nearest(x: number, z: number): number {
    const n = this.points.length;
    const from = this.lost ? 0 : this.index - BEHIND;
    const to = this.lost ? n - 1 : this.index + AHEAD;
    let best = this.index;
    let best_d = Infinity;
    for (let k = from; k <= to; k++) {
      const i = ((k % n) + n) % n;
      const p = this.points[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < best_d) {
        best_d = d;
        best = i;
      }
    }
    return best;
  }

  /** ` trace <samples> <route points> [full]`, then one ` s` line a sample (t rp x z v, then throttle brake steer as means and slip as the peak since the last sample) and one ` r <t>` a placement. */
  lines(): string[] {
    const d = this.data;
    const out = [` trace ${this.count} ${this.points.length}${this.count >= TRACE_MAX ? " full" : ""}`];
    for (let k = 0; k < this.count; k++) {
      const o = k * FIELDS;
      out.push(` s ${d[o].toFixed(2)} ${d[o + 1]} ${d[o + 2].toFixed(1)} ${d[o + 3].toFixed(1)} ${d[o + 4].toFixed(1)} ${short(d[o + 5])} ${short(d[o + 6])} ${short(d[o + 7])} ${short(d[o + 8])}`);
    }
    for (let k = 0; k < this.reset_count; k++) out.push(` r ${this.reset_at[k].toFixed(3)}`);
    return out;
  }
}

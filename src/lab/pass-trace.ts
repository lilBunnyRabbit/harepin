import type { RaceLine } from "../ai/line";
import type { Controls } from "../car/car";
import type { TraceLines } from "./route-trace";

/** Where on the AI's plan a road point lies: slowing for a bend, holding its speed through one, pulling out of one, or none of them. */
export const Phase = { BRAKING: "braking", APEX: "apex", EXIT: "exit", STRAIGHT: "straight" } as const;
export type Phase = (typeof Phase)[keyof typeof Phase];
const PHASES: readonly Phase[] = [Phase.BRAKING, Phase.APEX, Phase.EXIT, Phase.STRAIGHT];

/** A bend of the line tighter than this radius (m) is a corner, as `scripts/ai-ml/corners.ts` reads one. */
const CORNER_RADIUS = 120;
/** Planned speed change per metre (1/s) under which the plan neither brakes nor pulls. */
const HOLD_SLOPE = 0.03;
/** A corner's apex is where its line bends at least this share of its tightest within APEX_SPAN road points: the plan's slowest speed alone is one point long. */
const APEX_SHARE = 0.7;
const APEX_SPAN = 25;
const EXIT_POINTS = 25;

export function line_phases(line: RaceLine): Uint8Array {
  const n = line.road.length;
  const out = new Uint8Array(n);
  let start = 0;
  while (start < n && Math.abs(line.bend[start]) > 1 / CORNER_RADIUS) start++;
  let since = Infinity;
  for (let k = 0; k < 2 * n; k++) {
    const i = (start + k) % n;
    const before = (i - 1 + n) % n;
    const slope = (line.speed[(i + 1) % n] - line.speed[before]) / Math.max(1e-6, line.step[before] + line.step[i]);
    const bend = Math.abs(line.bend[i]);
    const tight = bend > 1 / CORNER_RADIUS;
    since = tight ? 0 : since + 1;
    let tightest = 0;
    for (let j = -APEX_SPAN; tight && j <= APEX_SPAN; j++) tightest = Math.max(tightest, Math.abs(line.bend[(i + j + n) % n]));
    const phase = tight && bend >= APEX_SHARE * tightest ? Phase.APEX : slope < -HOLD_SLOPE ? Phase.BRAKING : since <= EXIT_POINTS && slope > HOLD_SLOPE ? Phase.EXIT : Phase.STRAIGHT;
    out[i] = PHASES.indexOf(phase);
  }
  return out;
}

/** Road points ahead a pass reads the bend it is braking for in: a hairpin's braking starts 150 m out. */
const BEND_AHEAD = 75;

/** Per road point, the signed bend (1/m) of the line's tightest point from EXIT_POINTS behind to BEND_AHEAD ahead: the corner a car there is in, leaving or slowing for. */
export function line_corners(line: RaceLine): Float64Array {
  const n = line.road.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let tightest = 0;
    for (let j = -EXIT_POINTS; j <= BEND_AHEAD; j++) {
      const bend = line.bend[(i + j + n) % n];
      if (Math.abs(bend) > Math.abs(tightest)) tightest = bend;
    }
    out[i] = tightest;
  }
  return out;
}

interface PassCar {
  readonly pos: { x: number; z: number };
  readonly vel: { x: number; z: number };
}

/** What the trace reads of an AI field (`ai/field.ts`'s `Field` is one): its line, its cars and each car's road points from the start, the player's last. */
export interface PassField {
  readonly line: RaceLine;
  readonly racers: readonly { readonly car: PassCar; readonly driver: { readonly controls: Controls }; readonly stats: { readonly resets: number } }[];
  readonly progress: Float64Array;
  /** s since the field started. */
  readonly t: number;
}

export const PASS_MAX = 256;
export const SAMPLE_MAX = 2400;
const SAMPLE_HZ = 2;
/** Metres one car must be clear of the other along the road before a pass counts, as the field counts its own (`PASS_CLEAR`). */
const CLEAR = 3;
/** Seconds before the cars draw level, and after one is clear, that the pass's two gaps are read at. */
const GAP_SPAN = 2;
const GAP_HZ = 4;
const RING = GAP_SPAN * GAP_HZ;
/** Metres a car can't cover in one step: farther and it was put back (a rewind writes no placement). */
const JUMP = 5;
const STRAIGHT_RADIUS = 999;

const PASS_FIELDS = 18;
const P = { T: 0, MADE: 1, CAR: 2, LAP: 3, AT: 4, PHASE: 5, RADIUS: 6, YOU_V: 7, YOU_LAT: 8, YOU_THR: 9, YOU_BRK: 10, AI_V: 11, AI_LAT: 12, AI_THR: 13, AI_BRK: 14, BEFORE: 15, AFTER: 16, SIDE: 17 } as const;
const CAR_FIELDS = 5;

const num = (v: number, digits: number) => (Number.isFinite(v) ? String(Number(v.toFixed(digits))) : "-");

export function pass_lines_of(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > PASS_MAX + SAMPLE_MAX + 1) return null;
  if (!raw.every((line) => typeof line === "string")) return null;
  const [head, ...rest] = raw as string[];
  return head.startsWith(" passes ") && rest.every((line) => line.startsWith(" p ") || line.startsWith(" ft ")) ? (raw as string[]) : null;
}

/** A race trial's passes and its grid at SAMPLE_HZ, for `scripts/ai-ml/passes.ts`. `step` runs at 360 Hz in the sim loop: preallocated arrays only. */
export class PassTrace implements TraceLines {
  private readonly count: number;
  private readonly cum: Float64Array;
  private readonly length: number;
  private readonly phases: Uint8Array;
  private readonly corners: Float64Array;
  private readonly s: Float64Array;
  private readonly lat: Float64Array;
  private readonly speed: Float64Array;
  private readonly index: Int32Array;
  /** Per AI car: the player's metres ahead of it on the last step, and which of them was last clear ahead (1 the player, -1 the AI car, 0 not known). */
  private readonly gap: Float64Array;
  private readonly clear: Int8Array;
  private readonly resets: Int32Array;
  /** Per AI car: the pass it would be, held from the step the cars drew level until one is clear; its T is NaN with none. */
  private readonly level: Float64Array;
  private readonly ring: Float32Array;
  private ring_at = 0;
  private ring_t = 0;
  private readonly passes = new Float64Array(PASS_MAX * PASS_FIELDS);
  private pass_count = 0;
  private readonly after_at = new Float64Array(PASS_MAX).fill(NaN);
  private readonly samples: Float32Array;
  private sample_count = 0;
  private sample_t = -Infinity;
  private readonly thr: Float64Array;
  private readonly brk: Float64Array;
  private steps = 0;
  private last_x = NaN;
  private last_z = NaN;

  constructor(private readonly field: PassField) {
    const { line } = field;
    const n = line.road.length;
    this.count = field.racers.length;
    this.cum = new Float64Array(n);
    for (let i = 1; i < n; i++) this.cum[i] = this.cum[i - 1] + line.step[i - 1];
    this.length = this.cum[n - 1] + line.step[n - 1];
    this.phases = line_phases(line);
    this.corners = line_corners(line);
    const all = this.count + 1;
    this.s = new Float64Array(all);
    this.lat = new Float64Array(all);
    this.speed = new Float64Array(all);
    this.index = new Int32Array(all);
    this.gap = new Float64Array(this.count).fill(NaN);
    this.clear = new Int8Array(this.count);
    this.resets = new Int32Array(this.count);
    this.level = new Float64Array(this.count * PASS_FIELDS).fill(NaN);
    this.ring = new Float32Array(this.count * RING).fill(NaN);
    this.samples = new Float32Array(SAMPLE_MAX * (1 + all * CAR_FIELDS));
    this.thr = new Float64Array(all);
    this.brk = new Float64Array(all);
  }

  get pass_total(): number {
    return this.pass_count;
  }

  placed() {
    for (let i = 0; i < this.count; i++) this.forget(i);
  }

  private forget(i: number) {
    this.gap[i] = NaN;
    this.clear[i] = 0;
    this.level[i * PASS_FIELDS + P.T] = NaN;
    this.ring.fill(NaN, i * RING, (i + 1) * RING);
    for (let k = 0; k < this.pass_count; k++) if (this.passes[k * PASS_FIELDS + P.CAR] === i) this.after_at[k] = NaN;
  }

  private read(k: number, car: PassCar) {
    const { line, progress } = this.field;
    const n = line.road.length;
    const laps = Math.floor(progress[k] / n);
    const i = progress[k] - laps * n;
    const p = line.road[i];
    const along = (car.pos.x - p.x) * p.tx + (car.pos.z - p.z) * p.tz;
    this.index[k] = i;
    this.s[k] = laps * this.length + this.cum[i] + along;
    this.lat[k] = (car.pos.x - line.x[i]) * p.tz - (car.pos.z - line.z[i]) * p.tx;
    this.speed[k] = Math.hypot(car.vel.x, car.vel.z);
  }

  step(car: PassCar, input: Controls) {
    const { field, count } = this;
    if (Number.isNaN(field.progress[count])) return;
    const t = field.t;
    if ((car.pos.x - this.last_x) ** 2 + (car.pos.z - this.last_z) ** 2 > JUMP * JUMP) this.placed();
    this.last_x = car.pos.x;
    this.last_z = car.pos.z;
    this.read(count, car);
    this.steps++;
    this.thr[count] += input.throttle;
    this.brk[count] += input.brake;
    const ring_due = t - this.ring_t >= 1 / GAP_HZ;
    for (let i = 0; i < count; i++) {
      const racer = field.racers[i];
      this.read(i, racer.car);
      this.thr[i] += racer.driver.controls.throttle;
      this.brk[i] += racer.driver.controls.brake;
      if (racer.stats.resets !== this.resets[i]) {
        this.resets[i] = racer.stats.resets;
        this.forget(i);
      }
      this.watch(i, t, input);
      if (ring_due) this.ring[i * RING + this.ring_at] = this.gap[i];
    }
    if (ring_due) {
      this.ring_at = (this.ring_at + 1) % RING;
      this.ring_t = t;
    }
    for (let k = 0; k < this.pass_count; k++) {
      // NaN once read: no comparison with it holds.
      if (!(t >= this.after_at[k])) continue;
      const o = k * PASS_FIELDS;
      const now = this.gap[this.passes[o + P.CAR]];
      if (!Number.isNaN(now)) this.passes[o + P.AFTER] = now;
      this.after_at[k] = NaN;
    }
    if (t - this.sample_t >= 1 / SAMPLE_HZ) this.sample(t);
  }

  private watch(i: number, t: number, input: Controls) {
    const you = this.count;
    const was = this.gap[i];
    const gap = this.s[you] - this.s[i];
    this.gap[i] = gap;
    const o = i * PASS_FIELDS;
    const d = this.level;
    if (Number.isNaN(d[o + P.T]) && was * gap <= 0 && was !== gap) {
      const at = this.index[you];
      const bend = this.corners[at];
      const ai = this.field.racers[i].driver.controls;
      d[o + P.T] = t;
      d[o + P.MADE] = gap > was ? 1 : 0;
      d[o + P.CAR] = i;
      d[o + P.LAP] = Math.floor(this.s[you] / this.length) + 1;
      d[o + P.AT] = this.s[you] - Math.floor(this.s[you] / this.length) * this.length;
      d[o + P.PHASE] = this.phases[at];
      d[o + P.RADIUS] = Math.abs(bend) < 1 / STRAIGHT_RADIUS ? STRAIGHT_RADIUS : 1 / bend;
      d[o + P.YOU_V] = this.speed[you];
      d[o + P.YOU_LAT] = this.lat[you];
      d[o + P.YOU_THR] = input.throttle;
      d[o + P.YOU_BRK] = input.brake;
      d[o + P.AI_V] = this.speed[i];
      d[o + P.AI_LAT] = this.lat[i];
      d[o + P.AI_THR] = ai.throttle;
      d[o + P.AI_BRK] = ai.brake;
      // The oldest gap in the ring: GAP_SPAN s back, the next slot written.
      d[o + P.BEFORE] = this.ring[i * RING + this.ring_at];
    }
    const now = gap > CLEAR ? 1 : gap < -CLEAR ? -1 : 0;
    if (now === 0) return;
    const pending = !Number.isNaN(d[o + P.T]);
    if (pending && this.clear[i] === -now && (d[o + P.MADE] === 1) === (now === 1) && this.pass_count < PASS_MAX) {
      const k = this.pass_count++;
      const to = k * PASS_FIELDS;
      for (let f = 0; f < PASS_FIELDS; f++) this.passes[to + f] = d[o + f];
      this.passes[to + P.SIDE] = t - d[o + P.T];
      this.passes[to + P.AFTER] = NaN;
      this.after_at[k] = t + GAP_SPAN;
    }
    d[o + P.T] = NaN;
    this.clear[i] = now;
  }

  private sample(t: number) {
    const all = this.count + 1;
    if (this.sample_count < SAMPLE_MAX) {
      let o = this.sample_count++ * (1 + all * CAR_FIELDS);
      const d = this.samples;
      d[o++] = t;
      for (let k = 0; k < all; k++) {
        d[o++] = this.s[k];
        d[o++] = this.lat[k];
        d[o++] = this.speed[k];
        d[o++] = this.thr[k] / this.steps;
        d[o++] = this.brk[k] / this.steps;
      }
    }
    this.sample_t = t;
    this.steps = 0;
    this.thr.fill(0);
    this.brk.fill(0);
  }

  lines(): string[] {
    const all = this.count + 1;
    const out = [` passes ${this.pass_count} ${this.sample_count} ${this.count} ${num(this.length, 1)} ${SAMPLE_HZ}${this.sample_count >= SAMPLE_MAX || this.pass_count >= PASS_MAX ? " full" : ""}`];
    const p = this.passes;
    const car = (o: number) => `${num(p[o], 1)}/${num(p[o + 1], 2)}/${num(p[o + 2], 2)}/${num(p[o + 3], 2)}`;
    for (let k = 0; k < this.pass_count; k++) {
      const o = k * PASS_FIELDS;
      out.push(` p ${num(p[o + P.T], 2)} ${p[o + P.MADE] ? "made" : "lost"} car=${p[o + P.CAR]} lap=${p[o + P.LAP]} at=${num(p[o + P.AT], 1)} ${PHASES[p[o + P.PHASE]]} r=${num(p[o + P.RADIUS], 0)} you=${car(o + P.YOU_V)} ai=${car(o + P.AI_V)} gap=${num(p[o + P.BEFORE], 1)}/${num(p[o + P.AFTER], 1)} side=${num(p[o + P.SIDE], 2)}`);
    }
    const d = this.samples;
    const row = 1 + all * CAR_FIELDS;
    for (let k = 0; k < this.sample_count; k++) {
      const o = k * row;
      const cars: string[] = [];
      for (let c = 0; c < all; c++) {
        const at = o + 1 + c * CAR_FIELDS;
        cars.push(`${num(d[at], 1)},${num(d[at + 1], 1)},${num(d[at + 2], 1)},${num(d[at + 3], 2)},${num(d[at + 4], 2)}`);
      }
      out.push(` ft ${num(d[o], 2)} ${cars.join(" ")}`);
    }
    return out;
  }
}

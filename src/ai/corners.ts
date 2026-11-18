import type { RaceLine } from "./line";
import { FAST_AT, SLOW_AT, type Capability } from "./capability";
import { AI_TUNING } from "./tuning";

/** A bend tighter than this radius (m) is a corner; bends closer than MERGE road points are one corner. */
const CORNER_RADIUS = 120;
const MERGE = 15;
const MIN_LEN = 5;
const APPROACH = 100;
/** Longest straight (m) a feature counts: past it a car is at its top speed either way. */
const STRAIGHT_CAP = 300;

export interface Corner {
  /** Road points where the bend starts and ends, and its tightest radius (m). */
  from: number;
  to: number;
  radius: number;
}

const wrap = (i: number, n: number) => ((i % n) + n) % n;

export function corners(line: Pick<RaceLine, "bend">): Corner[] {
  const n = line.bend.length;
  const tight = (i: number) => Math.abs(line.bend[i]) > 1 / CORNER_RADIUS;
  let start = 0;
  while (start < n && tight(start)) start++;
  const out: Corner[] = [];
  let from = -1;
  let gap = 0;
  for (let k = 0; k <= n; k++) {
    const i = (start + k) % n;
    if (k < n && tight(i)) {
      if (from < 0) from = k;
      gap = 0;
    } else if (from >= 0 && (++gap > MERGE || k === n)) {
      const to = k - gap;
      if (to - from >= MIN_LEN) {
        let r = Infinity;
        for (let j = from; j <= to; j++) r = Math.min(r, 1 / Math.max(1e-9, Math.abs(line.bend[(start + j) % n])));
        out.push({ from: (start + from) % n, to: (start + to) % n, radius: r });
      }
      from = -1;
      gap = 0;
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

export interface CornerShape {
  /** Road point of the tightest bend, its radius (m), the corner's length (m) and how far it turns (rad). */
  apex: number;
  radius: number;
  length: number;
  turn: number;
  /** Mean curvature from the start to the apex and from the apex to the end, over the apex's: 1 is a constant radius. */
  entry: number;
  exit: number;
  /** Metres of road since the last corner ended and until the next one starts. */
  straight_in: number;
  straight_out: number;
  /** Most vertical curvature (1/m) over the APPROACH metres and the corner, and the approach's grade (negative downhill). */
  crest: number;
  grade: number;
  kick: number;
  /** m/s the car holds at the apex on its measured skidpad grip: the physics cap. */
  cap: number;
}

/**
 * Grip (m/s²) at `speed` m/s, on a line through the car's two skidpad figures in speed squared: downforce grows with
 * v², so the formula's grip at 35 m/s is past its 25 m/s figure, and a cap read off the fast figure held it 3 m/s
 * under the oracle's apex.
 */
export function grip_at_speed(speed: number, car: Capability): number {
  const per = (car.fast - car.slow) / (FAST_AT * FAST_AT - SLOW_AT * SLOW_AT);
  return car.slow + per * (speed * speed - SLOW_AT * SLOW_AT);
}

/** Most of the grip downforce may add in a bend of radius R, as R times its growth per v²: past 1 no speed is too fast. */
const DOWNFORCE_HOLD = 0.8;

/** m/s the car holds in a bend of `radius` m at `grip_at_speed`: v² = R g(v), solved for v. */
export function hold_speed(radius: number, car: Capability): number {
  const per = (car.fast - car.slow) / (FAST_AT * FAST_AT - SLOW_AT * SLOW_AT);
  const base = car.slow - per * SLOW_AT * SLOW_AT;
  return Math.sqrt((radius * base) / (1 - Math.min(DOWNFORCE_HOLD, radius * per)));
}

type ShapeLine = Pick<RaceLine, "bend" | "step" | "lift" | "kick" | "road">;

function span(line: ShapeLine, a: number, b: number): number {
  const n = line.bend.length;
  let d = 0;
  for (let i = a; i !== b; i = wrap(i + 1, n)) d += line.step[i];
  return d;
}

function mean_bend(line: ShapeLine, a: number, b: number): number {
  const n = line.bend.length;
  let s = 0;
  let m = 0;
  for (let i = a; ; i = wrap(i + 1, n)) {
    s += Math.abs(line.bend[i]);
    m++;
    if (i === b) return s / m;
  }
}

export function corner_shapes(line: ShapeLine, cs: readonly Corner[], car: Capability): CornerShape[] {
  const n = line.bend.length;
  return cs.map((c, k) => {
    const len = wrap(c.to - c.from, n);
    let apex = c.from;
    let turn = 0;
    let length = 0;
    for (let j = 0; j <= len; j++) {
      const i = wrap(c.from + j, n);
      if (Math.abs(line.bend[i]) > Math.abs(line.bend[apex])) apex = i;
      turn += Math.abs(line.bend[i]) * line.step[i];
      length += line.step[i];
    }
    const peak = Math.max(1e-9, Math.abs(line.bend[apex]));
    let back = c.from;
    let run = 0;
    while (run < APPROACH) {
      back = wrap(back - 1, n);
      run += line.step[back];
    }
    let crest = 0;
    let kick = 0;
    for (let i = back; ; i = wrap(i + 1, n)) {
      crest = Math.max(crest, line.lift[i]);
      kick = Math.max(kick, line.kick[i]);
      if (i === c.to) break;
    }
    const radius = 1 / peak;
    const alone = cs.length < 2;
    return {
      apex,
      radius,
      length,
      turn,
      entry: mean_bend(line, c.from, apex) / peak,
      exit: mean_bend(line, apex, c.to) / peak,
      straight_in: alone ? STRAIGHT_CAP : Math.min(STRAIGHT_CAP, span(line, cs[wrap(k - 1, cs.length)].to, c.from)),
      straight_out: alone ? STRAIGHT_CAP : Math.min(STRAIGHT_CAP, span(line, c.to, cs[wrap(k + 1, cs.length)].from)),
      crest,
      grade: (line.road[c.from].y - line.road[back].y) / run,
      kick,
      cap: hold_speed(radius, car),
    };
  });
}

/** A ridge fit on standardised features: bias plus coef times (x - mean) / scale. */
export interface Linear {
  bias: number;
  mean: readonly number[];
  scale: readonly number[];
  coef: readonly number[];
}

/** What `scripts/ai-ml/fit.ts` learns from the oracle's corners, in the units each target is fitted in. */
export interface CornerModel {
  /** Hash of the corner set it was fitted on, and its row count. */
  data: string;
  rows: number;
  features: readonly string[];
  /** Apex and exit speed over the corner's `cap`. */
  apex: Linear;
  exit: Linear;
  /** Metres from the brake point to the apex, over 100. */
  brake_m: Linear;
  /** Hardest braking into the corner over the car's measured full brake. */
  peak: Linear;
  /** Pull at full throttle falls by this times the square of the share of the grip the bend takes. */
  pull_bend: number;
}

/** One corner as the model plans it: road points, m/s at the apex and the end, metres of braking and its hardest m/s². */
export interface CornerPlan {
  from: number;
  to: number;
  apex: number;
  speed: number;
  exit: number;
  brake_m: number;
  peak: number;
}

export function corner_plans(line: ShapeLine, car: Capability, model: CornerModel): CornerPlan[] {
  const cs = corners(line);
  const shapes = corner_shapes(line, cs, car);
  return cs.map((c, k) => {
    const s = shapes[k];
    const x = features(s, car);
    return { from: c.from, to: c.to, apex: s.apex, speed: predict(model.apex, x) * s.cap, exit: predict(model.exit, x) * s.cap, brake_m: Math.max(0, predict(model.brake_m, x) * 100), peak: predict(model.peak, x) * car.brake };
  });
}

export function predict(m: Linear, x: readonly number[]): number {
  let y = m.bias;
  for (let j = 0; j < x.length; j++) y += (m.coef[j] * (x[j] - m.mean[j])) / m.scale[j];
  return y;
}

export const FEATURES =["radius", "turn", "entry", "exit", "straight_in", "straight_out", "crest", "grade", "kick", "brake", "power", "cap"] as const;

export function features(s: CornerShape, car: Capability): number[] {
  const grip = grip_at_speed(s.cap, car);
  return [
    Math.log(s.radius / AI_TUNING.hairpin_radius),
    s.turn,
    s.entry,
    s.exit,
    s.straight_in / 100,
    s.straight_out / 100,
    s.crest * 100,
    s.grade * 10,
    s.kick,
    car.brake / grip,
    car.power / (grip * s.cap),
    s.cap / 30,
  ];
}

import { build_spec, stats, type Build } from "./build";
import type { CarSpec } from "./cars";

const GRAVITY = 9.81;

/** What the reference lap reads off a car: full-throttle and steady-cornering acceleration at a speed, braking (m/s²), top speed (m/s). */
export interface Pace {
  accel(v: number): number;
  brake: number;
  lateral(v: number): number;
  top: number;
}

/** Metres: the straight before the corner, then the corner itself. */
interface Corner {
  straight: number;
  radius: number;
  arc: number;
}

// A made-up circuit with a hairpin, tight and fast sweepers and two long straights: every part of a car's pace shows on
// it, which is all a rating needs. Forza rates by a simulated lap too.
const TRACK: readonly Corner[] = [
  { straight: 520, radius: 18, arc: 50 },
  { straight: 160, radius: 45, arc: 70 },
  { straight: 240, radius: 120, arc: 160 },
  { straight: 90, radius: 30, arc: 45 },
  { straight: 380, radius: 70, arc: 110 },
  { straight: 130, radius: 220, arc: 260 },
  { straight: 450, radius: 25, arc: 40 },
];
const STEP = 2;

// Downforce grows grip with speed, so a fast sweeper can be flat out.
function corner_speed(pace: Pace, radius: number): number {
  if (pace.top * pace.top <= radius * pace.lateral(pace.top)) return pace.top;
  let low = 0;
  let high = pace.top;
  for (let i = 0; i < 40; i++) {
    const v = (low + high) / 2;
    if (v * v <= radius * pace.lateral(v)) low = v;
    else high = v;
  }
  return low;
}

export function lap_time(pace: Pace): number {
  const caps: number[] = [];
  for (const corner of TRACK) {
    const speed = corner_speed(pace, corner.radius);
    for (let s = 0; s < corner.straight; s += STEP) caps.push(pace.top);
    for (let s = 0; s < corner.arc; s += STEP) caps.push(speed);
  }
  const n = caps.length;
  const v = caps.slice();
  // Two passes round the loop so the lap starts at the speed it finishes with.
  let carry = 0;
  for (let k = 0; k < 2 * n; k++) {
    const i = k % n;
    carry = Math.min(caps[i], Math.sqrt(carry * carry + 2 * Math.max(0, pace.accel(carry)) * STEP));
    if (k >= n) v[i] = carry;
  }
  carry = v[0];
  for (let k = 2 * n - 1; k >= 0; k--) {
    const i = k % n;
    carry = Math.min(v[i], Math.sqrt(carry * carry + 2 * pace.brake * STEP));
    v[i] = carry;
  }
  let t = 0;
  for (let i = 0; i < n; i++) t += (2 * STEP) / (v[i] + v[(i + 1) % n]);
  return t;
}

// How much of each stat the sim delivers, fitted against laps on measured pace (`bun scripts/pi.ts`, 1% RMS lap error).
// Every one is positive, so a better stat never makes the lap slower: that is what keeps PI monotonic.
const POWER_SHARE = 0.3;
const LAUNCH_GRIP = 0.72;
const CORNER_GRIP = 1.25;
const DOWNFORCE_GRIP = 0.87;
const BRAKE_SHARE = 0.9;
// Below it, power over speed runs to infinity; wheelspin sets the launch instead.
const LAUNCH_SPEED = 5;

export function stat_pace(spec: CarSpec): Pace {
  const s = stats(spec);
  const press = spec.downforce / spec.mass;
  const traction = LAUNCH_GRIP * s.grip * 2 * GRAVITY;
  return {
    accel: (v) => Math.min(traction, (POWER_SHARE * s.power) / Math.max(v, LAUNCH_SPEED)) * (1 - (v / s.top_speed) ** 3),
    brake: BRAKE_SHARE * s.braking,
    lateral: (v) => CORNER_GRIP * s.grip * (GRAVITY + DOWNFORCE_GRIP * press * v * v),
    top: s.top_speed,
  };
}

export const PI_MIN = 100;
export const PI_MAX = 999;
const LAP_LENGTH = TRACK.reduce((sum, c) => sum + c.straight + c.arc, 0);
// PI grows with the log of lap speed, so each step up is the same share faster: road cars spread over classes instead
// of bunching under the formula car. The floor speed is about the stock bus's.
const FLOOR_SPEED = 21;
const PI_PER_LOG = 960;
// The lap never fires nitro, a race does: PI per second of boost in the tank.
const NITRO_PI = 3;

export function spec_pi(spec: CarSpec): number {
  const speed = LAP_LENGTH / lap_time(stat_pace(spec));
  const rated = PI_MIN + PI_PER_LOG * Math.log(speed / FLOOR_SPEED) + NITRO_PI * (spec.nitro ?? 0);
  return Math.round(Math.max(PI_MIN, Math.min(PI_MAX, rated)));
}

export function pi(build: Build): number {
  return spec_pi(build_spec(build));
}

export const CarClass = {
  D: "d",
  C: "c",
  B: "b",
  A: "a",
  S1: "s1",
  S2: "s2",
  X: "x",
} as const;
export type CarClass = (typeof CarClass)[keyof typeof CarClass];

/** Each class's lowest PI, slowest first, for races and events to filter on. */
export const CLASS_FLOORS: readonly (readonly [CarClass, number])[] = [
  [CarClass.D, PI_MIN],
  [CarClass.C, 400],
  [CarClass.B, 500],
  [CarClass.A, 600],
  [CarClass.S1, 700],
  [CarClass.S2, 800],
  [CarClass.X, 900],
];

export const CLASS_LABELS: Record<CarClass, string> = { d: "D", c: "C", b: "B", a: "A", s1: "S1", s2: "S2", x: "X" };

export function class_of(rating: number): CarClass {
  let found: CarClass = CarClass.D;
  for (const [name, floor] of CLASS_FLOORS) if (rating >= floor) found = name;
  return found;
}

export interface Rating {
  pi: number;
  class: CarClass;
}

export function rating(build: Build): Rating {
  const value = pi(build);
  return { pi: value, class: class_of(value) };
}

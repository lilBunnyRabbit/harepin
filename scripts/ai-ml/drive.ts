import { Vector3 } from "three";
import { Car, drop_height } from "../../src/car/car";
import type { CarSpec } from "../../src/car/cars";
import { plan_scale } from "../../src/ai/capability";
import { Driver, OFF_ROAD } from "../../src/ai/driver";
import { race_line, type RaceLine } from "../../src/ai/line";
import { ROAD_HALF } from "../../src/worldgen/types";
import type { World } from "../../src/world/world";
import type { Route } from "../../src/worldgen/types";
import { DT } from "../autolap";

/**
 * The oracle's lap: a closed-loop driver whose every limit is a search variable. Per knot (every `knot` road points) a
 * share over the base speed plan, metres off the race line and the most brake pedal; over the lap the steering gains,
 * aim and slide let-go. Raw open-loop wheel angles cannot hold a 360 Hz car on the road for a lap, so the wheel stays
 * pure pursuit on the searched path, as every real driver model does.
 */
export const KNOT_VARS = 3;
export const GLOBALS = [
  { name: "steer_gain", lo: 2, hi: 8, init: 4.5 },
  { name: "steer_damp", lo: 0.2, hi: 2.5, init: 1 },
  { name: "aim_base", lo: 3, hi: 12, init: 7 },
  { name: "aim_per", lo: 2, hi: 6, init: 3 },
  { name: "slide_let_go", lo: 0.05, hi: 0.4, init: 0.15 },
] as const;
const SPEED = [0.75, 1.6] as const;
const SPEED_INIT = 0.95;
const OFFSET = [-3, 3] as const;
const PEDAL = [0.2, 1] as const;
const PEDAL_INIT = 0.6;
/** Grip and braking (m/s²) the base plan the knots scale is built on: about the coupe's skidpad less a margin. */
const BASE_GRIP = 7.5;
const BASE_BRAKE = 6;
const JUMP_PACE = 32;
const RAMP_SIDE = 0.5;
const EDGE = 0.4;
/** m/s over the target before the brake comes on, and m/s of overspeed per unit of pedal. */
const SLACK = 0.5;
const BRAKE_PER = 2;
const HAIRPIN_PACE = 15;
const AIM_HAIRPIN = 5;
/** A slide (rad) past which the lap is a spin, as the field counts one; a hit (m/s) past which it is not clean. */
export const SPIN = 1.6;
const HIT = 3;
/** Seconds a failed lap is charged, plus a second per this many metres it had left. */
const FAIL = 30;
const FAIL_SPEED = 15;

export const unit_init = (knots: number): number[] => {
  const u = (v: number, [lo, hi]: readonly [number, number]) => (v - lo) / (hi - lo);
  const per = [u(SPEED_INIT, SPEED), u(0, OFFSET), u(PEDAL_INIT, PEDAL)];
  return [...GLOBALS.map((g) => u(g.init, [g.lo, g.hi])), ...Array.from({ length: knots }, () => per).flat()];
};

export const knot_count = (line: RaceLine, knot: number) => Math.ceil(line.road.length / knot);

function wrap_angle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function base_plan(line: RaceLine): Float64Array {
  const n = line.road.length;
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.min(Math.sqrt(BASE_GRIP / Math.max(1e-9, Math.abs(line.bend[i]))), line.ramp[i] >= 0 ? JUMP_PACE : Infinity);
  for (let k = 2 * n - 1; k >= 0; k--) {
    const i = k % n;
    const j = (k + 1) % n;
    v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * BASE_BRAKE * line.step[i]));
  }
  return v;
}

export interface Trace {
  /** Per road point, at the step the car first reached it: seconds, m/s, pedals, wheel and slide (rad). */
  t: number[];
  speed: number[];
  throttle: number[];
  brake: number[];
  steer: number[];
  slide: number[];
}

export interface LapResult {
  /** Lap seconds when clean, else seconds plus the FAIL charge: what the search minimises. */
  loss: number;
  t: number;
  clean: boolean;
  why: "" | "off" | "spin" | "hit" | "flip" | "slow";
  /** Road points reached. */
  reached: number;
  peak_slide: number;
  trace?: Trace;
}

const up = new Vector3();

function recorder(n: number) {
  const tr: Trace = { t: Array(n).fill(NaN), speed: Array(n).fill(NaN), throttle: Array(n).fill(NaN), brake: Array(n).fill(NaN), steer: Array(n).fill(NaN), slide: Array(n).fill(NaN) };
  return {
    tr,
    at(i: number, t: number, speed: number, c: { throttle: number; brake: number; steer: number }, slide: number) {
      if (!Number.isNaN(tr.t[i])) return;
      tr.t[i] = t;
      tr.speed[i] = speed;
      tr.throttle[i] = c.throttle;
      tr.brake[i] = c.brake;
      tr.steer[i] = c.steer;
      tr.slide[i] = slide;
    },
  };
}

interface Drive {
  world: World;
  route: Route;
  spec: CarSpec;
  /** The car's steering assist and stability control, both on as every car ships, or both off. */
  assists: boolean;
  line: RaceLine;
  limit: number;
  trace: boolean;
  /** Writes the controls for this step into the car's input; returns the speed it targets. */
  control: (car: Car, index: number, last: { err: number; at: number; swing: number }) => { steer: number; throttle: number; brake: number };
  track: (car: Car) => { index: number; progress: number };
}

/** One standing lap from the route's start, as `ai-race.ts solo` drives it, judged clean or not. */
function run(d: Drive): LapResult {
  const { world, route, spec, line } = d;
  const n = line.road.length;
  const car = new Car(spec);
  car.assist = car.stability = d.assists;
  const p = route.points[0];
  car.place(p.x, world.height(p.x, p.z) + drop_height(spec, 0.75), p.z, Math.atan2(p.tx, p.tz));
  const rec = d.trace ? recorder(n) : null;
  const last = { err: NaN, at: -1, swing: 0 };
  let t = 0;
  let peak = 0;
  let why: LapResult["why"] = "";
  let progress = 0;
  while (progress < n - 10) {
    const at = d.track(car);
    progress = at.progress;
    const c = d.control(car, at.index, last);
    const speed = Math.hypot(car.vel.x, car.vel.z);
    const slide = speed > 5 ? Math.abs(wrap_angle(Math.atan2(car.vel.x, car.vel.z) - car.heading)) : 0;
    peak = Math.max(peak, slide);
    rec?.at(at.index, t, speed, c, slide);
    car.step(DT, { steer: c.steer, throttle: c.throttle, brake: c.brake, handbrake: 0, analog: true }, world);
    const hit = world.collide(car);
    t += DT;
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
    if (world.distance_to_road(car.pos.x, car.pos.z) > OFF_ROAD) why = "off";
    else if (slide > SPIN) why = "spin";
    else if (hit > HIT) why = "hit";
    else if (up.set(0, 1, 0).applyQuaternion(car.quat).y < 0.3) why = "flip";
    else if (t > d.limit) why = "slow";
    if (why) break;
  }
  const left = line.step.reduce((s, v, i) => (i >= progress ? s + v : s), 0);
  return { loss: why ? t + FAIL + left / FAIL_SPEED : t, t, clean: !why, why, reached: progress, peak_slide: peak, trace: rec?.tr };
}

function tracker(line: RaceLine) {
  const n = line.road.length;
  let index = 0;
  let laps = 0;
  return (car: Car) => {
    let best = index;
    let best_d = Infinity;
    for (let k = -5; k <= 40; k++) {
      const i = (((index + k) % n) + n) % n;
      const dd = (line.road[i].x - car.pos.x) ** 2 + (line.road[i].z - car.pos.z) ** 2;
      if (dd < best_d) {
        best_d = dd;
        best = i;
      }
    }
    if (best < index - n / 2) laps++;
    else if (best > index + n / 2) laps--;
    index = best;
    return { index, progress: laps * n + index };
  };
}

export interface Track {
  world: World;
  route: Route;
  spec: CarSpec;
  line: RaceLine;
  base: Float64Array;
  assists: boolean;
}

export function track_of(world: World, route: Route, spec: CarSpec, assists = true): Track {
  const line = race_line(route.points, world.ramps, spec.radius, world, plan_scale(spec));
  return { world, route, spec, line, base: base_plan(line), assists };
}

/** The oracle lap for unit vector `x` (GLOBALS, then KNOT_VARS per knot). */
export function oracle_lap(tk: Track, x: readonly number[], knot: number, limit: number, trace = false): LapResult {
  const { line, base, spec } = tk;
  const n = line.road.length;
  const knots = knot_count(line, knot);
  const scale = (u: number, lo: number, hi: number) => lo + (hi - lo) * Math.max(0, Math.min(1, u));
  const g = GLOBALS.map((p, i) => scale(x[i], p.lo, p.hi));
  const [gain, damp, aim_base, aim_per, let_go] = g;
  const k0 = GLOBALS.length;
  const at_knot = (i: number, v: number, lo: number, hi: number) => {
    const f = i / knot;
    const a = Math.floor(f) % knots;
    const b = (a + 1) % knots;
    const w = f - Math.floor(f);
    return scale(x[k0 + a * KNOT_VARS + v] * (1 - w) + x[k0 + b * KNOT_VARS + v] * w, lo, hi);
  };
  const room = (i: number) => (line.room[i] === 0 ? RAMP_SIDE : ROAD_HALF - spec.radius - EDGE);
  const out = { steer: 0, throttle: 0, brake: 0 };
  return run({
    ...tk,
    limit,
    trace,
    track: tracker(line),
    control(car, index, last) {
      const speed = Math.hypot(car.vel.x, car.vel.z);
      const target = base[index] * at_knot(index, 0, SPEED[0], SPEED[1]);
      const look = target < HAIRPIN_PACE ? AIM_HAIRPIN : Math.round(aim_base) + Math.floor(speed / aim_per);
      const at = (index + look) % n;
      const p = line.road[at];
      const r = room(at);
      const lateral = Math.max(-r, Math.min(r, line.offset[at] + at_knot(at, 1, OFFSET[0], OFFSET[1])));
      const err = wrap_angle(Math.atan2(p.x + p.tz * lateral - car.pos.x, p.z - p.tx * lateral - car.pos.z) - car.heading);
      const swing = Number.isNaN(last.err) ? 0 : at === last.at ? wrap_angle(err - last.err) / DT : last.swing;
      last.err = err;
      last.at = at;
      last.swing = swing;
      const airborne = car.wheels.every((w) => !w.contact);
      const slide = speed > 5 ? Math.abs(wrap_angle(Math.atan2(car.vel.x, car.vel.z) - car.heading)) : 0;
      out.steer = airborne ? 0 : Math.max(-1, Math.min(1, -err * gain - swing * damp));
      out.throttle = speed < target ? 1 : 0;
      out.brake = speed > target + SLACK ? Math.min(at_knot(index, 2, PEDAL[0], PEDAL[1]), (speed - target) / BRAKE_PER) * Math.max(0, 1 - slide / let_go) : 0;
      return out;
    },
  });
}

/** The shipped AI's solo lap (STEADY, as `ai-race.ts solo`) at whatever AI_TUNING holds, recorded the same way. */
export function ai_lap(tk: Track, limit: number, trace = true): LapResult {
  const driver = new Driver(tk.line);
  return run({
    ...tk,
    limit,
    trace,
    track: (car) => {
      driver.track(car);
      return { index: driver.index, progress: driver.progress };
    },
    control: (car) => driver.drive(car, DT),
  });
}

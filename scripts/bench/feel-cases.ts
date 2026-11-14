import { Vector3 } from "three";
import type { CarSpec } from "../../src/car/cars";
import { Car, SteerMode, drop_height, type Controls, type Ground } from "../../src/car/car";

export const FLAT: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };
const slope = (grade: number): Ground => ({
  height: (_x, z) => z * grade,
  normal: (_x, _z, out) => out.set(0, 1, -grade).normalize(),
  grip: () => 1,
  roll: () => 1,
});

const DT = 1 / 360;
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false };
const tmp = new Vector3();

export interface Rig {
  spec: CarSpec;
  mode: SteerMode;
  ground?: Ground;
}

function fresh(rig: Rig, ground = rig.ground ?? FLAT, setup?: (car: Car) => void): Car {
  const car = new Car(rig.spec);
  car.steer_mode = rig.mode;
  setup?.(car);
  car.place(0, ground.height(0, 0) + drop_height(rig.spec, 0.6), 0, 0);
  run(car, 1.5, () => idle, ground);
  return car;
}

function run(car: Car, seconds: number, controls: (t: number) => Controls, ground: Ground, each?: (t: number) => void): number {
  let t = 0;
  while (t < seconds) {
    car.step(DT, controls(t), ground);
    t += DT;
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
    each?.(t);
  }
  return t;
}

const kmh = (car: Car) => car.forward_speed * 3.6;
const slip_angle = (car: Car) => {
  const local = tmp.copy(car.vel).applyQuaternion(car.quat.clone().invert());
  return car.vel.length() > 2 ? (Math.atan2(-local.x, local.z) * 180) / Math.PI : 0;
};
const upright = (car: Car) => tmp.set(0, 1, 0).applyQuaternion(car.quat).y;

function cruise(car: Car, target: number, extra: Partial<Controls> = {}): Controls {
  return { ...idle, ...extra, throttle: Math.max(0, Math.min(1, (target - kmh(car)) * 0.15 + 0.3)) };
}

const get_to = (car: Car, target: number, ground: Ground) => run(car, 30, () => cruise(car, target), ground);

export interface StepSteer {
  t90: number;
  /** Yaw peak over its settled value, minus 1. */
  overshoot: number;
  g: number;
  slip: number;
  kmh: number;
}

export function step_steer(rig: Rig): StepSteer {
  const ground = rig.ground ?? FLAT;
  const car = fresh(rig);
  get_to(car, 100, ground);
  let peak = 0;
  let t90 = -1;
  const samples: number[] = [];
  run(car, 3, () => cruise(car, 100, { steer: 1 }), ground, () => {
    samples.push(car.ang.y);
    peak = Math.max(peak, Math.abs(car.ang.y));
  });
  const steady = Math.abs(samples[samples.length - 1]);
  samples.some((v, i) => (Math.abs(v) >= 0.9 * steady ? ((t90 = i * DT), true) : false));
  const g = (steady * car.vel.length()) / 9.81;
  return { t90, overshoot: peak / steady - 1, g, slip: slip_angle(car), kmh: kmh(car) };
}

export function lane_change(rig: Rig): { slip: number; yaw: number; upright: number } {
  const ground = rig.ground ?? FLAT;
  const car = fresh(rig);
  get_to(car, 160, ground);
  let worst = 0;
  run(car, 4, (t) => cruise(car, 160, { steer: t < 0.25 ? 1 : t < 0.5 ? -1 : 0 }), ground, () => (worst = Math.max(worst, Math.abs(slip_angle(car)))));
  return { slip: worst, yaw: car.ang.y, upright: upright(car) };
}

/** Peak body slip (deg) after lifting off the throttle mid corner at 90 km/h. */
export function lift_off(rig: Rig, assist: boolean): number {
  const ground = rig.ground ?? FLAT;
  const car = fresh(rig, ground, (c) => Object.assign(c, { assist, stability: assist }));
  get_to(car, 90, ground);
  run(car, 2.5, () => cruise(car, 90, { steer: 0.8 }), ground);
  let worst = 0;
  run(car, 2, () => ({ ...idle, steer: 0.8 }), ground, () => (worst = Math.max(worst, Math.abs(slip_angle(car)))));
  return worst;
}

export function power_on(rig: Rig, tcs: boolean): { slip: number; rear_slip: number } {
  const ground = rig.ground ?? FLAT;
  const car = fresh(rig, ground, (c) => {
    c.tcs = tcs;
    c.auto = false;
  });
  car.gear = 2;
  get_to(car, 55, ground);
  run(car, 1.5, () => cruise(car, 55, { steer: 0.7 }), ground);
  let worst = 0;
  run(car, 2, () => ({ ...idle, throttle: 1, steer: 0.7 }), ground, () => (worst = Math.max(worst, Math.abs(slip_angle(car)))));
  return { slip: worst, rear_slip: car.wheels[2].slip };
}

export function handbrake_flick(rig: Rig): { turned: number; settle: number; upright: number } {
  const ground = rig.ground ?? FLAT;
  const car = fresh(rig);
  get_to(car, 70, ground);
  const h0 = car.heading;
  run(car, 0.45, () => ({ ...idle, steer: -1, handbrake: 1 }), ground);
  const turned = (((car.heading - h0) * 180) / Math.PI + 540) % 360 - 180;
  let settle = -1;
  run(car, 5, () => ({ ...idle, throttle: 0.4 }), ground, (t) => {
    if (settle < 0 && Math.abs(slip_angle(car)) < 3 && Math.abs(car.ang.y) < 0.1) settle = t;
  });
  return { turned, settle, upright: upright(car) };
}

/** `kmh` is the speed at the kick: under 220 when the car never got there in 30 s. */
export function yaw_kick(rig: Rig): { settle: number; slip: number; kmh: number } {
  const ground = rig.ground ?? FLAT;
  const car = fresh(rig);
  get_to(car, 220, ground);
  const at = kmh(car);
  car.ang.y = 0.3;
  let settle = -1;
  run(car, 3, () => cruise(car, 220), ground, (t) => {
    if (settle < 0 && Math.abs(car.ang.y) < 0.02) settle = t;
  });
  return { settle, slip: slip_angle(car), kmh: at };
}

export function trail_brake(rig: Rig): { slip: number; stopped: number } {
  const ground = rig.ground ?? FLAT;
  const car = fresh(rig);
  get_to(car, 120, ground);
  let worst = 0;
  let stopped = -1;
  // Off the brake once stopped: held on, the auto box takes it as reverse and the slip of a car backing up reads ~180°.
  run(car, 4, () => (stopped < 0 ? { ...idle, brake: 1, steer: 0.4 } : idle), ground, (t) => {
    worst = Math.max(worst, Math.abs(slip_angle(car)));
    if (stopped < 0 && kmh(car) < 1) stopped = t;
  });
  return { slip: worst, stopped };
}

export function hill(rig: Rig): { crept: number; kmh: number } {
  const ground = slope(0.2);
  const car = fresh(rig, ground);
  const z0 = car.pos.z;
  run(car, 5, () => idle, ground);
  const crept = car.pos.z - z0;
  run(car, 6, () => ({ ...idle, throttle: 1 }), ground);
  return { crept, kmh: kmh(car) };
}

export function lock_launch(rig: Rig): { kmh: number; yaw: number; upright: number } {
  const ground = rig.ground ?? FLAT;
  const car = fresh(rig);
  run(car, 4, () => ({ ...idle, throttle: 1, steer: 1 }), ground);
  return { kmh: kmh(car), yaw: car.ang.y, upright: upright(car) };
}

/** Largest height change in one step, metres. */
export function rest_jitter(rig: Rig): { jitter: number; speed: number } {
  const ground = rig.ground ?? FLAT;
  const car = fresh(rig);
  let jitter = 0;
  let prev = car.pos.y;
  run(car, 3, () => idle, ground, () => {
    jitter = Math.max(jitter, Math.abs(car.pos.y - prev));
    prev = car.pos.y;
  });
  return { jitter, speed: car.vel.length() };
}

export interface Creep {
  /** Rear-axle circle at full lock and 2 km/h, metres. */
  radius: number;
  kinematic: number;
  spread: number;
  kmh: number;
  kmh_sd: number;
  /** Peak sideways speed of the rear axle, m/s. */
  creep: number;
}

export function lock_creep(rig: Rig): Creep {
  const ground = rig.ground ?? FLAT;
  const car = fresh(rig);
  const target = 2;
  const creep = (): Controls => ({ ...idle, steer: 1, throttle: Math.max(0, Math.min(1, 0.08 + (target - kmh(car)) * 0.3)) });
  run(car, 8, creep, ground);
  const axle = new Vector3();
  const points: [number, number][] = [];
  const speeds: number[] = [];
  let slip = 0;
  run(car, 20, creep, ground, () => {
    axle.set(0, 0, car.spec.wheel.mounts[2][2]).applyQuaternion(car.quat).add(car.pos);
    points.push([axle.x, axle.z]);
    speeds.push(kmh(car));
    const local = tmp.copy(car.ang).cross(axle.sub(car.pos)).add(car.vel).applyQuaternion(car.quat.clone().invert());
    slip = Math.max(slip, Math.abs(local.x));
  });
  const n = points.length;
  const cx0 = points.reduce((s, p) => s + p[0], 0) / n;
  const cz0 = points.reduce((s, p) => s + p[1], 0) / n;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const [x, z] of points) {
    const u = x - cx0, v = z - cz0;
    suu += u * u; svv += v * v; suv += u * v;
    suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  const uc = ((suuu + suvv) / 2 * svv - (svvv + svuu) / 2 * suv) / det;
  const vc = ((svvv + svuu) / 2 * suu - (suuu + suvv) / 2 * suv) / det;
  const radii = points.map(([x, z]) => Math.hypot(x - cx0 - uc, z - cz0 - vc));
  const radius = radii.reduce((s, r) => s + r, 0) / n;
  const spread = Math.sqrt(radii.reduce((s, r) => s + (r - radius) ** 2, 0) / n);
  const mean = speeds.reduce((s, v) => s + v, 0) / n;
  const kmh_sd = Math.sqrt(speeds.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return { radius, kinematic: car.spec.wheelbase / Math.tan(car.spec.lock), spread, kmh: mean, kmh_sd, creep: slip };
}

export function gear_hunt(rig: Rig): { t100: number; shifts: number } {
  const ground = rig.ground ?? FLAT;
  const car = fresh(rig, ground, (c) => (c.tcs = false));
  let shifts = 0;
  let gear = car.gear;
  let t100 = -1;
  run(car, 12, () => ({ ...idle, throttle: 1 }), ground, (t) => {
    if (t100 < 0 && kmh(car) >= 100) t100 = t;
    if (t100 >= 0) return;
    if (car.gear !== gear) shifts++;
    gear = car.gear;
  });
  return { t100, shifts };
}

/** Peak yaw rate (rad/s) from a 150 ms key tap at 100 km/h. */
export function key_tap(rig: Rig): number {
  const ground = rig.ground ?? FLAT;
  const car = fresh(rig);
  get_to(car, 100, ground);
  let peak = 0;
  run(car, 1, (t) => cruise(car, 100, { steer: t < 0.15 ? 1 : 0 }), ground, () => (peak = Math.max(peak, Math.abs(car.ang.y))));
  return peak;
}

const hold = (rig: Rig): Rig => ({ ...rig, mode: SteerMode.HOLD });

export function hold_parked(rig: Rig): { full: number; parked: number; rolling: number; kmh: number } {
  const ground = rig.ground ?? FLAT;
  const car = fresh(hold(rig));
  run(car, 2, () => ({ ...idle, steer: 1 }), ground);
  const full = car.steer;
  run(car, 2, () => idle, ground);
  const parked = car.steer;
  const target = 2;
  run(car, 1, () => ({ ...idle, throttle: Math.max(0, Math.min(1, 0.08 + (target - kmh(car)) * 0.3)) }), ground);
  return { full, parked, rolling: car.steer, kmh: kmh(car) };
}

export function hold_reach(rig: Rig): number {
  const ground = rig.ground ?? FLAT;
  const car = fresh(hold(rig));
  let reach = -1;
  run(car, 2, () => ({ ...idle, steer: 1 }), ground, (t) => {
    if (reach < 0 && car.steer >= car.spec.lock * 0.99) reach = t;
  });
  return reach;
}

export function hold_release(rig: Rig): { held: number; centred: number; yaw: number } {
  const ground = rig.ground ?? FLAT;
  const car = fresh(hold(rig));
  get_to(car, 100, ground);
  run(car, 0.5, () => cruise(car, 100, { steer: 1 }), ground);
  const held = car.steer;
  let centred = -1;
  run(car, 2, () => cruise(car, 100), ground, (t) => {
    if (centred < 0 && Math.abs(car.steer) < Math.abs(held) * 0.1) centred = t;
  });
  return { held, centred, yaw: car.ang.y };
}

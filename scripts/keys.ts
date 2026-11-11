import { Vector3 } from "three";
import { CARS, COUPE, car_spec, type CarSpec } from "../src/car/cars";
import { Car, SteerMode, type Controls, type Ground } from "../src/car/car";

const DT = 1 / 360;
const FRAME = 1 / 60;
const PREVIEW = 0.6;
const DEAD = 0.2;
// A thumb on a key holds a press, or a gap, for about this long at best: a driver flicking faster is no human.
const KEY_MIN = 0.1;
const LANE = 3.5;

const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };
const ahead = new Vector3();

function rolling(spec: CarSpec, mode: SteerMode, kmh: number): Car {
  const car = new Car(spec);
  car.steer_mode = mode;
  car.park(0, 0, 0, flat);
  const v = kmh / 3.6;
  car.vel.set(0, 0, v);
  for (const w of car.wheels) w.omega = v / spec.wheel.radius;
  car.parked = false;
  return car;
}

const kmh = (car: Car) => car.forward_speed * 3.6;
const throttle = (car: Car, target: number) => Math.max(0, Math.min(1, (target - kmh(car)) * 0.15 + 0.3));
const slip_deg = (car: Car) => {
  const local = ahead.copy(car.vel).applyQuaternion(car.quat.clone().invert());
  return (Math.atan2(-local.x, Math.abs(local.z)) * 180) / Math.PI;
};

/**
 * A keyboard driver: once a frame it looks `PREVIEW` ahead along its velocity and holds the key towards the path while
 * the miss there is past `DEAD`. `miss` is positive with the path off to the car's left (+x), where positive steer turns away.
 */
function drive(car: Car, seconds: number, target_kmh: number, miss: (x: number, z: number) => number, each?: (t: number, steer: number) => void) {
  let steer = 0;
  let next = 0;
  let presses = 0;
  let locked = 0;
  for (let t = 0; t < seconds; t += DT) {
    if (t >= next) {
      next += FRAME;
      const swing = car.ang.y * PREVIEW * 0.5;
      const [c, s] = [Math.cos(swing), Math.sin(swing)];
      ahead.set(car.vel.x * c + car.vel.z * s, 0, car.vel.z * c - car.vel.x * s).multiplyScalar(PREVIEW).add(car.pos);
      const e = miss(ahead.x, ahead.z);
      const want = Math.abs(e) > DEAD ? -Math.sign(e) : 0;
      if (want !== steer && t >= locked) {
        if (want !== 0) presses++;
        steer = want;
        locked = t + KEY_MIN;
      }
    }
    car.step(DT, { steer, throttle: throttle(car, target_kmh), brake: 0, handbrake: 0, analog: false }, flat);
    each?.(t, steer);
  }
  return presses;
}

export interface LaneChange {
  /** Furthest the car ran past the new lane's centre, metres. */
  overshoot: number;
  /** Time from the lane switch until the car stays within 0.25 m of the lane and 1 degree of straight, seconds. */
  settle: number;
  presses: number;
}

export function lane_change(mode: SteerMode, spec = COUPE, speed = 120): LaneChange {
  const car = rolling(spec, mode, speed);
  let overshoot = 0;
  let settled = 0;
  const seconds = 6;
  const presses = drive(
    car,
    seconds,
    speed,
    (x) => LANE - x,
    (t) => {
      overshoot = Math.max(overshoot, car.pos.x - LANE);
      if (Math.abs(car.pos.x - LANE) > 0.25 || Math.abs(car.heading) > Math.PI / 180) settled = t;
    },
  );
  return { overshoot, settle: settled >= seconds - DT * 2 ? Infinity : settled, presses };
}

export interface Arc {
  /** RMS distance off the arc after the turn-in, metres. */
  rms: number;
  rate: number;
  /** Peak-to-peak yaw rate after the turn-in, rad/s: how much the car weaves. */
  yaw_swing: number;
}

/** A long right-hander at `radius` metres and `speed` km/h, about half the grip limit at the defaults. */
export function arc(mode: SteerMode, radius = 150, speed = 90, spec = COUPE): Arc {
  const car = rolling(spec, mode, speed);
  let sum = 0;
  let n = 0;
  let lo = Infinity;
  let hi = -Infinity;
  const settle = 3;
  const seconds = 12;
  let presses = 0;
  let last = 0;
  drive(
    car,
    seconds,
    speed,
    (x, z) => radius - Math.hypot(x + radius, z),
    (t, steer) => {
      if (t < settle) return;
      if (steer !== 0 && steer !== last) presses++;
      last = steer;
      const off = Math.hypot(car.pos.x + radius, car.pos.z) - radius;
      sum += off * off;
      n++;
      lo = Math.min(lo, car.ang.y);
      hi = Math.max(hi, car.ang.y);
    },
  );
  return { rms: Math.sqrt(sum / n), rate: presses / (seconds - settle), yaw_swing: hi - lo };
}

export interface Hairpin {
  t180: number;
  /** Worst body slip on the way round, degrees. */
  slip: number;
  /** Mean radius of the turn, metres. */
  radius: number;
}

export function hairpin(mode: SteerMode, spec = COUPE): Hairpin {
  const car = rolling(spec, mode, 50);
  let worst = 0;
  let turned = 0;
  let prev = car.heading;
  for (let t = 0; t < 10; t += DT) {
    car.step(DT, { steer: 1, throttle: throttle(car, 50), brake: 0, handbrake: 0, analog: false }, flat);
    const h = car.heading;
    turned += Math.atan2(Math.sin(prev - h), Math.cos(prev - h));
    prev = h;
    worst = Math.max(worst, Math.abs(slip_deg(car)));
    if (turned >= Math.PI) return { t180: t, slip: worst, radius: Math.hypot(car.pos.x, car.pos.z) / 2 };
  }
  return { t180: Infinity, slip: worst, radius: Infinity };
}

export interface Tap {
  /** Heading change 2 s after the tap, degrees. */
  heading: number;
  /** Sideways step 2 s after the tap, metres. */
  lateral: number;
  /** Peak yaw rate, rad/s. */
  yaw: number;
  /** Worst body slip, degrees: a tap that throws the tail out shows here. */
  slip: number;
}

export function tap(mode: SteerMode, seconds = 0.05, speed = 100, spec = COUPE): Tap {
  const car = rolling(spec, mode, speed);
  let yaw = 0;
  let slip = 0;
  for (let t = 0; t < 2 + seconds; t += DT) {
    car.step(DT, { steer: t < seconds ? 1 : 0, throttle: throttle(car, speed), brake: 0, handbrake: 0, analog: false }, flat);
    yaw = Math.max(yaw, Math.abs(car.ang.y));
    slip = Math.max(slip, Math.abs(slip_deg(car)));
  }
  return { heading: (-car.heading * 180) / Math.PI, lateral: -car.pos.x, yaw, slip };
}

export interface Swerve {
  /** Heading left 1.5 s after the keys are let go, degrees: a symmetric swerve should end pointing straight. */
  heading: number;
  /** Sideways step by then, metres. */
  lateral: number;
}

/** Open-loop lane change on held keys: `hold` seconds right, `hold` seconds left, then let go. */
export function swerve(mode: SteerMode, spec = COUPE, speed = 100, hold = 0.4): Swerve {
  const car = rolling(spec, mode, speed);
  for (let t = 0; t < 2 * hold + 1.5; t += DT) {
    const steer = t < hold ? 1 : t < 2 * hold ? -1 : 0;
    car.step(DT, { steer, throttle: throttle(car, speed), brake: 0, handbrake: 0, analog: false }, flat);
  }
  return { heading: (-car.heading * 180) / Math.PI, lateral: -car.pos.x };
}

export interface Slalom {
  /** Peak yaw rate, rad/s. */
  yaw: number;
  /** Worst body slip, degrees. */
  slip: number;
}

/** Keys alternating every `half` seconds for four seconds. */
export function slalom(mode: SteerMode, spec = COUPE, speed = 100, half = 0.5): Slalom {
  const car = rolling(spec, mode, speed);
  let yaw = 0;
  let slip = 0;
  for (let t = 0; t < 4; t += DT) {
    const steer = Math.floor(t / half) % 2 === 0 ? 1 : -1;
    car.step(DT, { steer, throttle: throttle(car, speed), brake: 0, handbrake: 0, analog: false }, flat);
    yaw = Math.max(yaw, Math.abs(car.ang.y));
    slip = Math.max(slip, Math.abs(slip_deg(car)));
  }
  return { yaw, slip };
}

/** Worst body slip, degrees, over 2 s off the gas with the key still held, after 2.5 s cornering on it. */
export function lift_off(mode: SteerMode, spec = COUPE, speed = 90): number {
  const car = rolling(spec, mode, speed);
  for (let t = 0; t < 2.5; t += DT) car.step(DT, { steer: 1, throttle: throttle(car, speed), brake: 0, handbrake: 0, analog: false }, flat);
  let slip = 0;
  for (let t = 0; t < 2; t += DT) {
    car.step(DT, { steer: 1, throttle: 0, brake: 0, handbrake: 0, analog: false }, flat);
    slip = Math.max(slip, Math.abs(slip_deg(car)));
  }
  return slip;
}

export interface Flick {
  /** Heading change over the flick, degrees. */
  turned: number;
  /** Time after the flick until body slip is under 3 degrees and yaw under 0.1 rad/s, seconds. */
  settle: number;
}

/** Handbrake and full key for `hold` seconds, then a light throttle with the keys let go. */
export function flick(mode: SteerMode, spec = COUPE, speed = 70, hold = 0.45): Flick {
  const car = rolling(spec, mode, speed);
  for (let t = 0; t < hold; t += DT) car.step(DT, { steer: 1, throttle: 0, brake: 0, handbrake: 1, analog: false }, flat);
  const turned = (-car.heading * 180) / Math.PI;
  let settle = Infinity;
  for (let t = 0; t < 5 && settle === Infinity; t += DT) {
    car.step(DT, { steer: 0, throttle: 0.4, brake: 0, handbrake: 0, analog: false }, flat);
    if (Math.abs(slip_deg(car)) < 3 && Math.abs(car.ang.y) < 0.1) settle = t;
  }
  return { turned, settle };
}

/** Time from a standstill with a key held until the wheels reach 99% of full lock, seconds. */
export function park_lock(mode: SteerMode, spec = COUPE): number {
  const car = new Car(spec);
  car.steer_mode = mode;
  car.park(0, 0, 0, flat);
  for (let t = 0; t < 2; t += DT) {
    car.step(DT, { steer: 1, throttle: 0, brake: 0, handbrake: 0, analog: false }, flat);
    if (car.steer >= spec.lock * 0.99) return t;
  }
  return Infinity;
}

function is_mode(arg: string): arg is SteerMode {
  return (Object.values(SteerMode) as string[]).includes(arg);
}

if (import.meta.main) {
  // bun scripts/keys.ts [mode|all] [car|all]: the shipped Smooth mode on the coupe by default.
  const [mode_arg = SteerMode.SMOOTH, car_arg = "coupe"] = process.argv.slice(2);
  const modes = mode_arg === "all" ? Object.values(SteerMode) : is_mode(mode_arg) ? [mode_arg] : [];
  if (modes.length === 0) throw new Error(`unknown steer mode ${mode_arg}`);
  const specs = car_arg === "all" ? Object.values(CARS) : [car_spec(car_arg)];
  const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "never");
  for (const spec of specs)
    for (const mode of modes) {
      const lc = lane_change(mode, spec);
      const a = arc(mode, 150, 90, spec);
      const h = hairpin(mode, spec);
      const sw = swerve(mode, spec);
      const short = tap(mode, 1 / 60, 100, spec);
      const long = tap(mode, 0.15, 100, spec);
      const sl = slalom(mode, spec);
      const fl = flick(mode, spec);
      console.log(`${spec.id} ${mode}`);
      console.log(`  lane change 120: overshoot ${f(lc.overshoot)} m, settle ${f(lc.settle)} s, ${lc.presses} presses`);
      console.log(`  arc R150 90:     rms ${f(a.rms)} m, ${f(a.rate, 1)} presses/s, yaw swing ${f(a.yaw_swing, 3)} rad/s`);
      console.log(`  hairpin 50:      180 deg in ${f(h.t180)} s, radius ${f(h.radius, 1)} m, slip ${f(h.slip, 1)} deg`);
      console.log(`  swerve 100:      0.4 s each way, heading ${f(sw.heading, 1)} deg, lateral ${f(sw.lateral, 1)} m`);
      console.log(`  tap 100:         17 ms ${f(short.heading)} deg yaw ${f(short.yaw, 3)}, 150 ms ${f(long.heading)} deg yaw ${f(long.yaw, 3)} slip ${f(long.slip, 1)} deg, ratio ${f(long.heading / short.heading, 1)}`);
      console.log(`  slalom 100:      0.5 s, yaw ${f(sl.yaw, 3)} rad/s, slip ${f(sl.slip, 1)} deg`);
      console.log(`  lift-off 90:     slip ${f(lift_off(mode, spec), 1)} deg`);
      console.log(`  flick 70:        turned ${f(fl.turned, 0)} deg, straight in ${f(fl.settle)} s`);
      console.log(`  parked:          key to full lock ${f(park_lock(mode, spec))} s`);
    }
}

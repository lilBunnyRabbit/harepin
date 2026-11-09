import { Vector3 } from "three";
import { COUPE, type CarSpec } from "../src/cars";
import { Car, SteerMode, type Controls, type Ground } from "../src/car";

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

export function lane_change(mode: SteerMode, spec = COUPE): LaneChange {
  const car = rolling(spec, mode, 120);
  let overshoot = 0;
  let settled = 0;
  const seconds = 6;
  const presses = drive(
    car,
    seconds,
    120,
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
}

export function tap(mode: SteerMode, seconds = 0.05, speed = 100, spec = COUPE): Tap {
  const car = rolling(spec, mode, speed);
  for (let t = 0; t < 2 + seconds; t += DT) car.step(DT, { steer: t < seconds ? 1 : 0, throttle: throttle(car, speed), brake: 0, handbrake: 0, analog: false }, flat);
  return { heading: (-car.heading * 180) / Math.PI, lateral: -car.pos.x };
}

if (import.meta.main) {
  const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "never");
  for (const mode of Object.values(SteerMode)) {
    const lc = lane_change(mode);
    const a = arc(mode);
    const h = hairpin(mode);
    const short = tap(mode, 1 / 60);
    const long = tap(mode, 0.1);
    console.log(mode);
    console.log(`  lane change 120: overshoot ${f(lc.overshoot)} m, settle ${f(lc.settle)} s, ${lc.presses} presses`);
    console.log(`  arc R150 90:     rms ${f(a.rms)} m, ${f(a.rate, 1)} presses/s, yaw swing ${f(a.yaw_swing, 3)} rad/s`);
    console.log(`  hairpin 50:      180 deg in ${f(h.t180)} s, radius ${f(h.radius, 1)} m, slip ${f(h.slip, 1)} deg`);
    console.log(`  tap 100:         1 frame ${f(short.heading)} deg ${f(short.lateral)} m, 0.1 s ${f(long.heading)} deg ${f(long.lateral)} m`);
  }
}

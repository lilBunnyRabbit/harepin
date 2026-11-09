import { Vector3 } from "three";
import { CARS, car_spec, type CarSpec } from "../src/cars";
import type { Controls, Ground } from "../src/car";

const { Car } = (await import(process.env.DRIFT_CAR ?? "../src/car")) as typeof import("../src/car");
type Car = InstanceType<typeof Car>;

const DT = 1 / 360;
const G = 9.81;
const SECONDS = 6;
const SPIN_AIM = 1.5;
const GRACE = 0.75;
const LOST = (12 * Math.PI) / 180;
const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };

export interface Drift {
  held: number;
  start: number;
  end: number;
  accel: number;
  peak: number;
  spin: number;
  locked: number;
  /** Body slip (deg) when the hold ended: under the target straightened, over it spun. */
  last: number;
}

/**
 * Thrown at `kmh` with the body `angle` degrees off its course and yawing into the turn, then held there at full
 * throttle by a countersteer-only driver: wheels along the front axle's course plus a correction on the angle error.
 */
export function drift(spec: CarSpec, kmh: number, angle: number, aids: boolean, ideal = false): Drift {
  const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
  const car: Car = new Car(spec);
  Object.assign(car, { tcs: aids, assist: aids, auto: true });
  car.park(0, 0, 0, flat);
  for (let t = 0; t < 0.5; t += DT) car.step(DT, idle, flat);
  car.parked = false;
  const target = (angle * Math.PI) / 180;
  const v = kmh / 3.6;
  car.vel.set(v * Math.sin(target), 0, v * Math.cos(target));
  car.ang.set(0, (-0.8 * G) / v, 0);
  const v_long = v * Math.cos(target);
  for (const w of car.wheels) w.omega = (v_long / spec.wheel.radius) * (w.driven ? 1.3 : 1);
  const road_rpm = (gear: number) => ((v_long * 1.3) / spec.wheel.radius) * spec.gears[gear - 1] * spec.final * (60 / (2 * Math.PI));
  car.gear = 1;
  while (car.gear < spec.gears.length && road_rpm(car.gear) > spec.upshift * 0.9) car.gear++;

  const local = new Vector3();
  const inv = car.quat.clone();
  const zf = spec.wheel.mounts[0][2];
  const beta = () => {
    local.copy(car.vel).applyQuaternion(inv.copy(car.quat).invert());
    return Math.atan2(-local.x, local.z);
  };
  let prev = beta();
  let held = 0;
  let accel = 0;
  let peak = -Infinity;
  let spin = 0;
  let locked = 0;
  let steps = 0;
  const window: number[] = [];
  let gas = 1;
  let t = 0;
  for (; t < SECONDS; t += DT) {
    const b = beta();
    const rate = (b - prev) / DT;
    prev = b;
    if (t > GRACE && (Math.abs(Math.abs(b) - target) > LOST || local.z < 1)) break;
    const course = Math.atan2(-(local.x + car.ang.y * zf), local.z);
    const want = course + Math.sign(b) * 1.2 * (Math.abs(b) - target) + 0.12 * rate;
    const lock = spec.lock / (1 + car.vel.length() / 45);
    if (Math.abs(want) > lock) locked++;
    const before = car.vel.length();
    const rear_slip = car.wheels.filter((w) => w.driven && !w.front).reduce((most, w) => Math.max(most, w.slip), 0);
    if (ideal) gas = Math.max(0, Math.min(1, gas + (DT / 0.05) * (spec.peak_slip * SPIN_AIM - rear_slip) * 10));
    car.step(DT, { ...idle, throttle: gas, steer: Math.max(-1, Math.min(1, want / lock)) }, flat);
    if (!Number.isFinite(car.pos.x)) throw new Error(`NaN at t=${t.toFixed(3)}`);
    const a = (car.vel.length() - before) / DT / G;
    window.push(a);
    if (window.length > 36) window.shift();
    if (t > GRACE) {
      held = t;
      accel += a;
      steps++;
      const rears = car.wheels.filter((w) => w.driven && !w.front);
      spin += rears.reduce((sum, w) => sum + w.slip, 0) / Math.max(1, rears.length);
      if (window.length === 36) peak = Math.max(peak, window.reduce((sum, x) => sum + x, 0) / 36);
    }
  }
  const n = Math.max(1, steps);
  return { held, start: kmh, end: car.vel.length() * 3.6, accel: accel / n, peak: steps ? peak : 0, spin: spin / n, locked: locked / Math.max(1, t / DT), last: (Math.abs(beta()) * 180) / Math.PI };
}

export const DRIFT_CARS = ["coupe", "muscle", "kaze", "sturm", "raijin", "rally", "hatch"] as const;

if (import.meta.main) {
  const named = process.argv.slice(2).find((a) => !a.startsWith("-"));
  const ids = named ? [car_spec(named).id] : DRIFT_CARS;
  const aids = process.argv.includes("--aids");
  const ideal = process.argv.includes("--ideal");
  console.log(`${ideal ? `throttle holding rear slip at ${SPIN_AIM}x peak` : "full throttle"}, countersteer driver; TCS and steer assist ${aids ? "on" : "off"}; held = s within 12 deg of target (max ${SECONDS})`);
  console.log("car      km/h  deg  held s  end km/h  accel g  peak g  spin  at lock  last");
  for (const id of ids) {
    const spec = CARS[id as keyof typeof CARS];
    for (const kmh of [60, 90])
      for (const angle of [25, 35, 45]) {
        const r = drift(spec, kmh, angle, aids, ideal);
        const cells = [r.held.toFixed(1).padStart(6), r.end.toFixed(0).padStart(9), r.accel.toFixed(2).padStart(8), r.peak.toFixed(2).padStart(7), r.spin.toFixed(2).padStart(5), `${(r.locked * 100).toFixed(0)}%`.padStart(8), r.last.toFixed(0).padStart(5)];
        console.log(`${id.padEnd(8)} ${String(kmh).padStart(4)} ${String(angle).padStart(4)} ${cells.join(" ")}`);
      }
  }
}

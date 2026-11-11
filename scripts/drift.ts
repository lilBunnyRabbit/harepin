import { Vector3 } from "three";
import { apply_build, parse_build } from "../src/car/build";
import { CARS, car_spec, type CarSpec } from "../src/car/cars";
import { PRESETS } from "../src/car/presets";
import type { Controls, Ground } from "../src/car/car";
import { ground_arg } from "./grounds";

const physics = (await import(process.env.DRIFT_CAR ?? "../src/car/car")) as Partial<typeof import("../src/car/car")> & Pick<typeof import("../src/car/car"), "Car">;
const { Car } = physics;
type Car = InstanceType<typeof Car>;

const DT = 1 / 360;
const G = 9.81;
const SECONDS = 6;
const SPIN_AIM = 1.5;
const GRACE = 0.75;
const LOST = (12 * Math.PI) / 180;
// --ground <name> (scripts/grounds.ts) runs every scenario on that surface instead of flat asphalt.
const flat: Ground = ground_arg({ height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 });

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
  Object.assign(car, { tcs: aids, assist: aids, stability: aids, auto: true });
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
    const speed = car.vel.length();
    const slide = speed > 5 ? Math.atan2(-local.x, Math.abs(local.z)) : 0;
    // A car module from before grip_lock took the speed where it now takes the grip-limited lock.
    const second = physics.grip_lock ? Math.min(spec.lock, physics.grip_lock(spec, speed)) : speed;
    const lock = aids ? spec.lock : (physics.unassisted_lock?.(spec, second, Math.sign(want), slide) ?? spec.lock / (1 + speed / 45));
    if (Math.abs(want) > lock) locked++;
    const before = car.vel.length();
    const rear_slip = car.wheels.filter((w) => w.driven && !w.axle.steer).reduce((most, w) => Math.max(most, w.slip), 0);
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
      const rears = car.wheels.filter((w) => w.driven && !w.axle.steer);
      spin += rears.reduce((sum, w) => sum + w.slip, 0) / Math.max(1, rears.length);
      if (window.length === 36) peak = Math.max(peak, window.reduce((sum, x) => sum + x, 0) / 36);
    }
  }
  const n = Math.max(1, steps);
  return { held, start: kmh, end: car.vel.length() * 3.6, accel: accel / n, peak: steps ? peak : 0, spin: spin / n, locked: locked / Math.max(1, t / DT), last: (Math.abs(beta()) * 180) / Math.PI };
}

export const DRIFT_CARS = ["coupe", "muscle", "kaze", "sturm", "raijin", "rally", "hatch"] as const;

export interface Launch {
  /** Seconds from full lock and full gas until the launch arms; Infinity when it never does. */
  armed: number;
  /** Seconds until the rear axle slips 30 degrees out against the key. */
  t30: number;
  /** Largest rear-axle slip against the key, degrees. */
  peak: number;
  /** km/h after 3 and 6 s of full lock and full gas. */
  kmh3: number;
  kmh6: number;
  /** Mean rear-axle slip against the key from 2 to 6 s, degrees: under about 15 the slide has turned into grip. */
  tail: number;
  /** Seconds from letting go of the key at 3 s, gas still full, until the tail is under 10 degrees for 1 s. */
  caught: number;
}

/**
 * Settled at `kmh` (0 parked), then full lock and full gas held, as the Drift feel test's driver does; rolling, the gas
 * is stabbed off for 0.15 s after 0.2 s, the gesture a rolling kick needs.
 */
export function launch(spec: CarSpec, kmh: number, aids: { tcs: boolean; assist: boolean; stability: boolean }): Launch {
  const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false };
  const rolled = (): Car => {
    const car: Car = new Car(spec);
    Object.assign(car, aids, { steer_mode: "smooth" });
    car.park(0, 0, 0, flat);
    for (let t = 0; t < 0.5; t += DT) car.step(DT, idle, flat);
    for (let t = 0; t < 15 && car.vel.length() * 3.6 < kmh; t += DT) car.step(DT, { ...idle, throttle: 0.6 }, flat);
    if (kmh > 0) for (let t = 0; t < 1; t += DT) car.step(DT, { ...idle, throttle: Math.max(0, Math.min(1, (kmh - car.vel.length() * 3.6) * 0.15 + 0.15)) }, flat);
    return car;
  };
  const local = new Vector3();
  const tail = (car: Car) => {
    local.copy(car.vel).applyQuaternion(car.quat.clone().invert());
    const side = local.x + car.ang.y * car.axles[car.axles.length - 1].z;
    return Math.hypot(side, local.z) < 0.5 ? 0 : (Math.atan2(side, local.z) * 180) / Math.PI;
  };
  const kick = (t: number): Controls => ({ ...idle, steer: 1, throttle: kmh > 0 && t >= 0.2 && t < 0.35 ? 0 : 1 });
  const out: Launch = { armed: Infinity, t30: Infinity, peak: 0, kmh3: 0, kmh6: 0, tail: 0, caught: Infinity };
  let car = rolled();
  let steps = 0;
  for (let t = 0; t < 6; t += DT) {
    car.step(DT, kick(t), flat);
    const d = tail(car);
    if (car.launched && out.armed === Infinity) out.armed = t;
    if (d >= 30 && out.t30 === Infinity) out.t30 = t;
    out.peak = Math.max(out.peak, d);
    if (t < 3) out.kmh3 = car.vel.length() * 3.6;
    if (t >= 2) {
      out.tail += d;
      steps++;
    }
  }
  out.kmh6 = car.vel.length() * 3.6;
  out.tail /= Math.max(1, steps);
  car = rolled();
  for (let t = 0; t < 3; t += DT) car.step(DT, kick(t), flat);
  let calm = -1;
  for (let t = 0; t < 4 && out.caught === Infinity; t += DT) {
    car.step(DT, { ...idle, throttle: 1 }, flat);
    if (Math.abs(tail(car)) >= 10) calm = -1;
    else if (calm < 0) calm = t;
    else if (t - calm >= 1) out.caught = calm;
  }
  return out;
}

function launch_table(ids: readonly string[]) {
  const drift_build = parse_build(PRESETS.find((preset) => preset.name === "Drift")?.code);
  const specs: [string, CarSpec][] = ids.map((id) => [id, car_spec(id)]);
  if (drift_build) specs.unshift(["Drift", apply_build(car_spec(drift_build.car), drift_build)]);
  const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "-");
  console.log("full lock + full gas held 6 s (rolling: gas stabbed off 0.2-0.35 s), Smooth keys, TCS on, stability on; let go of the key at 3 s for the catch");
  console.log("car      assist  km/h  armed   t30  peak  km/h@3  km/h@6  tail  caught");
  for (const [id, spec] of specs)
    for (const assist of [false, true])
      for (const kmh of [0, 10, 20, 30, 40]) {
        const r = launch(spec, kmh, { tcs: true, assist, stability: true });
        const cells = [f(r.armed).padStart(5), f(r.t30).padStart(5), f(r.peak, 0).padStart(5), f(r.kmh3, 1).padStart(7), f(r.kmh6, 1).padStart(7), f(r.tail, 0).padStart(5), f(r.caught).padStart(7)];
        console.log(`${id.padEnd(8)} ${(assist ? "on" : "off").padEnd(6)} ${String(kmh).padStart(5)} ${cells.join(" ")}`);
      }
}

if (import.meta.main) {
  const named = process.argv.slice(2).find((a, i, all) => !a.startsWith("-") && all[i - 1] !== "--ground");
  const ids = named ? [car_spec(named).id] : DRIFT_CARS;
  if (process.argv.includes("--launch")) {
    launch_table(named ? ids : DRIFT_CARS);
    process.exit(0);
  }
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

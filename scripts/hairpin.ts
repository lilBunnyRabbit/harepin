import { Vector3 } from "three";
import { CARS, car_spec, type CarSpec } from "../src/car/cars";
import { Car, type Controls, type Ground } from "../src/car/car";

const DT = 1 / 360;
const START_KMH = 10;
const GRADES = [0, 0.06, 0.12];

// Re-tilted under the car every step to rise along its path, so a full-lock turn climbs the whole way, as up a hairpin.
class Climb implements Ground {
  private x = 0;
  private z = 0;
  private y = 0;
  private dx = 0;
  private dz = 1;
  constructor(private readonly grade: number) {}
  follow(car: Car) {
    this.y = this.height(car.pos.x, car.pos.z);
    this.x = car.pos.x;
    this.z = car.pos.z;
    const flat = Math.hypot(car.vel.x, car.vel.z);
    if (flat > 0.5) {
      this.dx = car.vel.x / flat;
      this.dz = car.vel.z / flat;
    }
  }
  height(x: number, z: number) {
    return this.y + this.grade * ((x - this.x) * this.dx + (z - this.z) * this.dz);
  }
  normal(_x: number, _z: number, out: Vector3) {
    return out.set(-this.grade * this.dx, 1, -this.grade * this.dz).normalize();
  }
  grip() {
    return 1;
  }
  roll() {
    return 1;
  }
}

const rear = new Vector3();

/** Path radius of the rear-axle centre, metres, from its ground speed over the yaw rate. */
export function rear_radius(car: Car): number {
  const b = car.spec.wheel.mounts[2][2];
  rear.set(0, 0, b).applyQuaternion(car.quat);
  const vx = car.vel.x + car.ang.y * rear.z;
  const vz = car.vel.z - car.ang.y * rear.x;
  return Math.hypot(vx, vz) / Math.max(1e-6, Math.abs(car.ang.y));
}

export const Mode = { COAST: "coast", HOLD: "hold", GAS: "gas" } as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

/** Full lock at `kmh` on the flat, TCS on; returns the rear-axle radius after the mode has run and the speed it ended at. */
export function lock_radius(spec: CarSpec, kmh: number, mode: Mode, assist: boolean): { radius: number; kmh: number } {
  const ground = new Climb(0);
  const car = new Car(spec);
  Object.assign(car, { assist, stability: assist });
  car.park(0, 0, 0, ground);
  const v = kmh / 3.6;
  car.vel.set(0, 0, v);
  for (const w of car.wheels) w.omega = v / spec.wheel.radius;
  car.parked = false;
  const cruise = (): Controls => ({ steer: 1, throttle: Math.max(0, Math.min(1, (kmh - car.vel.length() * 3.6) * 0.15 + 0.3)), brake: 0, handbrake: 0, analog: false });
  for (let t = 0; t < 0.4; t += DT) car.step(DT, cruise(), ground);
  const [seconds, controls] = mode === Mode.HOLD ? [3, cruise] : [0.6, (): Controls => ({ ...cruise(), throttle: mode === Mode.GAS ? 1 : 0 })];
  for (let t = 0; t < seconds; t += DT) car.step(DT, controls(), ground);
  return { radius: rear_radius(car), kmh: car.vel.length() * 3.6 };
}

export interface Pull {
  t30: number;
  kmh5: number;
  rows: string[];
}

export function hairpin_pull(spec: CarSpec, grade: number, tcs: boolean, assist: boolean, seconds = 5, log = false): Pull {
  const ground = new Climb(grade);
  const car = new Car(spec);
  Object.assign(car, { tcs, assist, stability: assist });
  car.park(0, 0, 0, ground);
  for (let t = 0; t < 1; t += DT) car.step(DT, { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false }, ground);
  const v = START_KMH / 3.6;
  car.vel.set(0, grade, 1).normalize().multiplyScalar(v);
  for (const w of car.wheels) w.omega = v / spec.wheel.radius;
  car.parked = false;
  const input: Controls = { steer: 1, throttle: 1, brake: 0, handbrake: 0, analog: false };
  const rows: string[] = [];
  let t30 = Infinity;
  let next = 0;
  for (let t = 0; t < seconds; t += DT) {
    ground.follow(car);
    car.step(DT, input, ground);
    if (!Number.isFinite(car.pos.x)) throw new Error(`NaN at t=${t.toFixed(3)}`);
    const kmh = car.vel.length() * 3.6;
    if (kmh >= 30 && t30 === Infinity) t30 = t;
    if (log && t >= next) {
      next += 0.25;
      const driven = car.wheels.filter((w) => w.driven);
      const inner = driven.filter((w) => car.steer > 0 !== w.left);
      const outer = driven.filter((w) => car.steer > 0 === w.left);
      const avg = (ws: typeof driven, f: (w: (typeof driven)[number]) => number) => ws.reduce((s, w) => s + f(w), 0) / ws.length;
      const front = Math.max(...car.wheels.filter((w) => w.axle.steer).map((w) => w.lateral * spec.peak_angle)) * (180 / Math.PI);
      rows.push(
        [
          t.toFixed(2).padStart(5),
          kmh.toFixed(1).padStart(5),
          `g${car.gear}`,
          car.rpm.toFixed(0).padStart(5),
          `tcs ${car.tcs_factor.toFixed(2)}`,
          `slip in ${avg(inner, (w) => w.slip).toFixed(2).padStart(5)} out ${avg(outer, (w) => w.slip).toFixed(2).padStart(5)}`,
          `spin in ${avg(inner, (w) => w.omega * spec.wheel.radius * 3.6).toFixed(0).padStart(3)} out ${avg(outer, (w) => w.omega * spec.wheel.radius * 3.6).toFixed(0).padStart(3)} km/h`,
          `load in ${avg(inner, (w) => w.load).toFixed(0).padStart(5)} out ${avg(outer, (w) => w.load).toFixed(0).padStart(5)}`,
          `front ${front.toFixed(1).padStart(4)}°`,
          `steer ${car.steer.toFixed(2)}`,
          `R ${rear_radius(car).toFixed(1)} m`,
        ].join("  "),
      );
    }
  }
  return { t30, kmh5: car.vel.length() * 3.6, rows };
}

if (import.meta.main) {
  const named = process.argv.slice(2).find((a) => !a.startsWith("-"));
  const ids = named ? [car_spec(named).id] : Object.keys(CARS);
  const verbose = process.argv.includes("-v");
  if (process.argv.includes("--radius")) {
    for (const id of ids) {
      const spec = car_spec(id);
      const geometric = spec.wheelbase / Math.tan(spec.lock);
      for (const assist of [true, false]) {
        const cells = [10, 20, 30].map((kmh) =>
          [Mode.COAST, Mode.HOLD, Mode.GAS].map((mode) => {
            const r = lock_radius(spec, kmh, mode, assist);
            return `${r.radius.toFixed(1)}@${r.kmh.toFixed(0)}`;
          }).join(" / "),
        );
        console.log(`${id.padEnd(7)} geo ${geometric.toFixed(2)} m  assist ${assist ? "on " : "off"}  coast/hold/gas  10: ${cells[0]}  20: ${cells[1]}  30: ${cells[2]}`);
      }
    }
  } else
    for (const id of ids) {
      const spec = car_spec(id);
      for (const grade of GRADES)
        for (const assist of [true, false])
          for (const tcs of [true, false]) {
            const pull = hairpin_pull(spec, grade, tcs, assist, 5, verbose);
            const label = `${id.padEnd(7)} ${(grade * 100).toFixed(0).padStart(2)}%  assist ${assist ? "on " : "off"}  tcs ${tcs ? "on " : "off"}`;
            console.log(`${label}  10-30 ${Number.isFinite(pull.t30) ? `${pull.t30.toFixed(2)} s` : "  never"}  at 5 s ${pull.kmh5.toFixed(1)} km/h`);
            for (const row of pull.rows) console.log(`    ${row}`);
          }
    }
}

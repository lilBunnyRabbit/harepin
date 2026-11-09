import { CARS, car_spec, type CarSpec } from "../src/cars";
import { Car, type Controls, type Ground } from "../src/car";

const DT = 1 / 360;
const START = 5;
const SECONDS = 5;

const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };

export interface Donut {
  /** Smallest steer angle over the last 3 s, as a share of full lock. */
  steer_min: number;
  /** Mean yaw rate over the last 2 s, rad/s, signed with the steer. */
  yaw: number;
  /** Smallest yaw rate over the last 2 s, rad/s, signed with the steer. */
  yaw_min: number;
  kmh: number;
  rows: string[];
}

/** Full keyboard steer and full throttle from `START` m/s on the flat, held for `SECONDS`. */
export function donut(spec: CarSpec, tcs: boolean, assist: boolean, log = false): Donut {
  const car = new Car(spec);
  Object.assign(car, { tcs, assist });
  car.park(0, 0, 0, flat);
  car.vel.set(0, 0, START);
  for (const w of car.wheels) w.omega = START / spec.wheel.radius;
  car.parked = false;
  const input: Controls = { steer: 1, throttle: 1, brake: 0, handbrake: 0, analog: false };
  const rows: string[] = [];
  let steer_min = Infinity;
  let yaw_sum = 0;
  let yaw_min = Infinity;
  let samples = 0;
  let next = 0;
  for (let t = 0; t < SECONDS; t += DT) {
    car.step(DT, input, flat);
    if (!Number.isFinite(car.pos.x)) throw new Error(`NaN at t=${t.toFixed(3)}`);
    const yaw = -car.ang.y;
    if (t >= SECONDS - 3) steer_min = Math.min(steer_min, car.steer / spec.lock);
    if (t >= SECONDS - 2) {
      yaw_sum += yaw;
      yaw_min = Math.min(yaw_min, yaw);
      samples++;
    }
    if (log && t >= next) {
      next += 0.5;
      rows.push(`${t.toFixed(1).padStart(4)}  steer ${(car.steer / spec.lock).toFixed(2)}  yaw ${yaw.toFixed(2).padStart(5)}  ${(car.vel.length() * 3.6).toFixed(0).padStart(3)} km/h  tcs ${car.tcs_factor.toFixed(2)}`);
    }
  }
  return { steer_min, yaw: yaw_sum / samples, yaw_min, kmh: car.vel.length() * 3.6, rows };
}

if (import.meta.main) {
  const named = process.argv.slice(2).find((a) => !a.startsWith("-"));
  const ids = named ? [car_spec(named).id] : Object.keys(CARS);
  const verbose = process.argv.includes("-v");
  for (const id of ids)
    for (const assist of [true, false])
      for (const tcs of [true, false]) {
        const d = donut(car_spec(id), tcs, assist, verbose);
        console.log(
          `${id.padEnd(7)} assist ${assist ? "on " : "off"}  tcs ${tcs ? "on " : "off"}  steer min ${d.steer_min.toFixed(2)}  yaw ${d.yaw.toFixed(2)} (min ${d.yaw_min.toFixed(2)}) rad/s  ${d.kmh.toFixed(0)} km/h`,
        );
        for (const row of d.rows) console.log(`    ${row}`);
      }
}

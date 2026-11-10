import { Vector3 } from "three";
import { CARS, type CarSpec } from "../src/car/cars";
import { Car, type Controls, type Ground } from "../src/car/car";

const DT = 1 / 360;
const G = 9.81;
const WINDOW = 0.5;
const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };

export interface Slide {
  decel: number;
  lateral: number;
  distance: number;
  left: number;
  slip_after: number;
}

/** Thrown at `kmh` with the body `slip` degrees off its course at a fixed `throttle`; the slide ends below 20 degrees. */
export function slide(spec: CarSpec, kmh: number, slip: number, assist: boolean, throttle = 0): Slide {
  const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false };
  const input: Controls = { ...idle, throttle };
  const car = new Car(spec);
  Object.assign(car, { tcs: assist, assist });
  car.park(0, 0, 0, flat);
  for (let t = 0; t < 0.5; t += DT) car.step(DT, idle, flat);
  car.parked = false;
  const v = kmh / 3.6;
  const beta = (slip * Math.PI) / 180;
  car.vel.set(v * Math.sin(beta), 0, v * Math.cos(beta));
  for (const w of car.wheels) w.omega = (v * Math.cos(beta)) / spec.wheel.radius;
  const before = new Vector3();
  const right = new Vector3();
  let distance = 0;
  let lateral = 0;
  let at_window = v;
  let slip_after = 0;
  let t = 0;
  const local = new Vector3();
  const body_slip = () => {
    local.copy(car.vel).applyQuaternion(car.quat.clone().invert());
    return (Math.atan2(local.x, Math.abs(local.z)) * 180) / Math.PI;
  };
  while (car.vel.length() > 1 && Math.abs(body_slip()) > 20 && t < 20) {
    before.copy(car.vel);
    car.step(DT, input, flat);
    distance += car.vel.length() * DT;
    t += DT;
    if (t <= WINDOW) {
      right.set(1, 0, 0).applyQuaternion(car.quat);
      lateral += Math.abs(before.sub(car.vel).dot(right));
    }
    if (Math.abs(t - WINDOW) < DT / 2) {
      at_window = car.vel.length();
      slip_after = body_slip();
    }
  }
  const window = Math.min(t, WINDOW);
  if (t < WINDOW) at_window = car.vel.length();
  return { decel: (v - at_window) / window / G, lateral: lateral / window / G, distance, left: car.vel.length() * 3.6, slip_after };
}

if (import.meta.main) {
  const gas = Number(process.argv[2] ?? 0);
  console.log(`throttle ${gas}; slide ends below 20 degrees body slip or 1 m/s`);
  console.log("car      assist  km/h  slip  decel g  lat g  share  slide m  left km/h  slip@0.5s");
  for (const spec of Object.values(CARS)) {
    const mu = (spec.mu * (1 + spec.rear_grip)) / 2;
    for (const assist of [false, true]) {
      for (const kmh of [60, 100]) {
        for (const slip of [60, 90]) {
          const r = slide(spec, kmh, slip, assist, gas);
          const cells = [r.decel.toFixed(2).padStart(8), r.lateral.toFixed(2).padStart(6), (r.decel / mu).toFixed(2).padStart(6), r.distance.toFixed(1).padStart(8), r.left.toFixed(0).padStart(10), r.slip_after.toFixed(0).padStart(10)];
          console.log(`${spec.id.padEnd(8)} ${(assist ? "on" : "off").padEnd(6)} ${String(kmh).padStart(5)} ${String(slip).padStart(5)} ${cells.join(" ")}`);
        }
      }
    }
  }
}

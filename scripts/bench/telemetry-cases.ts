import { Vector3 } from "three";
import type { CarSpec } from "../../src/car/cars";
import { Car, drop_height, type Controls, type Ground } from "../../src/car/car";
import { FLAT } from "./feel-cases";

const DT = 1 / 360;
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
const SKIDPAD_STEERS = [0.2, 0.35, 0.5, 0.7, 1];

export interface Telemetry {
  /** Settled CG height, metres. */
  cg: number;
  loads: number[];
  launch: { tcs: boolean; t100: number; gear: number }[];
  top: { kmh: number; gear: number; rpm: number };
  /** 100-0 km/h stopping distance, metres. */
  stop: { abs: boolean; m: number }[];
  skidpad: { steer: number; g: number; kmh: number; upright: number }[];
  best_g: number;
  flick: { yaw: number; t: number; upright: number };
}

/** One car through every telemetry run in turn: each run starts from where the last left the car, as the CLI always has. */
export function telemetry(spec: CarSpec, ground: Ground = FLAT): Telemetry {
  const car = new Car(spec);
  const run = (seconds: number, controls: (t: number) => Controls, until?: () => boolean): number => {
    let t = 0;
    while (t < seconds) {
      car.step(DT, controls(t), ground);
      t += DT;
      if (!Number.isFinite(car.pos.x) || !Number.isFinite(car.vel.x)) throw new Error(`NaN at t=${t.toFixed(3)}`);
      if (until?.()) break;
    }
    return t;
  };
  const kmh = () => car.forward_speed * 3.6;
  const upright = () => new Vector3(0, 1, 0).applyQuaternion(car.quat).y;

  car.place(0, drop_height(spec, 0.6), 0, 0);
  run(2, () => idle);
  const cg = car.pos.y;
  const loads = car.wheels.map((w) => w.load);

  const launch: Telemetry["launch"] = [];
  for (const tcs of [true, false]) {
    car.place(0, car.pos.y, 0, 0);
    car.tcs = tcs;
    run(1, () => idle);
    const t100 = run(20, () => ({ ...idle, throttle: 1 }), () => kmh() >= 100);
    launch.push({ tcs, t100, gear: car.gear });
  }
  car.tcs = true;

  run(40, () => ({ ...idle, throttle: 1 }));
  const top = { kmh: kmh(), gear: car.gear, rpm: car.rpm };

  const stop: Telemetry["stop"] = [];
  for (const abs of [true, false]) {
    car.place(0, car.pos.y, 0, 0);
    car.abs = abs;
    run(20, () => ({ ...idle, throttle: 1 }), () => kmh() >= 100);
    const from = car.pos.z;
    run(10, () => ({ ...idle, brake: 1 }), () => kmh() <= 0.5);
    stop.push({ abs, m: car.pos.z - from });
  }
  car.abs = true;

  let best_g = 0;
  const skidpad: Telemetry["skidpad"] = [];
  for (const steer of SKIDPAD_STEERS) {
    car.place(0, car.pos.y, 0, 0);
    car.assist = false;
    const target = 70;
    run(20, () => ({ ...idle, throttle: 1 }), () => kmh() >= target);
    run(8, () => ({ ...idle, steer, throttle: Math.max(0, Math.min(1, (target - kmh()) * 0.2 + 0.25)) }));
    const g = Math.abs(car.ang.y * car.vel.length()) / 9.81;
    best_g = Math.max(best_g, g);
    skidpad.push({ steer, g, kmh: kmh(), upright: upright() });
  }

  car.place(0, car.pos.y, 0, 0);
  car.assist = true;
  run(20, () => ({ ...idle, throttle: 1 }), () => kmh() >= 90);
  run(1.5, () => ({ ...idle, steer: 1, throttle: 1, handbrake: 0.4 }));
  const t = run(6, (s) => ({ ...idle, throttle: 0.5, steer: s < 3 ? -0.3 : 0 }), () => Math.abs(car.ang.y) < 0.05 && kmh() > 10);
  return { cg, loads, launch, top, stop, skidpad, best_g, flick: { yaw: car.ang.y, t, upright: upright() } };
}

import { Vector3 } from "three";
import { CARS, car_spec, type CarSpec } from "../src/car/cars";
import { Car, drop_height, type Controls, type Ground } from "../src/car/car";

const DT = 1 / 360;
const surface = (grip: number, roll: number): Ground => ({ height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => grip, roll: () => roll });
const ROAD = surface(1, 1);
const GRASS = surface(0.72, 12);
const pad: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
const keys: Controls = { ...pad, analog: false };
const tmp = new Vector3();

function fresh(spec: CarSpec, setup?: (car: Car) => void): Car {
  const car = new Car(spec);
  setup?.(car);
  car.place(0, drop_height(spec, 0.6), 0, 0);
  run(car, 1.5, () => pad);
  return car;
}

function run(car: Car, seconds: number, controls: (t: number) => Controls, ground = ROAD, each?: (t: number) => boolean | void): number {
  let t = 0;
  while (t < seconds) {
    car.step(DT, controls(t), ground);
    t += DT;
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
    if (each?.(t)) break;
  }
  return t;
}

const kmh = (car: Car) => car.forward_speed * 3.6;
const slip = (car: Car) => {
  const local = tmp.copy(car.vel).applyQuaternion(car.quat.clone().invert());
  return car.vel.length() > 2 ? (Math.atan2(-local.x, local.z) * 180) / Math.PI : 0;
};
const roll = (car: Car) => (Math.asin(tmp.set(1, 0, 0).applyQuaternion(car.quat).y) * 180) / Math.PI;
const pitch = (car: Car) => (Math.asin(tmp.set(0, 0, 1).applyQuaternion(car.quat).y) * 180) / Math.PI;
const cruise = (car: Car, target: number, extra: Partial<Controls> = {}, base = keys): Controls => ({ ...base, ...extra, throttle: Math.max(0, Math.min(1, (target - kmh(car)) * 0.15 + 0.3)) });

export interface Bench {
  t100: number;
  top: number;
  stop: number;
  dive: number;
  skidpad: number;
  turn_in: number;
  body_roll: number;
  lift: number;
  power: number;
  flick: number;
  hold: number;
  grass_speed: number;
  grass_g: number;
}

// Averaged over driver gains, so hold time scores how forgiving a slide is, not how one driver suits one car.
function slide_hold(spec: CarSpec, gain: number, gas: number): number {
  const car = fresh(spec, (c) => {
    c.tcs = false;
    c.assist = false;
  });
  run(car, 30, () => cruise(car, 60, {}, pad));
  run(car, 2, (t) => ({ ...pad, steer: -1, throttle: 1, handbrake: t < 0.3 ? 1 : 0 }), ROAD, () => Math.abs(slip(car)) >= 17);
  let hold = 0;
  run(car, 6, () => {
    const beta = (slip(car) * Math.PI) / 180;
    const err = Math.abs(beta) - (25 * Math.PI) / 180;
    const lock = car.spec.lock / (1 + car.vel.length() / 45);
    return { ...pad, steer: Math.max(-1, Math.min(1, (beta * gain + Math.sign(beta) * err) / lock)), throttle: Math.max(0, Math.min(1, gas - err)) };
  }, ROAD, () => {
    const s = Math.abs(slip(car));
    if (s >= 15 && s <= 45) hold += DT;
    return s > 100;
  });
  return hold;
}

export function bench(spec: CarSpec): Bench {
  let car = fresh(spec);
  let t100 = run(car, 20, () => ({ ...pad, throttle: 1 }), ROAD, () => kmh(car) >= 100);
  run(car, 60, () => ({ ...pad, throttle: 1 }));
  const top = kmh(car);

  car = fresh(spec);
  run(car, 20, () => ({ ...pad, throttle: 1 }), ROAD, () => kmh(car) >= 100);
  const from = car.pos.z;
  let dive = 0;
  run(car, 10, () => ({ ...pad, brake: 1 }), ROAD, () => {
    dive = Math.max(dive, -pitch(car));
    return kmh(car) <= 0.5;
  });
  const stop = car.pos.z - from;

  let skidpad = 0;
  for (const steer of [0.2, 0.35, 0.5, 0.7, 1]) {
    car = fresh(spec, (c) => (c.assist = false));
    run(car, 20, () => ({ ...pad, throttle: 1 }), ROAD, () => kmh(car) >= 70);
    run(car, 8, () => ({ ...pad, steer, throttle: Math.max(0, Math.min(1, (70 - kmh(car)) * 0.2 + 0.25)) }));
    skidpad = Math.max(skidpad, Math.abs(car.ang.y * car.vel.length()) / 9.81);
  }

  car = fresh(spec);
  run(car, 30, () => cruise(car, 100));
  const yaw: number[] = [];
  let body_roll = 0;
  run(car, 3, () => cruise(car, 100, { steer: 1 }, pad), ROAD, () => {
    yaw.push(Math.abs(car.ang.y));
    body_roll = Math.max(body_roll, Math.abs(roll(car)));
  });
  const turn_in = yaw.findIndex((v) => v >= 0.2) * DT;

  car = fresh(spec);
  run(car, 30, () => cruise(car, 90));
  run(car, 2.5, () => cruise(car, 90, { steer: 0.8 }));
  let lift = 0;
  run(car, 2, () => ({ ...keys, steer: 0.8 }), ROAD, () => void (lift = Math.max(lift, Math.abs(slip(car)))));

  car = fresh(spec, (c) => {
    c.tcs = false;
    c.auto = false;
  });
  car.gear = 2;
  run(car, 30, () => cruise(car, 55));
  run(car, 1.5, () => cruise(car, 55, { steer: 0.7 }));
  let power = 0;
  run(car, 2, () => ({ ...keys, throttle: 1, steer: 0.7 }), ROAD, () => void (power = Math.max(power, Math.abs(slip(car)))));

  car = fresh(spec);
  run(car, 30, () => cruise(car, 70));
  let flick = 0;
  run(car, 1.5, (t) => ({ ...keys, steer: t < 0.45 ? -1 : 0, handbrake: t < 0.45 ? 1 : 0, throttle: t < 0.45 ? 0 : 0.4 }), ROAD, () => void (flick = Math.max(flick, Math.abs(slip(car)))));

  let hold = 0;
  for (const gain of [0.6, 0.8, 1]) for (const gas of [0.5, 0.7, 0.9]) hold += slide_hold(spec, gain, gas) / 9;

  car = fresh(spec);
  run(car, 12, () => ({ ...pad, throttle: 1 }), GRASS);
  const grass_speed = kmh(car);

  let grass_g = 0;
  for (const steer of [0.2, 0.35, 0.5, 0.7, 1]) {
    car = fresh(spec, (c) => (c.assist = false));
    run(car, 20, () => ({ ...pad, throttle: 1 }), GRASS, () => kmh(car) >= 50);
    run(car, 8, () => ({ ...pad, steer, throttle: Math.max(0, Math.min(1, (50 - kmh(car)) * 0.2 + 0.25)) }), GRASS);
    grass_g = Math.max(grass_g, Math.abs(car.ang.y * car.vel.length()) / 9.81);
  }

  return { t100, top, stop, dive, skidpad, turn_in, body_roll, lift, power, flick, hold, grass_speed, grass_g };
}

if (import.meta.main) {
  const ids = process.argv[2] ? [process.argv[2]] : Object.keys(CARS);
  console.log("| car | 0-100 s | top km/h | 100-0 m | dive ° | skidpad g | turn-in ms | roll ° | lift-off ° | power-on ° | flick slip ° | slide hold s | grass km/h @12 s | grass g |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const id of ids) {
    const b = bench(car_spec(id));
    const cells = [b.t100.toFixed(2), b.top.toFixed(0), b.stop.toFixed(1), b.dive.toFixed(1), b.skidpad.toFixed(2), (b.turn_in * 1000).toFixed(0), b.body_roll.toFixed(1), b.lift.toFixed(1), b.power.toFixed(1), b.flick.toFixed(0), b.hold.toFixed(1), b.grass_speed.toFixed(0), b.grass_g.toFixed(2)];
    console.log(`| ${id} | ${cells.join(" | ")} |`);
  }
}

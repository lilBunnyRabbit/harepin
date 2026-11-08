import { Vector3 } from "three";
import { Car, type Controls, type Ground } from "../src/car";

const flat: Ground = {
  height: () => 0,
  normal: (_x, _z, out) => out.set(0, 1, 0),
  grip: () => 1,
  roll: () => 1,
};

const DT = 1 / 360;
const car = new Car();
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };

function run(seconds: number, controls: (t: number) => Controls, until?: () => boolean): number {
  let t = 0;
  while (t < seconds) {
    car.step(DT, controls(t), flat);
    t += DT;
    if (!Number.isFinite(car.pos.x) || !Number.isFinite(car.vel.x)) throw new Error(`NaN at t=${t.toFixed(3)}`);
    if (until?.()) break;
  }
  return t;
}

const kmh = () => car.forward_speed * 3.6;
const upright = () => new Vector3(0, 1, 0).applyQuaternion(car.quat).y;

car.place(0, 0.6, 0, 0);
run(2, () => idle);
console.log(`settled: CG height ${car.pos.y.toFixed(3)} m, loads ${car.wheels.map((w) => w.load.toFixed(0)).join(" / ")} N`);

for (const tcs of [true, false]) {
  car.place(0, car.pos.y, 0, 0);
  car.tcs = tcs;
  run(1, () => idle);
  const t100 = run(20, () => ({ ...idle, throttle: 1 }), () => kmh() >= 100);
  console.log(`0-100 km/h (TCS ${tcs ? "on" : "off"}): ${t100.toFixed(2)} s, gear ${car.gear}`);
}
car.tcs = true;

run(40, () => ({ ...idle, throttle: 1 }));
console.log(`top speed after 40 s more: ${kmh().toFixed(0)} km/h, gear ${car.gear}, rpm ${car.rpm.toFixed(0)}`);

for (const abs of [true, false]) {
  car.place(0, car.pos.y, 0, 0);
  car.abs = abs;
  run(20, () => ({ ...idle, throttle: 1 }), () => kmh() >= 100);
  const from = car.pos.z;
  run(10, () => ({ ...idle, brake: 1 }), () => kmh() <= 0.5);
  console.log(`100-0 km/h braking (ABS ${abs ? "on" : "off"}): ${(car.pos.z - from).toFixed(1)} m`);
}
car.abs = true;

let best = 0;
for (const steer of [0.2, 0.35, 0.5, 0.7, 1]) {
  car.place(0, car.pos.y, 0, 0);
  car.assist = false;
  let target = 70;
  run(20, () => ({ ...idle, throttle: 1 }), () => kmh() >= target);
  run(8, () => ({ ...idle, steer, throttle: Math.max(0, Math.min(1, (target - kmh()) * 0.2 + 0.25)) }));
  const lateral = Math.abs(car.ang.y * car.vel.length()) / 9.81;
  best = Math.max(best, lateral);
  console.log(`skidpad 70 km/h steer ${steer}: ${lateral.toFixed(2)} g, speed ${kmh().toFixed(0)} km/h, upright ${upright().toFixed(3)}`);
  target = 70;
}
console.log(`max steady lateral: ${best.toFixed(2)} g`);

car.place(0, car.pos.y, 0, 0);
car.assist = true;
run(20, () => ({ ...idle, throttle: 1 }), () => kmh() >= 90);
run(1.5, () => ({ ...idle, steer: 1, throttle: 1, handbrake: 0.4 }));
const drift = run(6, (t) => ({ ...idle, throttle: 0.5, steer: t < 3 ? -0.3 : 0 }), () => Math.abs(car.ang.y) < 0.05 && kmh() > 10);
console.log(`handbrake flick then recover (assist): yaw rate ${car.ang.y.toFixed(2)} rad/s after ${drift.toFixed(2)} s, upright ${upright().toFixed(3)}`);

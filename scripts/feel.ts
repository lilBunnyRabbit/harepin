import { Vector3 } from "three";
import { car_spec } from "../src/cars";
import { Car, type Controls, type Ground } from "../src/car";

const SPEC = car_spec(process.argv[2] ?? "coupe");

const flat: Ground = { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => 1, roll: () => 1 };
const slope = (grade: number): Ground => ({
  height: (_x, z) => z * grade,
  normal: (_x, _z, out) => out.set(0, 1, -grade).normalize(),
  grip: () => 1,
  roll: () => 1,
});

const DT = 1 / 360;
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: false };
const tmp = new Vector3();

function fresh(ground = flat, setup?: (car: Car) => void): Car {
  const car = new Car(SPEC);
  setup?.(car);
  car.place(0, ground.height(0, 0) + 0.6, 0, 0);
  run(car, 1.5, () => idle, ground);
  return car;
}

function run(car: Car, seconds: number, controls: (t: number) => Controls, ground = flat, each?: (t: number) => void): number {
  let t = 0;
  while (t < seconds) {
    car.step(DT, controls(t), ground);
    t += DT;
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
    each?.(t);
  }
  return t;
}

const kmh = (car: Car) => car.forward_speed * 3.6;
const slip_angle = (car: Car) => {
  const local = tmp.copy(car.vel).applyQuaternion(car.quat.clone().invert());
  return car.vel.length() > 2 ? (Math.atan2(-local.x, local.z) * 180) / Math.PI : 0;
};
const upright = (car: Car) => tmp.set(0, 1, 0).applyQuaternion(car.quat).y;

function cruise(car: Car, target: number, extra: Partial<Controls> = {}): Controls {
  return { ...idle, ...extra, throttle: Math.max(0, Math.min(1, (target - kmh(car)) * 0.15 + 0.3)) };
}

function get_to(car: Car, target: number) {
  run(car, 30, () => cruise(car, target));
}

const report: Record<string, string> = {};
const note = (key: string, value: string) => {
  report[key] = value;
  console.log(`${key.padEnd(34)} ${value}`);
};

{
  const car = fresh();
  get_to(car, 100);
  let peak = 0;
  let t90 = -1;
  const samples: number[] = [];
  run(car, 3, () => cruise(car, 100, { steer: 1 }), flat, (t) => {
    samples.push(car.ang.y);
    peak = Math.max(peak, Math.abs(car.ang.y));
  });
  const steady = Math.abs(samples[samples.length - 1]);
  samples.some((v, i) => (Math.abs(v) >= 0.9 * steady ? ((t90 = i * DT), true) : false));
  const lateral = (steady * car.vel.length()) / 9.81;
  note("step steer 100 km/h (keys)", `yaw 90% in ${t90.toFixed(2)} s, overshoot ${((peak / steady - 1) * 100).toFixed(0)}%, ${lateral.toFixed(2)} g, slip ${slip_angle(car).toFixed(1)}°, speed ${kmh(car).toFixed(0)}`);
}

{
  const car = fresh();
  get_to(car, 160);
  let worst = 0;
  run(car, 4, (t) => cruise(car, 160, { steer: t < 0.25 ? 1 : t < 0.5 ? -1 : 0 }), flat, () => (worst = Math.max(worst, Math.abs(slip_angle(car)))));
  note("lane change 160 km/h", `max slip ${worst.toFixed(1)}°, yaw after 3.5 s ${car.ang.y.toFixed(3)} rad/s, upright ${upright(car).toFixed(3)}`);
}

for (const assist of [true, false]) {
  const car = fresh(flat, (c) => (c.assist = assist));
  get_to(car, 90);
  run(car, 2.5, () => cruise(car, 90, { steer: 0.8 }));
  let worst = 0;
  run(car, 2, () => ({ ...idle, steer: 0.8 }), flat, () => (worst = Math.max(worst, Math.abs(slip_angle(car)))));
  note(`lift-off mid corner (assist ${assist ? "on" : "off"})`, `max slip ${worst.toFixed(1)}°, spun ${worst > 60}`);
}

for (const tcs of [true, false]) {
  const car = fresh(flat, (c) => {
    c.tcs = tcs;
    c.auto = false;
  });
  car.gear = 2;
  get_to(car, 55);
  run(car, 1.5, () => cruise(car, 55, { steer: 0.7 }));
  let worst = 0;
  run(car, 2, () => ({ ...idle, throttle: 1, steer: 0.7 }), flat, () => (worst = Math.max(worst, Math.abs(slip_angle(car)))));
  note(`power on mid corner 2nd (TCS ${tcs ? "on" : "off"})`, `max slip ${worst.toFixed(1)}°, rear slip ${car.wheels[2].slip.toFixed(2)}`);
}

{
  const car = fresh();
  get_to(car, 70);
  const h0 = car.heading;
  run(car, 0.45, () => ({ ...idle, steer: -1, handbrake: 1 }));
  const turned = (((car.heading - h0) * 180) / Math.PI + 540) % 360 - 180;
  let settle = -1;
  run(car, 5, () => ({ ...idle, throttle: 0.4 }), flat, (t) => {
    if (settle < 0 && Math.abs(slip_angle(car)) < 3 && Math.abs(car.ang.y) < 0.1) settle = t;
  });
  note("handbrake flick 70 km/h, 0.45 s", `turned ${turned.toFixed(0)}°, straightens in ${settle.toFixed(2)} s, upright ${upright(car).toFixed(3)}`);
}

{
  const car = fresh();
  get_to(car, 220);
  car.ang.y = 0.3;
  let t_settle = -1;
  run(car, 3, () => cruise(car, 220), flat, (t) => {
    if (t_settle < 0 && Math.abs(car.ang.y) < 0.02) t_settle = t;
  });
  note("yaw kick at 220 km/h", `settles in ${t_settle.toFixed(2)} s, slip now ${slip_angle(car).toFixed(2)}°`);
}

{
  const car = fresh();
  get_to(car, 120);
  let worst = 0;
  run(car, 4, () => ({ ...idle, brake: 1, steer: 0.4 }), flat, () => (worst = Math.max(worst, Math.abs(slip_angle(car)))));
  note("trail brake 120 km/h + steer", `max slip ${worst.toFixed(1)}°, stopped ${kmh(car).toFixed(1)}`);
}

{
  const ground = slope(0.2);
  const car = fresh(ground);
  const z0 = car.pos.z;
  run(car, 5, () => idle, ground);
  note("parked on 20% slope, 5 s", `crept ${(car.pos.z - z0).toFixed(2)} m`);
  run(car, 6, () => ({ ...idle, throttle: 1 }), ground);
  note("hill start 20%", `${kmh(car).toFixed(0)} km/h after 6 s`);
}

{
  const car = fresh();
  run(car, 4, () => ({ ...idle, throttle: 1, steer: 1 }));
  note("full lock + throttle from 0", `${kmh(car).toFixed(0)} km/h, yaw ${car.ang.y.toFixed(2)}, upright ${upright(car).toFixed(3)}`);
}

{
  const car = fresh();
  let jitter = 0;
  let prev = car.pos.y;
  run(car, 3, () => idle, flat, () => {
    jitter = Math.max(jitter, Math.abs(car.pos.y - prev));
    prev = car.pos.y;
  });
  note("rest jitter", `max dy/step ${(jitter * 1000).toFixed(4)} mm, speed ${car.vel.length().toFixed(4)}`);
}

{
  const car = fresh();
  const target = 2;
  const creep = (): Controls => ({ ...idle, steer: 1, throttle: Math.max(0, Math.min(1, 0.08 + (target - kmh(car)) * 0.3)) });
  run(car, 8, creep);
  const axle = new Vector3();
  const points: [number, number][] = [];
  const speeds: number[] = [];
  let slip = 0;
  run(car, 20, creep, flat, () => {
    axle.set(0, 0, car.spec.wheel.mounts[2][2]).applyQuaternion(car.quat).add(car.pos);
    points.push([axle.x, axle.z]);
    speeds.push(kmh(car));
    const local = tmp.copy(car.ang).cross(axle.sub(car.pos)).add(car.vel).applyQuaternion(car.quat.clone().invert());
    slip = Math.max(slip, Math.abs(local.x));
  });
  const n = points.length;
  const cx0 = points.reduce((s, p) => s + p[0], 0) / n;
  const cz0 = points.reduce((s, p) => s + p[1], 0) / n;
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const [x, z] of points) {
    const u = x - cx0, v = z - cz0;
    suu += u * u; svv += v * v; suv += u * v;
    suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  const uc = ((suuu + suvv) / 2 * svv - (svvv + svuu) / 2 * suv) / det;
  const vc = ((svvv + svuu) / 2 * suu - (suuu + suvv) / 2 * suv) / det;
  const radii = points.map(([x, z]) => Math.hypot(x - cx0 - uc, z - cz0 - vc));
  const radius = radii.reduce((s, r) => s + r, 0) / n;
  const spread = Math.sqrt(radii.reduce((s, r) => s + (r - radius) ** 2, 0) / n);
  const mean = speeds.reduce((s, v) => s + v, 0) / n;
  const jitter = Math.sqrt(speeds.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const kinematic = car.spec.wheelbase / Math.tan(car.spec.lock);
  note("full lock 2 km/h, rear axle", `radius ${radius.toFixed(2)} m (kinematic ${kinematic.toFixed(2)}, ${((radius / kinematic - 1) * 100).toFixed(1)}%), ±${(spread * 100).toFixed(1)} cm, speed ${mean.toFixed(2)} ±${jitter.toFixed(2)} km/h, rear creep ${(slip * 100).toFixed(1)} cm/s`);
}

{
  const car = fresh(flat, (c) => (c.tcs = false));
  let shifts = 0;
  let gear = car.gear;
  let t100 = -1;
  run(car, 12, () => ({ ...idle, throttle: 1 }), flat, (t) => {
    if (t100 < 0 && kmh(car) >= 100) t100 = t;
    if (t100 >= 0) return;
    if (car.gear !== gear) shifts++;
    gear = car.gear;
  });
  note("launch TCS off, gear hunting", `0-100 in ${t100.toFixed(2)} s, ${shifts} shifts`);
}

{
  const car = fresh();
  get_to(car, 100);
  let peak = 0;
  run(car, 1, (t) => cruise(car, 100, { steer: t < 0.15 ? 1 : 0 }), flat, () => (peak = Math.max(peak, Math.abs(car.ang.y))));
  note("150 ms key tap at 100 km/h", `peak yaw ${peak.toFixed(3)} rad/s`);
}

import { Vector3 } from "three";
import { DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, build_spec } from "../src/car/build";
import { car_spec, type CarId } from "../src/car/cars";
import { Car, drop_height, type Controls, type Ground } from "../src/car/car";
import { GROUNDS, type GroundName } from "./grounds";

// bun scripts/surfaces.ts [car]: every tyre part on every ground row, flat ground, steering assist off for the corners.
const CAR = car_spec(process.argv[2] ?? "coupe").id as CarId;
const DT = 1 / 360;
const SHOWN: GroundName[] = ["asphalt", "hardpack", "dirt", "grass", "sand", "packed_snow", "ice"];
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
const KICK = 1.5;
const local = new Vector3();

interface Row {
  t50: number;
  stop: number;
  /** Most steady lateral g over a steer sweep at 50 km/h. */
  lateral: number;
  /** Front tyre slip angle (deg) at that most lateral g: where the tyre curve peaks in practice. */
  slip: number;
  /** Worst body slip (deg) after a KICK rad/s yaw kick at 80 km/h, keys and gas off, steering assist on and stability off: past 90 the car went round. */
  kick: number;
  /** Seconds after the kick until body slip is under 3 degrees and yaw under 0.1 rad/s. */
  caught: number;
}

function measure(tyres: number, ground: Ground): Row {
  const spec = build_spec({ ...DEFAULT_BUILD, car: CAR, parts: { ...DEFAULT_PARTS, tyres } });
  const car = new Car(spec);
  const kmh = () => car.forward_speed * 3.6;
  const run = (seconds: number, controls: Controls | ((t: number) => Controls), until?: (t: number) => boolean) => {
    let t = 0;
    while (t < seconds) {
      car.step(DT, typeof controls === "function" ? controls(t) : controls, ground);
      t += DT;
      if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
      if (until?.(t)) break;
    }
    return t;
  };
  const body_slip = () => {
    local.copy(car.vel).applyQuaternion(car.quat.clone().invert());
    return car.vel.length() > 1 ? Math.abs((Math.atan2(local.x, local.z) * 180) / Math.PI) : 0;
  };
  car.place(0, drop_height(spec, 0.6), 0, 0);
  run(2, idle);
  const t50 = run(20, { ...idle, throttle: 1 }, () => kmh() >= 50);
  const reached = kmh() >= 50;
  car.place(0, car.pos.y, 0, 0);
  run(20, { ...idle, throttle: 1 }, () => kmh() >= 50);
  const from = car.pos.z;
  run(10, { ...idle, brake: 1 }, () => kmh() <= 0.5);
  const stop = car.pos.z - from;

  car.assist = false;
  car.stability = false;
  let lateral = 0;
  let slip = 0;
  const zf = spec.wheel.mounts[0][2];
  for (const steer of [0.15, 0.2, 0.25, 0.3, 0.35, 0.45, 0.55, 0.7, 0.85, 1]) {
    car.place(0, car.pos.y, 0, 0);
    run(20, { ...idle, throttle: 1 }, () => kmh() >= 50);
    run(6, () => ({ ...idle, steer, throttle: Math.max(0, Math.min(1, (50 - kmh()) * 0.2 + 0.25)) }));
    const g = Math.abs(car.ang.y * car.vel.length()) / 9.81;
    if (g > lateral) {
      lateral = g;
      local.copy(car.vel).applyQuaternion(car.quat.clone().invert());
      const course = Math.atan2(-(local.x + car.ang.y * zf), local.z);
      slip = (Math.abs(car.steer - course) * 180) / Math.PI;
    }
  }

  car.assist = true;
  car.place(0, car.pos.y, 0, 0);
  run(20, { ...idle, throttle: 1 }, () => kmh() >= 80);
  car.ang.y = KICK;
  let kick = 0;
  let caught = Infinity;
  run(5, { ...idle, analog: false }, (t) => {
    const s = body_slip();
    kick = Math.max(kick, s);
    if (s < 3 && Math.abs(car.ang.y) < 0.1) caught = t;
    return caught < Infinity;
  });
  return { t50: reached ? t50 : Infinity, stop, lateral, slip, kick, caught };
}

const f = (n: number, d: number, w: number) => (Number.isFinite(n) ? n.toFixed(d) : "n/a").padStart(w);
console.log(`${CAR}, flat ground`);
console.log("ground     tyres        0-50 s  50-0 m  lateral g  slip at peak °  kick 80 °  caught s");
for (const name of SHOWN) {
  const ground = GROUNDS[name];
  SLOTS.tyres.parts.forEach((part, i) => {
    const r = measure(i, ground);
    console.log(`${name.padEnd(10)} ${part.name.padEnd(12)} ${f(r.t50, 2, 6)} ${f(r.stop, 1, 7)} ${f(r.lateral, 2, 10)} ${f(r.slip, 1, 15)} ${f(r.kick, 0, 10)} ${f(r.caught, 2, 9)}`);
  });
}

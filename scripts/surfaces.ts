import { DEFAULT_BUILD, DEFAULT_PARTS, SLOTS, build_spec } from "../src/car/build";
import { car_spec, type CarId } from "../src/car/cars";
import { Car, drop_height, type Controls, type Ground } from "../src/car/car";
import { World, SIZE } from "../src/world/world";

const CAR = car_spec(process.argv[2] ?? "coupe").id as CarId;
const DT = 1 / 360;
const idle: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true };
const world = new World();

function find(test: (x: number, z: number) => boolean): [number, number] {
  for (let z = -SIZE / 2 + 50; z < SIZE / 2 - 50; z += 7)
    for (let x = -SIZE / 2 + 50; x < SIZE / 2 - 50; x += 7) if (test(x, z)) return [x, z];
  throw new Error("surface not found");
}

const road = world.road[0];
const SURFACES: [string, number, number][] = [
  ["asphalt", road.x, road.z],
  ["dirt", ...find((x, z) => world.dirt(x, z) && world.distance_to_road(x, z) > 20)],
  ["grass", ...find((x, z) => world.roll(x, z) > 1)],
];

function flat(x: number, z: number): Ground {
  const grip = world.grip(x, z);
  const roll = world.roll(x, z);
  const dirt = world.dirt(x, z);
  return { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => grip, roll: () => roll, dirt: () => dirt };
}

function measure(tyres: number, ground: Ground): string {
  const spec = build_spec({ ...DEFAULT_BUILD, car: CAR, parts: { ...DEFAULT_PARTS, tyres } });
  const car = new Car(spec);
  const kmh = () => car.forward_speed * 3.6;
  const run = (seconds: number, controls: Controls | ((t: number) => Controls), until?: () => boolean) => {
    let t = 0;
    while (t < seconds) {
      car.step(DT, typeof controls === "function" ? controls(t) : controls, ground);
      t += DT;
      if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
      if (until?.()) break;
    }
    return t;
  };
  car.place(0, drop_height(spec, 0.6), 0, 0);
  run(2, idle);
  const t50 = run(20, { ...idle, throttle: 1 }, () => kmh() >= 50);
  const top = kmh() >= 50;
  run(20, { ...idle, throttle: 1 }, () => kmh() >= 60);
  car.place(0, car.pos.y, 0, 0);
  run(20, { ...idle, throttle: 1 }, () => kmh() >= 50);
  const from = car.pos.z;
  run(10, { ...idle, brake: 1 }, () => kmh() <= 0.5);
  const stop = car.pos.z - from;
  car.assist = false;
  let best = 0;
  for (const steer of [0.2, 0.35, 0.5, 0.7, 1]) {
    car.place(0, car.pos.y, 0, 0);
    run(20, { ...idle, throttle: 1 }, () => kmh() >= 50);
    run(6, () => ({ ...idle, steer, throttle: Math.max(0, Math.min(1, (50 - kmh()) * 0.2 + 0.25)) }));
    best = Math.max(best, Math.abs(car.ang.y * car.vel.length()) / 9.81);
  }
  return `0-50 ${top ? t50.toFixed(2) + " s" : "  n/a "}  50-0 ${stop.toFixed(1).padStart(5)} m  lateral ${best.toFixed(2)} g`;
}

console.log(`${CAR}, flat ground`);
for (const [name, x, z] of SURFACES) {
  const ground = flat(x, z);
  console.log(`${name} (grip ${ground.grip(0, 0)}, roll ${ground.roll(0, 0)})`);
  SLOTS.tyres.parts.forEach((part, i) => console.log(`  ${part.name.padEnd(12)} ${measure(i, ground)}`));
}

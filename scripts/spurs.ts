import { Vector3 } from "three";
import { Car } from "../src/car";
import { car_spec } from "../src/cars";
import { seed_of } from "../src/rng";
import { World } from "../src/world";
import type { RoadPoint } from "../src/worldgen/types";

const DT = 1 / 360;
const SEEDS = [...Array(Number(process.argv[2] ?? 20)).keys(), seed_of("lobby")];
const SPEC = car_spec(process.argv[3] ?? "coupe");
const LIMIT = 200;

interface Drive {
  done: boolean;
  t: number;
  offroad: number;
  worst: number;
  flipped: boolean;
}

function drive(world: World, points: RoadPoint[]): Drive {
  const car = new Car(SPEC);
  const p = points[1];
  car.place(p.x, world.height(p.x, p.z) + 0.75, p.z, Math.atan2(p.tx, p.tz));
  const last = points.length - 1;
  let t = 0, index = 1, offroad = 0, worst = 0;
  while (t < LIMIT && index < last - 3) {
    for (let k = index; k < Math.min(last, index + 40); k++) {
      const q = points[k];
      if ((q.x - car.pos.x) ** 2 + (q.z - car.pos.z) ** 2 < 64) index = Math.max(index, k);
    }
    const speed = car.vel.length();
    const ahead = points[Math.min(last, index + 4 + Math.floor(speed / 4))];
    const want = Math.atan2(ahead.x - car.pos.x, ahead.z - car.pos.z);
    const err = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading));
    const far = points[Math.min(last, index + 20)];
    const here = points[index];
    const curve = Math.abs(Math.atan2(Math.sin(Math.atan2(far.tx, far.tz) - Math.atan2(here.tx, here.tz)), 1));
    const target = curve > 0.6 ? 11 : curve > 0.3 ? 17 : 25;
    car.step(DT, { steer: Math.max(-1, Math.min(1, -err * 3)), throttle: speed < target ? 1 : 0, brake: speed > target + 3 ? 0.8 : 0, handbrake: 0, analog: true }, world);
    world.collide(car);
    t += DT;
    const d = world.distance_to_road(car.pos.x, car.pos.z);
    worst = Math.max(worst, d);
    if (d > 7) offroad += DT;
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
    if (new Vector3(0, 1, 0).applyQuaternion(car.quat).y < 0.3) return { done: false, t, offroad, worst, flipped: true };
  }
  return { done: index >= last - 3, t, offroad, worst, flipped: false };
}

let failed = 0;
let spurs = 0;
for (const seed of SEEDS) {
  const world = new World(seed);
  for (const edge of world.graph.edges) {
    if (edge.kind !== "highway" || edge.closed) continue;
    spurs++;
    const run = drive(world, edge.points);
    const clean = run.done && !run.flipped && run.offroad < 0.5;
    if (!clean) {
      failed++;
      console.log(`seed ${seed} spur ${edge.id}: ${run.done ? "reached the ring" : run.flipped ? "flipped" : "stuck"} in ${run.t.toFixed(1)} s, offroad ${run.offroad.toFixed(1)} s, worst ${run.worst.toFixed(1)} m  FAIL`);
    }
  }
}
console.log(`${spurs - failed}/${spurs} spurs driven clean`);
if (failed) throw new Error(`${failed} spurs failed the drive`);

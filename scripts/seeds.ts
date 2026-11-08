import { Vector3 } from "three";
import { Car } from "../src/car";
import { World, min_radius } from "../src/world";

const SEEDS = 20;
const DT = 1 / 360;

function autolap(world: World) {
  const car = new Car();
  const p = world.road[0];
  car.place(p.x, world.height(p.x, p.z) + 0.75, p.z, Math.atan2(p.tx, p.tz));
  let t = 0, index = 0, offroad = 0, worst = 0;
  while (t < 400 && index < world.road.length - 10) {
    for (let k = index; k < index + 60; k++) {
      const q = world.road[k % world.road.length];
      if ((q.x - car.pos.x) ** 2 + (q.z - car.pos.z) ** 2 < 100) index = Math.max(index, k);
    }
    const speed = car.vel.length();
    const ahead = world.road[(index + 6 + Math.floor(speed / 3)) % world.road.length];
    const want = Math.atan2(ahead.x - car.pos.x, ahead.z - car.pos.z);
    const err = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading));
    const far = world.road[(index + 40) % world.road.length];
    const here = world.road[index];
    const curve = Math.abs(Math.atan2(Math.sin(Math.atan2(far.tx, far.tz) - Math.atan2(here.tx, here.tz)), 1));
    const target = curve > 0.5 ? 20 : curve > 0.25 ? 30 : 42;
    car.step(DT, { steer: Math.max(-1, Math.min(1, -err * 3)), throttle: speed < target ? 1 : 0, brake: speed > target + 4 ? 0.7 : 0, handbrake: 0, analog: true }, world);
    world.collide(car.pos, car.vel, car.ang, car.heading);
    t += DT;
    const d = world.distance_to_road(car.pos.x, car.pos.z);
    worst = Math.max(worst, d);
    if (d > 7) offroad += DT;
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
    if (new Vector3(0, 1, 0).applyQuaternion(car.quat).y < 0.3) break;
  }
  return { t, index, offroad, worst };
}

let failed = 0;
for (let seed = 0; seed < SEEDS; seed++) {
  const world = new World(seed);
  const radius = min_radius(world.road.map((p) => [p.x, p.z]));
  const lap = autolap(world);
  const clean = lap.offroad === 0 && lap.index >= world.road.length - 10;
  if (!clean) failed++;
  console.log(`seed ${seed}: min radius ${radius.toFixed(0)} m, lap ${lap.t.toFixed(1)} s to ${lap.index}/${world.road.length}, offroad ${lap.offroad.toFixed(1)} s, worst ${lap.worst.toFixed(1)} m${clean ? "" : "  FAIL"}`);
}
console.log(`${SEEDS - failed}/${SEEDS} seeds clean`);
if (failed) throw new Error(`${failed} seeds failed the autolap`);

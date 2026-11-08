import { Vector3 } from "three";
import { Car } from "../src/car";
import { COUPE, car_spec, type CarSpec } from "../src/cars";
import { World } from "../src/world";

const DT = 1 / 360;

export interface Lap {
  t: number;
  index: number;
  offroad: number;
  worst: number;
  slowest: number;
  flipped: boolean;
}

export function autolap(world: World, spec: CarSpec = COUPE): Lap {
  const car = new Car(spec);
  const p = world.road[0];
  car.place(p.x, world.height(p.x, p.z) + 0.75, p.z, Math.atan2(p.tx, p.tz));
  let t = 0, index = 0, offroad = 0, worst = 0, slowest = Infinity, flipped = false;
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
    if (t > 5) slowest = Math.min(slowest, speed);
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
    if (new Vector3(0, 1, 0).applyQuaternion(car.quat).y < 0.3) {
      flipped = true;
      break;
    }
  }
  return { t, index, offroad, worst, slowest, flipped };
}

if (import.meta.main) {
  const t0 = performance.now();
  const world = new World();
  const ys = world.road.map((p) => p.y);
  let grade = 0;
  for (let i = 0; i < world.road.length; i++) grade = Math.max(grade, Math.abs(world.road[(i + 5) % world.road.length].y - world.road[i].y) / 10);
  console.log(`world: ${(performance.now() - t0).toFixed(0)} ms, road ${(world.road.length * 2 / 1000).toFixed(2)} km, height ${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)} m, max grade ${(grade * 100).toFixed(0)}%, trees ${world.trees.length}`);
  const lap = autolap(world, car_spec(process.argv[2] ?? "coupe"));
  if (lap.flipped) console.log(`flipped at t=${lap.t.toFixed(1)} index ${lap.index}`);
  console.log(`autolap: ${lap.t.toFixed(1)} s to index ${lap.index}/${world.road.length}, offroad ${lap.offroad.toFixed(1)} s, worst distance ${lap.worst.toFixed(1)} m, slowest ${(lap.slowest * 3.6).toFixed(0)} km/h`);
}

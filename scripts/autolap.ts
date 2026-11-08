import { Vector3 } from "three";
import { Car } from "../src/car";
import { World } from "../src/world";

const t0 = performance.now();
const world = new World();
const ys = world.road.map((p) => p.y);
let grade = 0;
for (let i = 0; i < world.road.length; i++) grade = Math.max(grade, Math.abs(world.road[(i + 5) % world.road.length].y - world.road[i].y) / 10);
console.log(`world: ${(performance.now() - t0).toFixed(0)} ms, road ${(world.road.length * 2 / 1000).toFixed(2)} km, height ${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)} m, max grade ${(grade * 100).toFixed(0)}%, trees ${world.trees.length}`);

const car = new Car();
const p = world.road[0];
car.place(p.x, world.height(p.x, p.z) + 0.75, p.z, Math.atan2(p.tx, p.tz));
const DT = 1 / 360;
let t = 0, index = 0, offroad = 0, worst = 0, slowest = Infinity;
const f = new Vector3();
while (t < 400 && index < world.road.length - 10) {
  for (let k = index; k < index + 60; k++) {
    const q = world.road[k % world.road.length];
    if ((q.x - car.pos.x) ** 2 + (q.z - car.pos.z) ** 2 < 100) index = Math.max(index, k);
  }
  const speed = car.vel.length();
  const ahead = world.road[(index + 6 + Math.floor(speed / 3)) % world.road.length];
  f.set(0, 0, 1).applyQuaternion(car.quat);
  const want = Math.atan2(ahead.x - car.pos.x, ahead.z - car.pos.z);
  const err = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading));
  const curve = Math.abs(Math.atan2(Math.sin(Math.atan2(world.road[(index + 40) % world.road.length].tx, world.road[(index + 40) % world.road.length].tz) - Math.atan2(world.road[index].tx, world.road[index].tz)), 1));
  const target = curve > 0.5 ? 20 : curve > 0.25 ? 30 : 42;
  car.step(DT, { steer: Math.max(-1, Math.min(1, -err * 3)), throttle: speed < target ? 1 : 0, brake: speed > target + 4 ? 0.7 : 0, handbrake: 0, analog: true }, world);
  world.collide(car.pos, car.vel, car.ang, car.heading);
  t += DT;
  const d = world.distance_to_road(car.pos.x, car.pos.z);
  worst = Math.max(worst, d);
  if (d > 7) offroad += DT;
  if (t > 5) slowest = Math.min(slowest, speed);
  if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
  if (new Vector3(0, 1, 0).applyQuaternion(car.quat).y < 0.3) { console.log(`flipped at t=${t.toFixed(1)} index ${index}`); break; }
}
console.log(`autolap: ${t.toFixed(1)} s to index ${index}/${world.road.length}, offroad ${offroad.toFixed(1)} s, worst distance ${worst.toFixed(1)} m, slowest ${(slowest * 3.6).toFixed(0)} km/h`);

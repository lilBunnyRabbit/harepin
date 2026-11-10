import { Vector3 } from "three";
import { car_spec } from "../src/car/cars";
import { Car } from "../src/car/car";
import { ROAD_HALF, World } from "../src/world";

const SPEC = car_spec(process.argv[2] ?? "coupe");

const world = new World();
const gate = world.checkpoints[3];
const cp = world.road[Math.floor((gate.index / world.checkpoints.length) * world.road.length)];
const off = ROAD_HALF + 1.7;
const post = { x: cp.x - cp.tz * off, z: cp.z + cp.tx * off };
if (!world.solids.some((s) => s.kind === "circle" && Math.hypot(s.x - post.x, s.z - post.z) < 0.01)) throw new Error("no gate post where crash.ts aims");
const HOLD_UNTIL = 8;
let failed = 0;

// Camber and crown push a car with the wheel straight sideways by up to 0.4 m over the run-up, which decides whether
// a corner clip connects; hold the line until just before the post, then let go so the hit itself is unsteered.
function hold_line(car: Car, lateral: number): number {
  const along = (car.pos.x - post.x) * cp.tx + (car.pos.z - post.z) * cp.tz;
  if (along > -HOLD_UNTIL) return 0;
  const aim = Math.min(-HOLD_UNTIL / 2, along + 15);
  const ax = post.x + cp.tx * aim - cp.tz * lateral;
  const az = post.z + cp.tz * aim + cp.tx * lateral;
  const want = Math.atan2(ax - car.pos.x, az - car.pos.z);
  const err = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading));
  return Math.max(-1, Math.min(1, -err * 3));
}

for (const [label, lateral] of [
  ["head-on", 0],
  ["corner clip", -(SPEC.radius + 0.35)],
] as const) {
  const car = new Car(SPEC);
  const back = 45;
  const x = post.x - cp.tx * back - cp.tz * lateral;
  const z = post.z - cp.tz * back + cp.tx * lateral;
  car.place(x, world.height(x, z) + 0.75, z, Math.atan2(cp.tx, cp.tz));
  let impact = 0;
  let closest = Infinity;
  for (let t = 0; t < 5; t += 1 / 360) {
    car.step(1 / 360, { steer: hold_line(car, lateral), throttle: 1, brake: 0, handbrake: 0, analog: true }, world);
    impact = Math.max(impact, world.collide(car));
    closest = Math.min(closest, Math.hypot(car.pos.x - post.x, car.pos.z - post.z));
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
  }
  const upright = new Vector3(0, 1, 0).applyQuaternion(car.quat).y;
  const along = (car.pos.x - post.x) * cp.tx + (car.pos.z - post.z) * cp.tz;
  const through = label === "head-on" && (along > 0 || closest < SPEC.radius);
  if (through) failed++;
  console.log(
    `${label}: impact ${impact.toFixed(1)} m/s, closest ${closest.toFixed(2)} m, yaw now ${car.ang.y.toFixed(2)} rad/s, heading change ${(((car.heading - Math.atan2(cp.tx, cp.tz)) * 180) / Math.PI).toFixed(0)}°, upright ${upright.toFixed(2)}${through ? "  FAIL: passed the post" : ""}`,
  );
}

// Nose circle dead on the post centre: the contact has no direction of its own and must still push the car back.
{
  const car = new Car(SPEC);
  const heading = Math.atan2(cp.tx, cp.tz);
  const x = post.x - cp.tx * SPEC.circles[0];
  const z = post.z - cp.tz * SPEC.circles[0];
  car.place(x, world.height(x, z) + 0.75, z, heading);
  car.vel.set(cp.tx * 5, 0, cp.tz * 5);
  world.collide(car);
  const back = (x - car.pos.x) * cp.tx + (z - car.pos.z) * cp.tz;
  const stopped = back > 0.5 && car.vel.x * cp.tx + car.vel.z * cp.tz <= 0;
  if (!stopped) failed++;
  console.log(`dead centre: pushed back ${back.toFixed(2)} m${stopped ? "" : "  FAIL"}`);
}
if (failed) throw new Error(`${failed} crash cases failed`);

import { build_spec, parse_build } from "../src/car/build";
import { Car, drop_height } from "../src/car/car";
import { car_spec } from "../src/car/cars";
import { World } from "../src/world/world";

const ARG = process.argv[2] ?? "coupe";
const BUILD = parse_build(ARG);
const SPEC = BUILD ? build_spec(BUILD) : car_spec(ARG);
const DT = 1 / 360;
const world = new World();
const start = 200;
const p = world.road[start];
const side = 40;
const x0 = p.x - p.tz * side;
const z0 = p.z + p.tx * side;

// The road run follows the centreline like autolap does; the grass run holds a straight line parallel to it.
function steer_along_road(car: Car, index: number): { steer: number; index: number } {
  for (let k = index; k < index + 60; k++) {
    const q = world.road[k % world.road.length];
    if ((q.x - car.pos.x) ** 2 + (q.z - car.pos.z) ** 2 < 100) index = Math.max(index, k);
  }
  const ahead = world.road[(index + 6 + Math.floor(car.vel.length() / 3)) % world.road.length];
  const want = Math.atan2(ahead.x - car.pos.x, ahead.z - car.pos.z);
  const err = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading));
  return { steer: Math.max(-1, Math.min(1, -err * 3)), index };
}

for (const [label, sx, sz] of [["road", p.x, p.z], ["grass", x0, z0]] as const) {
  const on_road = label === "road";
  const car = new Car(SPEC);
  car.place(sx, world.height(sx, sz) + drop_height(SPEC, 0.75), sz, Math.atan2(p.tx, p.tz));
  for (let t = 0; t < 1.5; t += DT) car.step(DT, { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true }, world);
  let index = start;
  let prev_vy = car.vel.y;
  let acc_sum = 0, ang_sum = 0, n = 0, steps = 0, grip_min = Infinity, grip_max = 0;
  for (let t = 0; t < 8; t += DT) {
    const kmh = car.forward_speed * 3.6;
    let steer = 0;
    if (on_road) ({ steer, index } = steer_along_road(car, index));
    car.step(DT, { steer, throttle: kmh < 70 ? 1 : 0.3, brake: 0, handbrake: 0, analog: true }, world);
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
    steps++;
    const grip = world.grip(car.pos.x, car.pos.z);
    grip_min = Math.min(grip_min, grip);
    grip_max = Math.max(grip_max, grip);
    if (t > 3 && steps % 6 === 0) {
      const ay = (car.vel.y - prev_vy) / (DT * 6);
      prev_vy = car.vel.y;
      acc_sum += ay * ay;
      ang_sum += car.ang.x ** 2 + car.ang.z ** 2;
      n++;
    } else if (steps % 6 === 0) prev_vy = car.vel.y;
  }
  console.log(`${label}: speed ${(car.forward_speed * 3.6).toFixed(0)} km/h, vertical accel rms ${Math.sqrt(acc_sum / n).toFixed(2)} m/s², pitch/roll rate rms ${Math.sqrt(ang_sum / n).toFixed(3)} rad/s, grip ${grip_min.toFixed(2)}..${grip_max.toFixed(2)}`);
}

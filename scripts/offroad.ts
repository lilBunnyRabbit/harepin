import { Car } from "../src/car";
import { World } from "../src/world";

const world = new World();
const p = world.road[200];
const side = 40;
const x0 = p.x - p.tz * side;
const z0 = p.z + p.tx * side;
for (const [label, sx, sz] of [["road", p.x, p.z], ["grass", x0, z0]] as const) {
  const car = new Car();
  car.place(sx, world.height(sx, sz) + 0.75, sz, Math.atan2(p.tx, p.tz));
  const DT = 1 / 360;
  for (let t = 0; t < 1.5; t += DT) car.step(DT, { steer: 0, throttle: 0, brake: 0, handbrake: 0, analog: true }, world);
  let prev_vy = car.vel.y;
  let acc_sum = 0, ang_sum = 0, n = 0, steps = 0;
  for (let t = 0; t < 8; t += DT) {
    const kmh = car.forward_speed * 3.6;
    car.step(DT, { steer: 0, throttle: kmh < 70 ? 1 : 0.3, brake: 0, handbrake: 0, analog: true }, world);
    steps++;
    if (t > 3 && steps % 6 === 0) {
      const ay = (car.vel.y - prev_vy) / (DT * 6);
      prev_vy = car.vel.y;
      acc_sum += ay * ay;
      ang_sum += car.ang.x ** 2 + car.ang.z ** 2;
      n++;
    } else if (steps % 6 === 0) prev_vy = car.vel.y;
  }
  console.log(`${label}: speed ${(car.forward_speed * 3.6).toFixed(0)} km/h, vertical accel rms ${Math.sqrt(acc_sum / n).toFixed(2)} m/s², pitch/roll rate rms ${Math.sqrt(ang_sum / n).toFixed(3)} rad/s, grip ${world.grip(car.pos.x, car.pos.z)}`);
}

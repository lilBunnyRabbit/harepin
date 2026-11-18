import type { Car } from "./car";
import { hypot } from "../sim-math";

/** Metres behind a car its wake reaches, and the share of the follower's drag it takes off on the bumper. */
const WAKE = 45;
export const TOW = 0.4;
/** Metres to the side of the wake's centre the tow holds in full, and where it is gone. */
const WAKE_CORE = 1.2;
const WAKE_EDGE = 3.4;
/** m/s the car ahead makes along the follower's course under which it leaves no wake, and over which the wake is whole. */
const WAKE_SLOW = 15;
const WAKE_FAST = 30;
/** Metres of height apart past which a car is on another level, not ahead. */
const WAKE_HEIGHT = 3;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Sets each car's `tow` from the wake of the cars ahead on its course: the strongest one counts. */
export function slipstream(cars: readonly Car[]) {
  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    const v = hypot(car.vel.x, car.vel.z);
    let tow = 0;
    if (v > WAKE_SLOW) {
      const dx = car.vel.x / v;
      const dz = car.vel.z / v;
      for (let j = 0; j < cars.length; j++) {
        if (j === i) continue;
        const other = cars[j];
        const rx = other.pos.x - car.pos.x;
        const rz = other.pos.z - car.pos.z;
        const ahead = rx * dx + rz * dz;
        if (ahead <= 0 || ahead >= WAKE || Math.abs(other.pos.y - car.pos.y) > WAKE_HEIGHT) continue;
        const side = Math.abs(rx * dz - rz * dx);
        if (side >= WAKE_EDGE) continue;
        const pace = other.vel.x * dx + other.vel.z * dz;
        const share = TOW * (1 - ahead / WAKE) * clamp01((WAKE_EDGE - side) / (WAKE_EDGE - WAKE_CORE)) * clamp01((pace - WAKE_SLOW) / (WAKE_FAST - WAKE_SLOW));
        if (share > tow) tow = share;
      }
    }
    car.tow = tow;
  }
}

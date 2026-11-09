import { Vector3 } from "three";
import type { Car } from "./car";
import type { World } from "./world";
import { PAD_HALF } from "./worldgen/sky";

/** Push along the car's nose while a kick lasts (m/s²), how long one lasts, and the speed past which it stops pushing. */
export const PAD_ACCEL = 8;
export const PAD_TIME = 1;
export const PAD_MAX = 48;

const forward = new Vector3();

/**
 * A boost pad's kick, a force at the centre of mass rather than wheel torque: through the wheels it would only light
 * traction control. Call right after `car.step`, the way `world.collide` edits `vel`.
 */
export class PadTimer {
  /** Seconds of kick left. */
  left = 0;
  /** Over a pad last step: the kick starts on the way onto one, so a slow car gets no more than a fast one. */
  private on = false;

  step(dt: number, car: Pick<Car, "pos" | "quat" | "vel" | "wheels">, world: Pick<World, "deck">): void {
    const deck = world.deck;
    if (!deck || !deck.deck.pads.length) return;
    const grounded = car.wheels.some((w) => w.contact);
    const hit = grounded ? deck.surface(car.pos.x, car.pos.z, car.pos.y) : null;
    const s = hit && Math.abs(hit.u) <= PAD_HALF ? deck.at(hit.index, 8) : -1;
    const on = deck.deck.pads.some((p) => s >= p.s0 && s <= p.s1);
    if (on && !this.on) this.left = PAD_TIME;
    this.on = on;
    if (this.left <= 0) return;
    this.left = Math.max(0, this.left - dt);
    if (!grounded || car.vel.length() >= PAD_MAX) return;
    car.vel.addScaledVector(forward.set(0, 0, 1).applyQuaternion(car.quat), PAD_ACCEL * dt);
  }

  clear(): void {
    this.left = 0;
    this.on = false;
  }
}

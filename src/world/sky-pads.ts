import { Vector3 } from "three";
import type { Car } from "../car/car";
import type { World } from "./world";
import type { DeckIndex } from "../worldgen/deck";
import { PAD_HALF } from "../worldgen/sky";

/** Push along the car's nose while a kick lasts (m/s²), how long one lasts, and the speed past which it stops pushing. */
export const PAD_ACCEL = 8;
export const PAD_TIME = 1;
export const PAD_MAX = 48;

const forward = new Vector3();

/** Everything a rewind puts back, so a rewound lap gets the kick it had and no fresh one. */
export interface PadSnapshot {
  left: number;
  on: boolean;
}

function on_pad(deck: DeckIndex, p: Vector3): boolean {
  const hit = deck.surface(p.x, p.z, p.y);
  if (!hit || Math.abs(hit.u) > PAD_HALF) return false;
  const s = deck.at(hit.index, 8);
  for (const pad of deck.deck.pads) if (s >= pad.s0 && s <= pad.s1) return true;
  return false;
}

/**
 * A boost pad's kick, a force at the centre of mass rather than wheel torque: through the wheels it would only light
 * traction control. Call right after `car.step`, the way `world.collide` edits `vel`.
 */
export class PadTimer {
  /** Seconds of kick left. */
  left = 0;
  /** A wheel on a pad last step: the kick starts on the way onto one, so a slow car gets no more than a fast one. */
  private on = false;

  step(dt: number, car: Pick<Car, "quat" | "vel" | "wheels">, world: Pick<World, "deck">): void {
    const deck = world.deck;
    if (!deck || !deck.deck.pads.length) return;
    let grounded = false;
    let on = false;
    for (const w of car.wheels) {
      if (!w.contact) continue;
      grounded = true;
      if (on_pad(deck, w.point)) {
        on = true;
        break;
      }
    }
    if (on && !this.on) this.left = PAD_TIME;
    this.on = on;
    if (this.left <= 0) return;
    this.left = Math.max(0, this.left - dt);
    if (!grounded || car.vel.length() >= PAD_MAX) return;
    car.vel.addScaledVector(forward.set(0, 0, 1).applyQuaternion(car.quat), PAD_ACCEL * dt);
  }

  snapshot(): PadSnapshot {
    return { left: this.left, on: this.on };
  }

  restore(snap: PadSnapshot): void {
    this.left = snap.left;
    this.on = snap.on;
  }

  clear(): void {
    this.left = 0;
    this.on = false;
  }
}

import type { CarSpec } from "./cars";

export interface Axle {
  /** Distance ahead of the centre of mass, metres. */
  z: number;
  wheels: [number, number];
  steer: boolean;
  /** Share of the engine's torque at the wheels sent to this axle, 0..1. */
  drive_share: number;
  brake: number;
  arb: number;
  /** Scale on `spec.mu`. */
  grip: number;
  handbrake: boolean;
}

/** Mounts sharing a z make an axle, front first; the front one steers, the rest share the rear's settings and drive. */
export function axles_of(spec: CarSpec): Axle[] {
  const pairs = new Map<number, number[]>();
  spec.wheel.mounts.forEach(([, , z], i) => pairs.set(z, [...(pairs.get(z) ?? []), i]));
  const axles = [...pairs].sort(([a], [b]) => b - a);
  const front = spec.drive === "awd" ? (spec.awd_split ?? 0.5) : spec.drive === "fwd" ? 1 : 0;
  const rear = (1 - front) / (axles.length - 1);
  return axles.map(([z, wheels], i) => {
    if (wheels.length !== 2) throw new Error(`${spec.id}: axle at z ${z} has ${wheels.length} wheels, not 2`);
    const pair: [number, number] = [wheels[0], wheels[1]];
    return i === 0
      ? { z, wheels: pair, steer: true, drive_share: front, brake: spec.brake_front, arb: spec.arb_front, grip: 1, handbrake: false }
      : { z, wheels: pair, steer: false, drive_share: rear, brake: spec.brake_rear, arb: spec.arb_rear, grip: spec.rear_grip, handbrake: true };
  });
}

export function axle_index(axles: Axle[], wheel: number): number {
  return axles.findIndex((a) => a.wheels.includes(wheel));
}

import type { CarSpec } from "../cars";
import type { Body } from "./gymkhana";

export function body_of(spec: CarSpec): Body {
  return { circles: spec.circles, radius: spec.radius, length: spec.body.length, width: spec.body.width };
}

export function turn_to(car: { pos: { x: number; z: number }; heading: number }, x: number, z: number): number {
  const bearing = Math.atan2(x - car.pos.x, z - car.pos.z);
  return Math.atan2(Math.sin(bearing - car.heading), Math.cos(bearing - car.heading));
}

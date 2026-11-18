import type { CarSpec } from "./cars";

export const ShiftMode = { SPORT: "sport", NORMAL: "normal", ECO: "eco" } as const;
export type ShiftMode = (typeof ShiftMode)[keyof typeof ShiftMode];

/** Shares of the car's band, torque peak to redline, added to its own `upshift` and `downshift`, so engine parts scale them too. */
export interface ShiftPoints {
  up: number;
  down: number;
  /**
   * The lines on full throttle. Eco's kicks down at Normal's line and upshifts nearer it: on its part-throttle line the
   * bus hunted 3rd-4th up a 20% grade.
   */
  kick_up: number;
  kick_down: number;
}

export const SHIFT_POINTS: Record<ShiftMode, ShiftPoints> = {
  sport: { up: 0.1, down: 0.25, kick_up: 0.1, kick_down: 0.25 },
  normal: { up: 0, down: 0, kick_up: 0, kick_down: 0 },
  eco: { up: -0.6, down: -0.15, kick_up: -0.2, kick_down: 0 },
};

export const KICK_PEDAL = 0.9;
/** Rpm under the redline an upshift stays: at the limiter the engine cuts and the wheels may never pass the line. */
export const LIMITER_GAP = 250;

export function torque_peak(torque: CarSpec["torque"]): number {
  let best = torque[0];
  for (const point of torque) if (point[1] > best[1]) best = point;
  return best[0];
}

export function shift_band(spec: CarSpec): number {
  return spec.redline - torque_peak(spec.torque);
}

export function upshift_rpm(spec: CarSpec, band: number, mode: ShiftMode, pedal: number): number {
  const points = SHIFT_POINTS[mode];
  return Math.min(spec.upshift + (pedal > KICK_PEDAL ? points.kick_up : points.up) * band, spec.redline - LIMITER_GAP);
}

export function downshift_rpm(spec: CarSpec, band: number, mode: ShiftMode, pedal: number): number {
  const points = SHIFT_POINTS[mode];
  return spec.downshift + (pedal > KICK_PEDAL ? points.kick_down : points.down) * band;
}

import type { CarSpec } from "./cars";

export const ShiftMode = { SPORT: "sport", NORMAL: "normal", ECO: "eco" } as const;
export type ShiftMode = (typeof ShiftMode)[keyof typeof ShiftMode];

/** Shares of the car's band, torque peak to redline, added to its own `upshift` and `downshift`, so engine parts scale them too. */
export interface ShiftPoints {
  up: number;
  down: number;
  /** The downshift line on full throttle: Eco kicks down at Normal's line so it never bogs on a hill. */
  kick: number;
}

export const SHIFT_POINTS: Record<ShiftMode, ShiftPoints> = {
  sport: { up: 0.1, down: 0.25, kick: 0.25 },
  normal: { up: 0, down: 0, kick: 0 },
  eco: { up: -0.6, down: -0.15, kick: 0 },
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

export function upshift_rpm(spec: CarSpec, band: number, mode: ShiftMode): number {
  return Math.min(spec.upshift + SHIFT_POINTS[mode].up * band, spec.redline - LIMITER_GAP);
}

export function downshift_rpm(spec: CarSpec, band: number, mode: ShiftMode, pedal: number): number {
  const points = SHIFT_POINTS[mode];
  return spec.downshift + (pedal > KICK_PEDAL ? points.kick : points.down) * band;
}

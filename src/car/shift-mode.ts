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
  /** The downshift line while braking: Sport gears down early so the bend's exit pulls from high revs. */
  brake_down: number;
  /**
   * How far under the upshift line a downshift above the car's own line must land: dropped to just under it, Sport's
   * exit pulled one beat in 1st and shifted back up, 4 km/h down on Normal 2 s out of a 60 km/h bend in the Coupe.
   */
  early_room: number;
  /** The lowest gear a downshift above the car's own line picks: into 1st, the Muscle's exit lost 3 km/h to the shift back. */
  early_floor: number;
  /** The least throttle an upshift takes: Sport holds its gear off the throttle and on the brakes. */
  hold_pedal: number;
}

export const SHIFT_POINTS: Record<ShiftMode, ShiftPoints> = {
  sport: { up: 0.1, down: 0.25, kick_up: 0.1, kick_down: 0.25, brake_down: 0.6, early_room: 0.4, early_floor: 2, hold_pedal: 0.1 },
  normal: { up: 0, down: 0, kick_up: 0, kick_down: 0, brake_down: 0, early_room: 0, early_floor: 1, hold_pedal: -1 },
  eco: { up: -0.6, down: -0.15, kick_up: -0.2, kick_down: 0, brake_down: -0.15, early_room: 0, early_floor: 1, hold_pedal: -1 },
};

export const KICK_PEDAL = 0.9;
export const BRAKE_PEDAL = 0.1;
/** Rpm under the upshift line a downshift must land, so the box doesn't hunt. */
export const DOWNSHIFT_ROOM = 600;
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

export function downshift_rpm(spec: CarSpec, band: number, mode: ShiftMode, pedal: number, brake: number): number {
  const points = SHIFT_POINTS[mode];
  return spec.downshift + (brake > BRAKE_PEDAL ? points.brake_down : pedal > KICK_PEDAL ? points.kick_down : points.down) * band;
}

/**
 * The most rpm the lower gear may land at. On full throttle it is Normal's upshift at least: judged on Eco's early
 * upshift, the bus kicked down only under its idle and lugged up a 25% grade.
 */
export function downshift_ceiling(spec: CarSpec, band: number, mode: ShiftMode, pedal: number, turning: number, lower: number): number {
  const points = SHIFT_POINTS[mode];
  const early = turning >= spec.downshift;
  if (early && lower < points.early_floor) return -Infinity;
  const up = upshift_rpm(spec, band, mode, pedal);
  const room = early ? points.early_room * band : 0;
  return (pedal > KICK_PEDAL ? Math.max(up, spec.upshift) : up) - DOWNSHIFT_ROOM - room;
}

/** Held past the redline, the bus coasting down a 15% grade overran it by 540 rpm. */
export function holds_gear(spec: CarSpec, mode: ShiftMode, pedal: number, rpm: number): boolean {
  return pedal <= SHIFT_POINTS[mode].hold_pedal && rpm < spec.redline;
}

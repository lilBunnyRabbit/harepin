/** FH5-style pad axis settings in percent, as the menu stores them; the defaults are the fixed curve the pad drove before they existed. */
export const STEER_INNER = 8;
export const STEER_OUTER = 100;
export const STEER_LINEARITY = 20;
export const TRIGGER_INNER = 0;
export const TRIGGER_OUTER = 100;

/** Linearity 0 is a straight line; each 50 adds one to the curve's exponent, so the default 20 is the old `** 1.4`. */
const LINEARITY_PER_POWER = 50;
/** Outside deadzone closer than this to the inside one acts as a switch at the inside edge instead of dividing by zero. */
const MIN_SPAN = 0.01;

export interface AxisResponse {
  /** Travel from rest, 0..1, that reads as 0. */
  inner: number;
  /** Travel, 0..1, that already reads as 1. */
  outer: number;
  /** Power on the travel between the two; 1 is linear, higher is finer near rest. */
  exponent: number;
}

export interface PadResponse {
  steer: AxisResponse;
  throttle: AxisResponse;
  brake: AxisResponse;
}

export interface PadPercents {
  steer_inner: number;
  steer_outer: number;
  steer_linearity: number;
  throttle_inner: number;
  throttle_outer: number;
  brake_inner: number;
  brake_outer: number;
}

export const linearity_exponent = (linearity: number) => (LINEARITY_PER_POWER + linearity) / LINEARITY_PER_POWER;

const axis = (inner: number, outer: number, exponent: number): AxisResponse => ({ inner: inner / 100, outer: outer / 100, exponent });

export function pad_response(p: PadPercents): PadResponse {
  return {
    steer: axis(p.steer_inner, p.steer_outer, linearity_exponent(p.steer_linearity)),
    throttle: axis(p.throttle_inner, p.throttle_outer, 1),
    brake: axis(p.brake_inner, p.brake_outer, 1),
  };
}

export const DEFAULT_PAD_RESPONSE = pad_response({
  steer_inner: STEER_INNER,
  steer_outer: STEER_OUTER,
  steer_linearity: STEER_LINEARITY,
  throttle_inner: TRIGGER_INNER,
  throttle_outer: TRIGGER_OUTER,
  brake_inner: TRIGGER_INNER,
  brake_outer: TRIGGER_OUTER,
});

/** A stick axis (-1..1) or trigger (0..1) through its deadzones and curve; the sign stays the raw one. */
export function axis_value(raw: number, { inner, outer, exponent }: AxisResponse): number {
  const span = Math.max(MIN_SPAN, outer - inner);
  const travel = Math.min(1, Math.max(0, Math.abs(raw) - inner) / span);
  return Math.sign(raw) * travel ** exponent;
}

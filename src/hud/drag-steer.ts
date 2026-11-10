import type { SteerSensitivity } from "../menu/prefs";

/** Finger travel in CSS px from where the drag started to full lock, per sensitivity step; High is the original feel. */
export const FULL_LOCK_PX: Record<SteerSensitivity, number> = { low: 160, medium: 120, high: 70, very_high: 50 };
/** Travel in px that still reads as straight ahead, so a resting thumb's jitter does not steer. */
export const STEER_DEADZONE = 6;
/** Response exponent past the deadzone: above 1 gives finer steering near centre, still reaching full lock. */
export const STEER_CURVE = 1.4;

/** Steer -1..1 for a horizontal drag of `dx` px from the drag's origin. */
export function drag_steer(dx: number, full_lock: number): number {
  const travel = Math.min(Math.abs(dx), full_lock);
  const past = Math.max(0, travel - STEER_DEADZONE) / (full_lock - STEER_DEADZONE);
  return past > 0 ? Math.sign(dx) * past ** STEER_CURVE : 0;
}

import type { SoundFrame } from "./audio";

/** Seconds the engine takes to climb from idle back to the car's rpm once a hold ends. */
export const RETURN_TIME = 0.25;

/** A held sim (menu, lab card, garage, countdown) leaves the car's last rpm and throttle frozen; the engine idles under it instead. */
export function idle_sound(frame: SoundFrame, idle: number): SoundFrame {
  frame.rpm = idle;
  frame.throttle = 0;
  frame.scrub = 0;
  frame.speed = 0;
  frame.offroad = false;
  frame.boost = false;
  frame.held = true;
  return frame;
}

/** The rpm `since` seconds after a hold ended: eases from the held idle to the live rpm, so closing a menu at speed doesn't flare. */
export function return_rpm(idle: number, live: number, since: number): number {
  if (since >= RETURN_TIME) return live;
  const k = Math.max(0, since / RETURN_TIME);
  return idle + (live - idle) * k * k * (3 - 2 * k);
}

import type { SoundFrame } from "./audio";

/** A held sim (menu, lab card, garage, countdown) leaves the car's last rpm and throttle frozen; the engine idles under it instead. */
export function idle_sound(frame: SoundFrame, idle: number): SoundFrame {
  frame.rpm = idle;
  frame.throttle = 0;
  frame.scrub = 0;
  frame.speed = 0;
  frame.offroad = false;
  frame.boost = false;
  return frame;
}

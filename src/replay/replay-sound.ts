import type { SoundFrame } from "../audio/audio";
import { lap_span } from "../car/ghost";
import { STRIDE } from "../car/ghost-cap";
import { SOUND_STRIDE, type Watched } from "./run-tape";

/** The taped rpm, throttle, raw scrub and nitro at `ms` into `out`; false when the tape has no sound (saved before it was taped). */
export function taped_sound(tape: Watched, ms: number, out: SoundFrame): boolean {
  const { frames, sound } = tape;
  if (!sound.length || sound.length !== (frames.length / STRIDE) * SOUND_STRIDE) return false;
  const { i, j, k } = lap_span(frames, ms);
  const a = (i / STRIDE) * SOUND_STRIDE;
  const b = (j / STRIDE) * SOUND_STRIDE;
  out.rpm = sound[a] + (sound[b] - sound[a]) * k;
  out.throttle = sound[a + 1] + (sound[b + 1] - sound[a + 1]) * k;
  out.scrub = sound[a + 2] + (sound[b + 2] - sound[a + 2]) * k;
  out.boost = sound[(k < 0.5 ? a : b) + 3] > 0;
  return true;
}

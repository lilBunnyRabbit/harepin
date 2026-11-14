/// <reference types="bun" />
import { expect, test } from "bun:test";
import { COUPE } from "../car/cars";
import type { SoundFrame } from "./audio";
import { idle_sound } from "./held-sound";

test("a held sim drops a flat-out engine to idle with no tyre, wind or nitro sound", () => {
  const frame: SoundFrame = { rpm: 7400, throttle: 1, scrub: 0.8, speed: 52, offroad: true, sound: COUPE.sound, redline: COUPE.redline, boost: true };
  const held = idle_sound(frame, COUPE.idle);
  expect(held).toBe(frame);
  expect(held).toMatchObject({ rpm: COUPE.idle, throttle: 0, scrub: 0, speed: 0, offroad: false, boost: false, redline: COUPE.redline });
});

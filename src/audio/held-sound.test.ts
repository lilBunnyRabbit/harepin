/// <reference types="bun" />
import { expect, test } from "bun:test";
import { COUPE } from "../car/cars";
import type { SoundFrame } from "./audio";
import { RETURN_TIME, idle_sound, return_rpm } from "./held-sound";

test("a held sim drops a flat-out engine to idle with no tyre, wind or nitro sound", () => {
  const frame: SoundFrame = { rpm: 7400, throttle: 1, scrub: 0.8, speed: 52, offroad: true, sound: COUPE.sound, redline: COUPE.redline, boost: true, held: false };
  const held = idle_sound(frame, COUPE.idle);
  expect(held).toBe(frame);
  expect(held).toMatchObject({ rpm: COUPE.idle, throttle: 0, scrub: 0, speed: 0, offroad: false, boost: false, held: true, redline: COUPE.redline });
});

test("after a hold the engine climbs from idle to the live rpm over the return time, never past it", () => {
  const idle = COUPE.idle;
  const live = 7000;
  expect(return_rpm(idle, live, 0)).toBe(idle);
  expect(return_rpm(idle, live, RETURN_TIME)).toBe(live);
  expect(return_rpm(idle, live, 10)).toBe(live);
  let last = idle;
  for (let t = 0.01; t < RETURN_TIME; t += 0.01) {
    const rpm = return_rpm(idle, live, t);
    expect(rpm).toBeGreaterThan(last);
    expect(rpm).toBeLessThan(live);
    last = rpm;
  }
  expect(return_rpm(idle, live, RETURN_TIME / 2)).toBeCloseTo((idle + live) / 2);
});

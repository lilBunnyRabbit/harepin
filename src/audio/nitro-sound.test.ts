/// <reference types="bun" />
import { expect, test } from "bun:test";
import { NITRO, rush_target } from "./nitro-sound";

test("the rush swells on the button, settles under the engine and fades out slower than it came in", () => {
  const aim = { level: 0, tau: 1 };
  const lit = { ...rush_target(0, aim) };
  const held = { ...rush_target(NITRO.rush_settle_at + 1, aim) };
  const off = { ...rush_target(null, aim) };
  expect(lit.level).toBe(NITRO.rush_peak);
  expect(held.level).toBeLessThan(lit.level);
  expect(held.level).toBeGreaterThan(0);
  expect(off.level).toBe(0);
  expect(off.tau).toBeGreaterThan(lit.tau);
  expect(rush_target(null, aim)).toBe(aim);
});

test("nothing in the nitro sound reaches into the hiss band", () => {
  expect(Math.max(...NITRO.whoosh_hz)).toBeLessThan(1500);
  expect(NITRO.rush_hz).toBeLessThan(1000);
  expect(NITRO.whoosh_attack).toBeLessThan(NITRO.whoosh_rise);
  expect(NITRO.whoosh_gap).toBeLessThan(NITRO.whoosh_time);
});

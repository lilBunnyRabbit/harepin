import { expect, test } from "bun:test";
import { lap_cap_ms } from "./ghost-cap";

test("island laps keep the ten minute cap", () => {
  expect(lap_cap_ms(0)).toBe(10 * 60_000);
  expect(lap_cap_ms(4_500)).toBe(10 * 60_000);
});

test("a long circuit's cap leaves room for a slow lap", () => {
  for (const length of [6_600, 15_200]) {
    const slow_ms = (length / 9) * 1000;
    expect(slow_ms).toBeGreaterThan(10 * 60_000);
    expect(lap_cap_ms(length)).toBeGreaterThan(slow_ms);
  }
});

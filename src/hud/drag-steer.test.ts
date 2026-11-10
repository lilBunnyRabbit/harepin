import { describe, expect, test } from "bun:test";
import { SteerSensitivity } from "../menu/prefs";
import { drag_steer, FULL_LOCK_PX, STEER_DEADZONE } from "./drag-steer";

const STEPS = Object.values(SteerSensitivity);

describe("drag_steer", () => {
  test("the deadzone reads as straight ahead", () => {
    for (const step of STEPS) {
      for (const dx of [0, 1, -3, STEER_DEADZONE, -STEER_DEADZONE]) expect(drag_steer(dx, FULL_LOCK_PX[step])).toBe(0);
      expect(drag_steer(STEER_DEADZONE + 1, FULL_LOCK_PX[step])).toBeGreaterThan(0);
    }
  });

  test("steer rises monotonically with travel and is symmetric", () => {
    for (const step of STEPS) {
      const lock = FULL_LOCK_PX[step];
      let last = 0;
      for (let dx = 0; dx <= lock + 20; dx += 0.5) {
        const value = drag_steer(dx, lock);
        expect(value).toBeGreaterThanOrEqual(last);
        expect(drag_steer(-dx, lock) + value).toBe(0);
        last = value;
      }
    }
  });

  test("the curve gives less than linear steer near centre", () => {
    for (const step of STEPS) {
      const lock = FULL_LOCK_PX[step];
      const half = STEER_DEADZONE + (lock - STEER_DEADZONE) / 2;
      expect(drag_steer(half, lock)).toBeLessThan(0.5);
      expect(drag_steer(half, lock)).toBeGreaterThan(0.25);
    }
  });

  test("full lock is reached at every step and clamps past it", () => {
    for (const step of STEPS) {
      const lock = FULL_LOCK_PX[step];
      expect(drag_steer(lock, lock)).toBe(1);
      expect(drag_steer(-lock, lock)).toBe(-1);
      expect(drag_steer(lock * 4, lock)).toBe(1);
      expect(drag_steer(-lock * 4, lock)).toBe(-1);
    }
  });

  test("lower sensitivity needs more travel, the default noticeably more than the original feel", () => {
    const locks = STEPS.map((step) => FULL_LOCK_PX[step]);
    expect(locks).toEqual([...locks].sort((a, b) => b - a));
    expect(FULL_LOCK_PX.high).toBe(70);
    expect(FULL_LOCK_PX[SteerSensitivity.MEDIUM] / FULL_LOCK_PX.high).toBeGreaterThanOrEqual(1.6);
  });
});

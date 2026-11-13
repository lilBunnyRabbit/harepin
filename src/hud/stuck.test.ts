import { describe, expect, test } from "bun:test";
import { pushing, StuckTimer } from "./stuck";

const DT = 1 / 60;

function hold(timer: StuckTimer, seconds: number, speed: number, push: boolean) {
  for (let t = 0; t < seconds; t += DT) timer.update(DT, speed, push);
}

describe("pushing", () => {
  test("the throttle drives in a forward gear, auto or manual", () => {
    expect(pushing(1, 0, 1, true)).toBe(true);
    expect(pushing(1, 0, 3, false)).toBe(true);
  });

  test("the brake is no push in a forward gear", () => {
    expect(pushing(0, 1, 1, true)).toBe(false);
    expect(pushing(0, 1, 2, false)).toBe(false);
    expect(pushing(0, 0.5, 0, false)).toBe(false);
  });

  test("the brake drives in the auto box's reverse, the throttle in a manual reverse", () => {
    expect(pushing(0, 1, -1, true)).toBe(true);
    expect(pushing(1, 0, -1, true)).toBe(false);
    expect(pushing(1, 0, -1, false)).toBe(true);
    expect(pushing(0, 1, -1, false)).toBe(false);
  });

  test("a resting thumb is no push", () => {
    expect(pushing(0.2, 0, 1, true)).toBe(false);
  });
});

describe("StuckTimer", () => {
  test("two seconds of throttle against a wall is stuck", () => {
    const timer = new StuckTimer();
    hold(timer, 1.9, 0, true);
    expect(timer.stuck).toBe(false);
    hold(timer, 0.2, 0, true);
    expect(timer.stuck).toBe(true);
  });

  test("standing on the brake at a junction never is", () => {
    const timer = new StuckTimer();
    hold(timer, 10, 0, pushing(0, 1, 1, false));
    expect(timer.stuck).toBe(false);
  });

  test("driving off clears it", () => {
    const timer = new StuckTimer();
    hold(timer, 3, 0, true);
    timer.update(DT, 5, true);
    expect(timer.stuck).toBe(false);
  });

  test("a short let-go keeps the count, a long one clears it", () => {
    const timer = new StuckTimer();
    hold(timer, 1.5, 0, true);
    hold(timer, 1, 0, false);
    hold(timer, 0.6, 0, true);
    expect(timer.stuck).toBe(true);
    hold(timer, 2, 0, false);
    expect(timer.stuck).toBe(false);
  });

  test("clear drops the count", () => {
    const timer = new StuckTimer();
    hold(timer, 3, 0, true);
    timer.clear();
    expect(timer.stuck).toBe(false);
    hold(timer, 1.9, 0, true);
    expect(timer.stuck).toBe(false);
  });
});

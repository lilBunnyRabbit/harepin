import { describe, expect, test } from "bun:test";
import { COUNTDOWN_MS } from "./races";
import { Beep, GREEN_MS, StartSteps, start_step } from "./start-steps";

const FRAME_MS = 1000 / 60;

/** Runs a start at 60 fps: the countdown on the wall clock, then the go, logging each beep against the step it sounded on. */
function run_start(reds: number) {
  const steps = new StartSteps(reds);
  const log: { at: number; beep: Beep; step: number }[] = [];
  for (let t = 0; t < COUNTDOWN_MS + GREEN_MS * 2; t += FRAME_MS) {
    const countdown = Math.max(0, COUNTDOWN_MS - t);
    const since_go = countdown > 0 ? -1 : t - COUNTDOWN_MS;
    const beep = steps.next(countdown, since_go);
    if (beep) log.push({ at: t, beep, step: steps.step });
  }
  return log;
}

describe("start beeps", () => {
  test("one red beep as each lamp lights, then one go beep as they turn green", () => {
    const log = run_start(3);
    expect(log.map((b) => b.beep)).toEqual([Beep.RED, Beep.RED, Beep.RED, Beep.GO]);
    expect(log.map((b) => b.step)).toEqual([1, 2, 3, 4]);
  });

  test("each beep falls on the frame its lamp changes", () => {
    const log = run_start(3);
    const changes: number[] = [];
    let last = 0;
    for (let t = 0; t < COUNTDOWN_MS + GREEN_MS * 2; t += FRAME_MS) {
      const countdown = Math.max(0, COUNTDOWN_MS - t);
      const step = start_step(countdown, countdown > 0 ? -1 : t - COUNTDOWN_MS, 3);
      if (step !== last && step !== 0) changes.push(t);
      last = step;
    }
    expect(log.map((b) => b.at)).toEqual(changes);
    expect(log[0].at).toBe(0);
    expect(log[3].at).toBeGreaterThanOrEqual(COUNTDOWN_MS);
    expect(log[3].at).toBeLessThan(COUNTDOWN_MS + FRAME_MS);
  });

  test("going dark is silent, and a held step never beeps twice", () => {
    const steps = new StartSteps(3);
    expect(steps.next(0, GREEN_MS * 5)).toBeNull();
    expect(steps.next(2500, -1)).toBe(Beep.RED);
    expect(steps.next(2400, -1)).toBeNull();
    expect(steps.next(0, 0)).toBe(Beep.GO);
    expect(steps.next(0, GREEN_MS)).toBeNull();
    expect(steps.step).toBe(0);
  });

  test("a reset start beeps from its first lamp again", () => {
    const steps = new StartSteps(3);
    steps.next(500, -1);
    steps.reset();
    expect(steps.next(COUNTDOWN_MS, -1)).toBe(Beep.RED);
    expect(steps.step).toBe(1);
  });
});

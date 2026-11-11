/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Rumble, RumbleLevel, sense_drive, type RumbleEffect, type RumbleSense } from "./rumble";

const FRAME = 1000 / 60;
const calm: RumbleSense = { scrub: 0, speed: 20, loose: 0, edge: 0, airborne: false, vy: 0, impact: 0 };

/** Drives `rumble` for `seconds` of 60 Hz frames from `at` ms, sense from `sense(t)`; returns the effects it asked for, copied. */
function drive(rumble: Rumble, seconds: number, sense: (t: number) => RumbleSense, at = 0): (RumbleEffect & { at: number })[] {
  const out: (RumbleEffect & { at: number })[] = [];
  for (let t = 0; t < seconds * 1000; t += FRAME) {
    const effect = rumble.update(at + t, FRAME / 1000, sense(t / 1000));
    if (effect) out.push({ ...effect, at: at + t });
  }
  return out;
}

describe("rumble", () => {
  test("off never asks the pad for anything", () => {
    const rumble = new Rumble();
    rumble.level = RumbleLevel.OFF;
    expect(drive(rumble, 2, () => ({ ...calm, scrub: 1, loose: 1, edge: 1, impact: 20 }))).toEqual([]);
  });

  test("a clean drive on asphalt is silent", () => {
    expect(drive(new Rumble(), 3, () => calm)).toEqual([]);
  });

  test("a held slide is rate-limited: at most ten calls a second, and the effects overlap with no gap", () => {
    const effects = drive(new Rumble(), 3, (t) => ({ ...calm, scrub: 0.5 + 0.4 * Math.sin(t * 9) }));
    expect(effects.length).toBeLessThanOrEqual(31);
    expect(effects.length).toBeGreaterThan(10);
    for (let i = 1; i < effects.length; i++) {
      expect(effects[i].at - effects[i - 1].at).toBeGreaterThanOrEqual(100 - 1e-9);
      expect(effects[i].at).toBeLessThan(effects[i - 1].at + effects[i - 1].ms);
    }
  });

  test("an unchanged buzz is only refreshed before it runs out", () => {
    const effects = drive(new Rumble(), 3, () => ({ ...calm, loose: 0.8 }));
    expect(effects.length).toBeLessThanOrEqual(19);
    for (let i = 1; i < effects.length; i++) expect(effects[i].at).toBeLessThan(effects[i - 1].at + effects[i - 1].ms);
  });

  test("scrub past the peak, loose ground and the kerb strip each buzz, harder on Strong than Subtle", () => {
    for (const sense of [{ scrub: 0.6 }, { loose: 0.8 }, { edge: 1 }]) {
      const [subtle] = drive(new Rumble(), 0.2, () => ({ ...calm, ...sense }));
      const strong_rumble = new Rumble();
      strong_rumble.level = RumbleLevel.STRONG;
      const [strong] = drive(strong_rumble, 0.2, () => ({ ...calm, ...sense }));
      expect(subtle.weak).toBeGreaterThan(0.05);
      expect(strong.weak).toBeGreaterThan(subtle.weak * 1.5);
      expect(subtle.pulse).toBe(false);
    }
  });

  test("subtle by default: a full slide on sand stays under half the motors", () => {
    const rumble = new Rumble();
    expect(rumble.level).toBe(RumbleLevel.SUBTLE);
    for (const effect of drive(rumble, 1, () => ({ ...calm, scrub: 1, loose: 1, speed: 40 }))) {
      expect(effect.weak).toBeLessThan(0.5);
      expect(effect.strong).toBeLessThan(0.5);
    }
  });

  test("standing still on gravel is silent", () => {
    expect(drive(new Rumble(), 1, () => ({ ...calm, speed: 0, loose: 1, scrub: 0.3 }))).toEqual([]);
  });

  test("a hit knocks at once, cutting into a held buzz, and the buzz waits for it to end", () => {
    const rumble = new Rumble();
    drive(rumble, 0.5, () => ({ ...calm, scrub: 0.8 }));
    const [knock, ...after] = drive(rumble, 0.5, (t) => ({ ...calm, scrub: 0.8, impact: t === 0 ? 12 : 0 }), 500);
    expect(knock).toMatchObject({ at: 500, pulse: true });
    expect(knock.strong).toBeGreaterThan(knock.weak);
    expect(after[0].at).toBeGreaterThanOrEqual(500 + knock.ms);
    expect(drive(new Rumble(), 0.1, (t) => ({ ...calm, impact: t === 0 ? 1.5 : 0 }))).toEqual([]);
  });

  test("a landing knocks by how hard it sinks; a wheel skipping a bump does not", () => {
    const jump = (air: number, vy: number) => drive(new Rumble(), air + 0.3, (t) => (t < air ? { ...calm, airborne: true, vy } : calm)).filter((e) => e.pulse);
    const [soft] = jump(0.6, -4);
    const [hard] = jump(0.6, -9);
    expect(soft.strong).toBeGreaterThan(0);
    expect(hard.strong).toBeGreaterThan(soft.strong * 2);
    expect(jump(0.1, -6)).toEqual([]);
    expect(jump(0.6, -1)).toEqual([]);
  });

  test("in the air the tyres and ground go quiet", () => {
    const effects = drive(new Rumble(), 1, () => ({ ...calm, airborne: true, vy: 2, scrub: 1, loose: 1 }));
    expect(effects).toEqual([]);
  });
});

describe("sense_drive", () => {
  const wheel = (x: number, contact = true) => ({ contact, point: { x, z: 0 } });
  const ground = { footing: (x: number) => ({ loose: x > 0 ? 0.8 : 0 }), on_edge: (x: number) => x === -1 };
  const vel = { y: -3, length: () => 20 };

  test("averages the ground under the wheels that touch it", () => {
    const sense = sense_drive({ ...calm }, { scrub: 0.4, vel, wheels: [wheel(1), wheel(1), wheel(-1), wheel(-2), wheel(5, false)] }, ground, 7);
    expect(sense).toEqual({ scrub: 0.4, speed: 20, loose: 0.4, edge: 0.25, airborne: false, vy: -3, impact: 7 });
  });

  test("no wheel down is airborne, with nothing under it", () => {
    const sense = sense_drive({ ...calm }, { scrub: 0, vel, wheels: [wheel(1, false), wheel(-1, false)] }, ground, 0);
    expect(sense).toMatchObject({ airborne: true, loose: 0, edge: 0, vy: -3 });
  });
});

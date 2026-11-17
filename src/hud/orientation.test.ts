import { describe, expect, test } from "bun:test";
import { Turn, rotate_shown, turn_step, type TurnState } from "./orientation";

const phone: TurnState = { touch: true, lockable: true, upright: false, prompt: false, fullscreen: false, installed: false, refused: false, tap: false, locked: false };
const app: TurnState = { ...phone, installed: true };

describe("rotate_shown", () => {
  test("the prompt covers the road, never the menu", () => {
    expect(rotate_shown(true, false)).toBe(true);
    expect(rotate_shown(true, true)).toBe(false);
    expect(rotate_shown(false, false)).toBe(false);
  });
});

describe("turn_step", () => {
  test("a desktop and a phone with no screen lock are left alone", () => {
    expect(turn_step({ ...app, touch: false, upright: true, prompt: true, tap: true })).toBe(Turn.NONE);
    expect(turn_step({ ...app, lockable: false, upright: true, prompt: true, tap: true })).toBe(Turn.NONE);
  });

  test("an installed app reloaded upright keeps its menu upright", () => {
    expect(turn_step({ ...app, upright: true })).toBe(Turn.NONE);
    expect(turn_step({ ...app, upright: true, tap: true })).toBe(Turn.NONE);
  });

  test("on the road upright the installed app locks without a tap", () => {
    expect(turn_step({ ...app, upright: true, prompt: true })).toBe(Turn.LOCK);
  });

  test("a reload in landscape takes the lock again", () => {
    expect(turn_step(app)).toBe(Turn.LOCK);
    expect(turn_step({ ...app, locked: true })).toBe(Turn.NONE);
  });

  test("a lock that was lost shows as upright and is asked for again", () => {
    expect(turn_step({ ...app, locked: true, upright: true, prompt: true })).toBe(Turn.LOCK);
  });

  test("a browser tab needs a tap, and goes through fullscreen", () => {
    expect(turn_step({ ...phone, upright: true, prompt: true })).toBe(Turn.NONE);
    expect(turn_step({ ...phone, upright: true, prompt: true, tap: true })).toBe(Turn.FULLSCREEN);
    expect(turn_step({ ...phone, tap: true })).toBe(Turn.FULLSCREEN);
    expect(turn_step({ ...phone, fullscreen: true })).toBe(Turn.LOCK);
  });

  test("an installed app whose plain lock was refused falls back to fullscreen on a tap", () => {
    expect(turn_step({ ...app, refused: true, upright: true, prompt: true })).toBe(Turn.NONE);
    expect(turn_step({ ...app, refused: true, upright: true, prompt: true, tap: true })).toBe(Turn.FULLSCREEN);
    expect(turn_step({ ...app, refused: true, fullscreen: true, upright: true, prompt: true })).toBe(Turn.LOCK);
  });
});

import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { DEFAULT_BINDINGS } from "../hud/bindings";
import type { Store } from "../modes/track";
import FirstRunStrip from "./FirstRun.svelte";
import { FIRST_STEPS, FirstRun, first_steps } from "./first-run";
import { FirstRunView } from "./first-run-view.svelte";
import { GoalId, Goals } from "./goals";

function memory(): Store {
  const data: Record<string, string> = {};
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
}

interface Flag {
  distance: number | null;
  turn: number;
  away: boolean;
}

function fresh(flag: Flag) {
  const goals = new Goals(memory(), []);
  const toasts: string[] = [];
  goals.on_done = (goal) => toasts.push(goal.id);
  const view = new FirstRunView({ goals, flag, bindings: () => DEFAULT_BINDINGS, touch_steer: () => "buttons", input: () => "touch", open_steps: () => {} });
  return { goals, toasts, view };
}

const AWAY: Flag = { distance: null, turn: 0, away: true };
const strip = (view: FirstRunView) => render(FirstRunStrip, { props: { view } }).body;

test("with the first flag on another map step three is the travel, and no lap or distance ends it", () => {
  expect(first_steps(false)).toEqual([...FIRST_STEPS]);
  expect(first_steps(true)).toEqual(["Drive", "Steer", "Travel to the flag"]);
  const run = new FirstRun();
  run.update(9, 0, null);
  run.update(9, 0.7, null);
  for (let i = 0; i < 1000; i++) run.update(30, i * 0.1, null);
  expect(run.step).toBe(2);
  expect(run.over).toBe(false);
});

test("a fresh profile away from the first flag: the strip says travel, and the travel ends the first run", () => {
  const { goals, toasts, view } = fresh(AWAY);
  view.update(9, 0, true);
  view.update(9, 0.7, true);
  expect(view.step).toBe(2);
  const html = strip(view);
  expect(html).toContain("Travel to the flag");
  expect(html).not.toContain("Reach the flag");
  view.reach();
  expect(goals.is_done(GoalId.FLAG)).toBe(true);
  expect(toasts).toEqual(["flag"]);
  expect(view.shown).toBe(false);
  view.update(9, 0, true);
  expect(view.shown).toBe(false);
});

test("the strip has a skip that ends the first run for good, without a goal toast", () => {
  const { goals, toasts, view } = fresh(AWAY);
  view.update(0, 0, true);
  expect(strip(view)).toContain('aria-label="Skip the first run"');
  view.skip();
  expect(view.shown).toBe(false);
  expect(toasts).toEqual([]);
  view.update(9, 0, true);
  expect(view.shown).toBe(false);
  expect(goals.is_done(GoalId.FLAG)).toBe(true);
});

test("the first run ended elsewhere (Settings, Guide) takes the strip off the road", () => {
  const { goals, view } = fresh({ distance: 300, turn: 0, away: false });
  view.update(0, 0, true);
  expect(view.shown).toBe(true);
  expect(strip(view)).toContain("Reach the flag");
  goals.skip(GoalId.FLAG);
  view.update(0, 0, true);
  expect(view.shown).toBe(false);
});

test("on the flag's own map reaching it ends the first run with its toast", () => {
  const flag: Flag = { distance: 300, turn: 0, away: false };
  const { goals, toasts, view } = fresh(flag);
  view.update(9, 0, true);
  flag.distance = 20;
  view.update(9, 0, true);
  expect(goals.is_done(GoalId.FLAG)).toBe(true);
  expect(toasts).toEqual(["flag"]);
  expect(view.shown).toBe(false);
});

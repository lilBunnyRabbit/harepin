import { expect, test } from "bun:test";
import { DEFAULT_BUILD, DEFAULT_PARTS } from "../car/build";
import type { Store } from "../modes/track";
import { WorldKind } from "../worldgen/types";
import { build_goals, proven } from "./catch-up";
import { FIRST_STEPS, FirstRun } from "./first-run";
import { GOALS, GOALS_KEY, GoalId, Goals, parse_done } from "./goals";

const MODES = ["race", "drift"];

function memory(seed: Record<string, string> = {}): Store & { data: Record<string, string> } {
  const data = { ...seed };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
}

test("saved ids are untrusted: unknown ids and non-strings drop", () => {
  expect([...parse_done(["lap", "nope", 4, "mode:race", "mode:fly"], MODES)]).toEqual(["lap", "mode:race"]);
  expect(parse_done({ lap: true }, MODES).size).toBe(0);
});

test("done persists once and calls back once", () => {
  const store = memory();
  const goals = new Goals(store, MODES);
  const seen: string[] = [];
  goals.on_done = (goal) => seen.push(goal.id);
  goals.done(GoalId.LAP);
  goals.done(GoalId.LAP);
  expect(seen).toEqual(["lap"]);
  expect(new Goals(store, MODES).is_done(GoalId.LAP)).toBe(true);
});

test("every mode played finishes the modes goal", () => {
  const goals = new Goals(memory(), MODES);
  goals.played("race");
  expect(goals.steps(GoalId.MODES)).toEqual({ done: 1, total: 2 });
  goals.played("drift");
  expect(goals.is_done(GoalId.MODES)).toBe(true);
});

test("done goals sort after open ones", () => {
  const goals = new Goals(memory({ [GOALS_KEY]: JSON.stringify(["sky"]) }), MODES);
  const sorted = goals.sorted();
  expect(sorted.at(-1)?.id).toBe(GoalId.SKY);
  expect(sorted.length).toBe(GOALS.length);
});

test("catch up marks without a toast", () => {
  const goals = new Goals(memory(), MODES);
  let toasts = 0;
  goals.on_done = () => toasts++;
  goals.catch_up(() => ["lap", "mode:race", "mode:drift", "bogus"]);
  expect(toasts).toBe(0);
  expect(goals.count).toBe(2);
  goals.done(GoalId.SKY);
  expect(toasts).toBe(1);
});

test("saved records prove goals", () => {
  const ids = proven(
    [
      ["harepin:best:42:w3", "61234"],
      ["harepin:race:7:sky3", JSON.stringify({ r1: { stars: 2, ms: 50000 } })],
      ["harepin:drift:42:w3", "{}"],
      ["harepin:builds", JSON.stringify([{ name: "Mine", code: "coupe.0.0.0.1.0" }])],
    ],
    { kind: WorldKind.ISLAND, build: DEFAULT_BUILD, cockpit: false },
    MODES,
  );
  expect(ids.sort()).toEqual(["build", "flag", "lap", "mode:race", "new_map", "sky"]);
});

test("a build shows what was changed in the garage", () => {
  expect(build_goals(DEFAULT_BUILD)).toEqual([]);
  expect(build_goals({ ...DEFAULT_BUILD, car: "coupe", parts: DEFAULT_PARTS })).toEqual([]);
  expect(build_goals({ ...DEFAULT_BUILD, car: "bus", paint: 3, parts: { ...DEFAULT_BUILD.parts, engine: 2 } })).toEqual(["car", "bus", "tune", "paint"]);
});

test("one map number on both worlds is not a new map", () => {
  const ids = proven(
    [
      ["harepin:best:42:w3", "61234"],
      ["harepin:best:42:sky3", "51234"],
    ],
    { kind: WorldKind.ISLAND, build: DEFAULT_BUILD, cockpit: false },
    MODES,
  );
  expect(ids).not.toContain("new_map");
});

test("catch up skips the scan once every goal is done", () => {
  const goals = new Goals(memory({ [GOALS_KEY]: JSON.stringify(GOALS.map((goal) => goal.id)) }), MODES);
  let scanned = false;
  goals.catch_up(() => {
    scanned = true;
    return [];
  });
  expect(scanned).toBe(false);
});

test("the first steps open on the flag, then a lap, then the two settings worth a look", () => {
  expect(GOALS.slice(0, 4).map((goal) => goal.id)).toEqual([GoalId.FLAG, GoalId.LAP, GoalId.HANDLING, GoalId.THEME]);
  expect(GOALS.filter((goal) => goal.id === GoalId.HANDLING || goal.id === GoalId.THEME).map((goal) => goal.go)).toEqual(["driving", "display"]);
  const goals = new Goals(memory(), MODES);
  expect(goals.next?.id).toBe(GoalId.FLAG);
  goals.done(GoalId.FLAG);
  expect(goals.next?.id).toBe(GoalId.LAP);
});

test("a picked theme and a changed aid prove their goals; stock settings prove nothing", () => {
  const now = { kind: WorldKind.ISLAND, build: DEFAULT_BUILD, cockpit: false };
  expect(proven([["harepin:settings", JSON.stringify({ tcs: true, volume: 0.2 })]], now, MODES)).toEqual([]);
  expect(proven([["harepin:theme", "Forest Night"], ["harepin:settings", JSON.stringify({ tcs: false })]], now, MODES).sort()).toEqual(["handling", "theme"]);
});

test("the first run goes drive, steer, flag, and the flag ends it from any step", () => {
  const run = new FirstRun();
  expect(run.update(2, 0, 300)).toBe(false);
  expect(run.update(9, 0, 290)).toBe(true);
  expect(FIRST_STEPS[run.step]).toBe("Steer");
  run.update(9, 0.2, 280);
  expect(run.step).toBe(1);
  run.update(9, -0.3, 270);
  expect(FIRST_STEPS[run.step]).toBe("Reach the flag");
  expect(run.update(9, -0.3, 20)).toBe(true);
  expect(run.over).toBe(true);
  const straight = new FirstRun();
  straight.update(1, 0, 10);
  expect(straight.over).toBe(true);
});

test("turning on the spot is not steering", () => {
  const run = new FirstRun();
  run.update(9, 0, null);
  for (let i = 0; i < 20; i++) run.update(1, i * 0.5, null);
  expect(run.step).toBe(1);
});

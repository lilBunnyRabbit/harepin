import { expect, test } from "bun:test";
import { DEFAULT_BUILD, build_code } from "../car/build";
import { BUILDS_KEY, MAX_BUILDS } from "../car/builds";
import { CAREER_KEY, Career } from "../career/career-store";
import { GOALS_KEY, GoalId, Goals } from "../goals/goals";
import { Runs, RUNS_KEY } from "../runs/runs-store";
import { season_of } from "../runs/runs";
import { SEASON_STEP, reached } from "../runs/season";
import { CachedStore } from "./cached-store";
import { plan_sweep, record_families } from "./sweep";

const MODE_IDS = ["race", "drift"];
const FAMILIES = record_families(MODE_IDS);

const family = (key: string) => {
  const found = FAMILIES.find((f) => f.owns(key));
  if (!found || !("merge" in found)) throw new Error(`no merging family owns ${key}`);
  return found;
};
const merge = (key: string, kept: unknown, other: unknown) => family(key).merge(kept, other);

test("every record key local_store() writes has a family; settings, theme, build, name, seen version and ghosts do not", () => {
  for (const key of ["harepin:race:1:island", "harepin:drift:7:dunes", "harepin:career:e1:3:island", "harepin:run:2026-11-13:1:island", "harepin:run:l3:hard:1:island", "harepin:lobby:1:island", CAREER_KEY, RUNS_KEY, GOALS_KEY, BUILDS_KEY, "harepin:best:1:island", "harepin:splits:1:island"])
    expect(FAMILIES.some((f) => f.owns(key))).toBe(true);
  for (const key of ["harepin:settings", "harepin:theme", "harepin:themes", "harepin:build", "harepin:rolled-name", "harepin:seen-version", "harepin:ghost:1:island", "harepin:hunt:1:island", "harepin.cars.notes"])
    expect(FAMILIES.some((f) => f.owns(key))).toBe(false);
});

test("track runs merge per id, the better run wins either way round", () => {
  const key = "harepin:race:1:island";
  const a = { l1: { stars: 2, ms: 50_000 }, l2: { stars: 1, ms: 90_000 } };
  const b = { l1: { stars: 2, ms: 48_000 }, l3: { stars: 3, ms: 30_000 }, l2: { stars: 1, ms: 95_000 } };
  const want = { l1: { stars: 2, ms: 48_000 }, l2: { stars: 1, ms: 90_000 }, l3: { stars: 3, ms: 30_000 } };
  expect(merge(key, a, b)).toEqual(want);
  expect(merge(key, b, a)).toEqual(want);
  expect(merge("harepin:career:e1:1:island", { cup: { stars: 2, ms: 1, score: 40 } }, { cup: { stars: 2, ms: 1, score: 55 } })).toEqual({ cup: { stars: 2, ms: 1, score: 55 } });
  expect(merge(key, "junk", { l1: { stars: 0, ms: 5 }, l2: { stars: 1, ms: 9 } })).toEqual({ l2: { stars: 1, ms: 9 } });
});

test("career stars merge to the most per event", () => {
  expect(merge(CAREER_KEY, { stars: { a: 1, b: 3 } }, { stars: { a: 2, c: 1 } })).toEqual({ stars: { a: 2, b: 3, c: 1 } });
  expect(merge(CAREER_KEY, null, { stars: { a: 2 } })).toEqual({ stars: { a: 2 } });
  expect(merge(CAREER_KEY, { stars: { a: 2 } }, [1, 2])).toEqual({ stars: { a: 2 } });
});

test("lobby records keep the faster best per lap count and the larger tally", () => {
  const key = "harepin:lobby:1:island";
  expect(merge(key, { best: { 1: 60_000, 3: 200_000 }, podiums: 4, wins: 1 }, { best: { 1: 58_000, 5: 300_000 }, podiums: 3, wins: 2 })).toEqual({ best: { 1: 58_000, 3: 200_000, 5: 300_000 }, podiums: 4, wins: 2 });
  expect(merge(key, { best: { 1: 60_000 }, podiums: 1, wins: 0 }, "{")).toEqual({ best: { 1: 60_000 }, podiums: 1, wins: 0 });
});

test("goals merge as a union of known ids", () => {
  expect(new Set(merge(GOALS_KEY, [GoalId.SKY, "mode:race"], [GoalId.SKY, GoalId.BUILD, "bogus", 4]) as string[])).toEqual(new Set([GoalId.SKY, "mode:race", GoalId.BUILD]));
  expect(merge(GOALS_KEY, null, null)).toEqual([]);
});

const NOW = new Date("2027-03-10T10:00:00Z");
const SEASON = season_of("2027-03-10");
const LAST = season_of(new Date(Date.parse(`${SEASON}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10));

test("runs in the same season keep the most stars per day, week and free day, and every reward", () => {
  const a = { season: SEASON, stars: 9, days: { "2026-11-12": 3 }, weeks: {}, free: { "2027-03-10": 4 }, owned: ["tint-a"], wear: {} };
  const b = { season: SEASON, stars: 7, days: { "2026-11-12": 2, "2026-11-11": 3 }, weeks: { "2026-W46": 2 }, free: { "2027-03-10": 6 }, owned: [], wear: {} };
  const merged = merge(RUNS_KEY, a, b) as Record<string, unknown>;
  expect(merged).toMatchObject({ season: SEASON, stars: 9, days: { "2026-11-12": 3, "2026-11-11": 3 }, weeks: { "2026-W46": 2 }, free: { "2027-03-10": 6 } });
  expect(merge(RUNS_KEY, b, a)).toMatchObject({ season: SEASON, stars: 9 });
});

test("runs across a season boundary keep the later season and pay out the earlier one's rewards", () => {
  expect(LAST < SEASON).toBe(true);
  const old = { season: LAST, stars: SEASON_STEP * 2, days: { [LAST]: 3 }, weeks: {}, free: {}, owned: [], wear: {} };
  const now = { season: SEASON, stars: 5, days: { "2027-03-10": 3 }, weeks: {}, free: {}, owned: [], wear: {} };
  const rewards = reached(SEASON_STEP * 2, LAST);
  expect(rewards.length).toBe(2);
  for (const [kept, other] of [
    [old, now],
    [now, old],
  ]) {
    const merged = merge(RUNS_KEY, kept, other) as Record<string, unknown>;
    expect(merged).toMatchObject({ season: SEASON, stars: 5, days: { "2027-03-10": 3 } });
    expect(new Set(merged.owned as string[])).toEqual(new Set(rewards));
    const store = new CachedStore(new Map([[RUNS_KEY, JSON.stringify(merged)]]), () => {});
    const runs = new Runs(store, () => NOW);
    expect(runs.stars).toBe(5);
    expect(new Set(runs.owned)).toEqual(new Set(rewards));
  }
});

test("a malformed runs save merges as empty", () => {
  const now = { season: SEASON, stars: 5, days: {}, weeks: {}, free: {}, owned: [], wear: {} };
  expect(merge(RUNS_KEY, "junk", now)).toMatchObject({ season: SEASON, stars: 5 });
  expect(merge(RUNS_KEY, now, null)).toMatchObject({ season: SEASON, stars: 5 });
  expect(merge(RUNS_KEY, null, null)).toEqual({ owned: [], wear: {} });
});

test("the sweep copies what IndexedDB lacks verbatim, merges what both hold, and skips other keys", () => {
  const stored: [unknown, unknown][] = [
    [CAREER_KEY, JSON.stringify({ stars: { a: 1 } })],
    ["harepin:race:1:island", JSON.stringify({ l1: { stars: 3, ms: 10 } })],
    [7, "not a string key"],
    ["harepin:goals", { not: "a string value" }],
  ];
  const local: [string, string][] = [
    [CAREER_KEY, JSON.stringify({ stars: { a: 2 } })],
    ["harepin:race:1:island", JSON.stringify({ l1: { stars: 3, ms: 12 } })],
    ["harepin:drift:1:island", "{broken"],
    ["harepin:settings", "{}"],
    ["harepin:ghost:1:island", "[]"],
  ];
  const plan = plan_sweep(stored, local, FAMILIES);
  expect(plan.writes).toEqual([
    [CAREER_KEY, JSON.stringify({ stars: { a: 2 } })],
    ["harepin:drift:1:island", "{broken"],
  ]);
  expect(plan.swept.map(([key]) => key)).toEqual([CAREER_KEY, "harepin:race:1:island", "harepin:drift:1:island"]);
  expect(plan.values.get("harepin:race:1:island")).toBe(JSON.stringify({ l1: { stars: 3, ms: 10 } }));
  expect(plan.values.has("harepin:goals")).toBe(false);
  expect(plan.values.has("harepin:settings")).toBe(false);
});

test("a second sweep over its own result writes nothing", () => {
  const local: [string, string][] = [
    [CAREER_KEY, JSON.stringify({ stars: { a: 2 } })],
    [GOALS_KEY, JSON.stringify([GoalId.SKY])],
  ];
  const first = plan_sweep([], local, FAMILIES);
  const second = plan_sweep(first.values, local, FAMILIES);
  expect(second.writes).toEqual([]);
  expect(second.values).toEqual(first.values);
});

test("the cache reads back its own writes at once and persists each one", () => {
  const persisted: [string, string][] = [];
  const store = new CachedStore(new Map([[CAREER_KEY, JSON.stringify({ stars: { a: 1 } })]]), (key, value) => persisted.push([key, value]));
  const career = new Career(store);
  expect(career.stars).toEqual({ a: 1 });
  const goals = new Goals(store, MODE_IDS);
  goals.done(GoalId.SKY);
  expect(store.getItem(GOALS_KEY)).toBe(JSON.stringify([GoalId.SKY]));
  expect(new Goals(store, MODE_IDS).is_done(GoalId.SKY)).toBe(true);
  expect(persisted).toEqual([[GOALS_KEY, JSON.stringify([GoalId.SKY])]]);
  expect(store.getItem("harepin:missing")).toBeNull();
  expect([...store.entries()].map(([key]) => key)).toEqual([CAREER_KEY, GOALS_KEY]);
});

test("saved builds keep IndexedDB's list, then the other's names it lacks, up to the cap", () => {
  const code = build_code(DEFAULT_BUILD);
  const named = (names: string[]) => names.map((name) => ({ name, code }));
  expect(merge(BUILDS_KEY, named(["A", "B"]), named(["b", "C"]))).toEqual(named(["A", "B", "C"]));
  expect(merge(BUILDS_KEY, null, [...named(["X"]), { name: "bad", code: "?" }])).toEqual(named(["X"]));
  const many = Array.from({ length: MAX_BUILDS }, (_, i) => `n${i}`);
  expect((merge(BUILDS_KEY, named(many), named(["extra"])) as unknown[]).length).toBe(MAX_BUILDS);
});

const BEST = "harepin:best:1:island";
const SPLITS = "harepin:splits:1:island";

test("the faster best lap wins and its splits go with it", () => {
  const idb: [string, string][] = [
    [BEST, "60000"],
    [SPLITS, "[20000,40000]"],
  ];
  const faster: [string, string][] = [
    [SPLITS, "[19000,38000]"],
    [BEST, "58000"],
  ];
  const won = plan_sweep(idb, faster, FAMILIES);
  expect(won.values.get(BEST)).toBe("58000");
  expect(won.values.get(SPLITS)).toBe("[19000,38000]");
  expect(won.swept.map(([key]) => key).sort()).toEqual([BEST, SPLITS]);
  const slower: [string, string][] = [
    [BEST, "61000"],
    [SPLITS, "[21000,41000]"],
  ];
  const lost = plan_sweep(idb, slower, FAMILIES);
  expect(lost.writes).toEqual([]);
  expect(lost.values.get(SPLITS)).toBe("[20000,40000]");
  expect(lost.swept.length).toBe(2);
  const fresh = plan_sweep([], slower, FAMILIES);
  expect(fresh.values.get(BEST)).toBe("61000");
  expect(fresh.values.get(SPLITS)).toBe("[21000,41000]");
  expect(plan_sweep(idb, [[BEST, "junk"]], FAMILIES).values.get(BEST)).toBe("60000");
});

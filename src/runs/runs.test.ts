import { expect, test } from "bun:test";
import { DRIFT_LEVELS } from "../modes/drift";
import { DUEL_LEVELS } from "../modes/duel";
import { LEVELS as GYMKHANA_LEVELS } from "../modes/gymkhana";
import { HUNT_LEVELS } from "../modes/hunt";
import { JUMP_LEVELS } from "../modes/jump";
import { PARK_LEVELS } from "../modes/parking";
import { race_levels } from "../modes/races";
import type { Store } from "../modes/track";
import { pick_world } from "../world/world-pick";
import { FREE_CAP, Runs, RUNS_KEY, parse_runs_save, run_track } from "./runs-store";
import {
  Difficulty,
  FALLBACK,
  RUN_TYPES,
  RunType,
  custom,
  daily,
  options_code,
  parse_options,
  random,
  resolve,
  run_of,
  scale,
  season_days_left,
  season_of,
  type RunPick,
  type RunProbe,
} from "./runs";

const ROUTES = ["circuit", "circuit-rev", "street-1", "street-2", "offroad-1", "offroad-2", "descent", "sprint"];
const MODE_LEVELS: Record<string, readonly string[]> = {
  race: race_levels(ROUTES.map((id) => ({ id })), "island").map((l) => l.id),
  drift: DRIFT_LEVELS.map((l) => l.id),
  jump: JUMP_LEVELS.map((l) => l.id),
  hunt: HUNT_LEVELS.map((l) => l.id),
  gymkhana: GYMKHANA_LEVELS.map((l) => l.id),
  parking: PARK_LEVELS.map((l) => l.id),
  duel: DUEL_LEVELS.map((l) => l.id),
};

test("every run type names real levels of its mode, and its choices narrow to them", () => {
  for (const type of RUN_TYPES) {
    for (const level of type.levels) expect(MODE_LEVELS[type.mode]).toContain(level);
    for (const option of type.choice?.options ?? []) for (const level of option.levels ?? []) expect(type.levels).toContain(level);
    expect(type.kinds.length).toBeGreaterThan(0);
  }
});

test("a daily is the same pick for a date, and its param reads back to it", () => {
  const a = daily("2026-11-13");
  expect(daily("2026-11-13")).toEqual(a);
  expect(run_of(a.id)).toEqual(a);
  expect(a.id).toBe("daily:2026-11-13");
  const week = ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"].map((d) => daily(d));
  expect(new Set(week.map((p) => `${p.type}:${p.kind}:${p.seed}`)).size).toBe(week.length);
});

test("random and custom picks round-trip through their param", () => {
  const r = random(123456);
  expect(run_of(r.id)).toEqual(r);
  const options = { type: RunType.JUMP, kind: null, choice: "big", difficulty: Difficulty.HARD, car: { preset: "Dirt rally" }, laps: 1 };
  const c = custom(options, 98765);
  expect(c.id).toBe(`custom:${options_code(options, 98765)}`);
  expect(run_of(c.id)).toEqual(c);
  expect(c.type).toBe(RunType.JUMP);
  expect(c.levels[0]).toBe("j2");
  expect([...c.levels].sort()).toEqual(["j1", "j2", "j3"]);
  expect(c.car).toEqual({ preset: "Dirt rally" });
  expect(c.difficulty).toBe(Difficulty.HARD);
});

test("a custom pick keeps every fixed choice; the kind only when the type runs there", () => {
  for (const type of RUN_TYPES) {
    for (const kind of type.kinds) {
      const pick = custom({ type: type.id, kind, choice: null, difficulty: Difficulty.NORMAL, car: { cap: "b" }, laps: 1 }, 7);
      expect(pick.type).toBe(type.id);
      expect(pick.kind).toBe(kind);
      expect(pick.car).toEqual({ cap: "b" });
      expect([...pick.levels].sort()).toEqual([...type.levels].sort());
    }
  }
  const sky_hunt = custom({ type: RunType.HUNT, kind: "sky", choice: null, difficulty: Difficulty.NORMAL, car: null, laps: 1 }, 7);
  expect(sky_hunt.kind).not.toBe("sky");
});

test("bad run params read as no run", () => {
  const bad = [
    null,
    "",
    "daily",
    "daily:2026-13-45",
    "daily:yesterday",
    "weekly:2026-W46",
    "random:",
    "random:-1",
    "custom:race",
    "custom:race.island.huge.1.normal.any.1",
    "custom:race.island.any.1.normal.p-nope.1",
    "custom:nope.any.any.1.normal.any.1",
    "custom:race.island.any.4.normal.any.1",
    "custom:race.island.any.normal.any.1",
  ];
  for (const param of bad) expect(run_of(param)).toBeNull();
  expect(parse_options("any.any.any.1.normal.any.zz")).not.toBeNull();
});

test("a race over laps keeps to the circuits and reads the length band off the whole run", () => {
  const pick = custom({ type: RunType.RACE, kind: "island", choice: "long", difficulty: Difficulty.NORMAL, car: null, laps: 3 }, 11);
  expect([...pick.levels].sort()).toEqual(["circuit", "circuit-rev"]);
  expect(pick.laps).toBe(3);
  expect(run_of(pick.id)).toEqual(pick);
  expect(custom({ type: RunType.DRIFT, kind: null, choice: null, difficulty: Difficulty.NORMAL, car: null, laps: 3 }, 11).laps).toBe(1);
  const routes = probe({ race: ["circuit", "street-1"] }, { circuit: 1300, "street-1": 2400 });
  const medium = pick_of(RunType.RACE, ["street-1", "circuit"], [2000, 3500]);
  expect(resolve(medium, routes).level).toBe("street-1");
  expect(resolve({ ...medium, laps: 2 }, routes).level).toBe("circuit");
});

const probe = (levels: Record<string, string[]>, lengths: Record<string, number> = {}): RunProbe => ({
  levels: (mode) => levels[mode] ?? [],
  length: (level) => lengths[level] ?? null,
});

const pick_of = (type: RunType, levels: string[], band: [number, number] | null = null): RunPick => ({ ...daily("2026-11-13"), type, levels, band });

test("resolve plays the first level the map has, else the map's circuit race", () => {
  expect(resolve(pick_of(RunType.DRIFT, ["d4", "d2"]), probe({ drift: ["d1", "d2", "d3"] }))).toEqual({ mode: "drift", level: "d2", fallback: false });
  expect(resolve(pick_of(RunType.PARKING, ["p1"]), probe({ parking: [] }))).toEqual({ ...FALLBACK, fallback: true });
  expect(resolve(pick_of(RunType.CHAIN, ["d6"]), probe({ drift: ["d6"] }))).toEqual({ mode: "drift", level: "d6", fallback: false });
  expect(resolve(pick_of(RunType.TRAP, ["trap"]), probe({ race: ["circuit", "trap"] }))).toEqual({ mode: "race", level: "trap", fallback: false });
});

test("a race length takes the route inside its band, else the nearest one", () => {
  const races = probe({ race: ["circuit", "street-1", "descent"] }, { circuit: 5100, "street-1": 2400, descent: 960 });
  const all = ["circuit", "street-1", "descent"];
  expect(resolve(pick_of(RunType.RACE, all, [0, 2000]), races).level).toBe("descent");
  expect(resolve(pick_of(RunType.RACE, all, [2000, 3500]), races).level).toBe("street-1");
  expect(resolve(pick_of(RunType.RACE, [...all].reverse(), [3500, Infinity]), races).level).toBe("circuit");
  const short_only = probe({ race: ["circuit"] }, { circuit: 1300 });
  expect(resolve(pick_of(RunType.RACE, ["circuit"], [3500, Infinity]), short_only).level).toBe("circuit");
});

test("difficulty scales time marks up or down and points the other way", () => {
  expect(scale({ two: 125, three: 100 }, Difficulty.NORMAL)).toEqual({ two: 125, three: 100 });
  const relaxed = scale({ two: 125, three: 100 }, Difficulty.RELAXED);
  expect(relaxed.three).toBeCloseTo(115);
  expect(relaxed.two).toBeCloseTo(143.75);
  expect(scale({ two: 125, three: 100 }, Difficulty.HARD).three).toBeCloseTo(90);
  expect(scale({ two: 200, three: 250 }, Difficulty.HARD).three).toBeCloseTo(250 / 0.9);
  expect(scale({ two: 200, three: 250 }, Difficulty.RELAXED).three).toBeCloseTo(250 / 1.15);
});

const DAY_MS = 86_400_000;
const date_at = (ms: number) => new Date(ms).toISOString().slice(0, 10);

test("seasons are 4 weeks starting on a Monday", () => {
  const season = season_of("2026-11-13");
  const start = Date.parse(season);
  expect(new Date(start).getUTCDay()).toBe(1);
  expect(season_of(season)).toBe(season);
  expect(season_days_left(season)).toBe(28);
  expect(season_of(date_at(start + 27 * DAY_MS))).toBe(season);
  expect(season_of(date_at(start + 28 * DAY_MS))).not.toBe(season);
});

class MemStore implements Store {
  readonly data = new Map<string, string>();
  getItem = (key: string) => this.data.get(key) ?? null;
  setItem = (key: string, value: string) => void this.data.set(key, value);
}

test("today's daily earns its stars once, up to its best", () => {
  const store = new MemStore();
  const runs = new Runs(store, () => new Date("2026-11-13T10:00:00Z"));
  const today = daily("2026-11-13");
  expect(runs.record(today, 1)).toEqual({ gain: 1, capped: false });
  expect(runs.record(today, 1)).toEqual({ gain: 0, capped: false });
  expect(runs.record(today, 3)).toEqual({ gain: 2, capped: false });
  expect(runs.stars).toBe(3);
  expect(runs.daily("2026-11-13")).toBe(3);
  expect(runs.free_left).toBe(FREE_CAP);
  expect(new Runs(store, () => new Date("2026-11-13T23:00:00Z")).stars).toBe(3);
});

test("endless, built and old daily runs share a 10 star cap a day", () => {
  const store = new MemStore();
  let now = new Date("2026-11-13T10:00:00Z");
  const runs = new Runs(store, () => now);
  for (let i = 0; i < 3; i++) expect(runs.record(random(i), 3).gain).toBe(3);
  expect(runs.record(daily("2026-11-12"), 3)).toEqual({ gain: 1, capped: true });
  expect(runs.record(random(9), 2)).toEqual({ gain: 0, capped: true });
  expect(runs.stars).toBe(10);
  now = new Date("2026-11-14T00:30:00Z");
  expect(runs.free_left).toBe(FREE_CAP);
  expect(runs.record(random(10), 2).gain).toBe(2);
  expect(runs.stars).toBe(12);
});

test("a new season starts the stars over; a bad save reads as empty", () => {
  const store = new MemStore();
  let now = new Date("2026-11-13T10:00:00Z");
  const runs = new Runs(store, () => now);
  runs.record(random(1), 3);
  now = new Date(Date.parse(season_of("2026-11-13")) + 28 * DAY_MS);
  expect(runs.stars).toBe(0);
  expect(new Runs(store, () => now).stars).toBe(0);
  store.setItem(RUNS_KEY, "{not json");
  expect(new Runs(store, () => now).stars).toBe(0);
  expect(parse_runs_save({ season: "x", stars: 5 }, "y").stars).toBe(0);
  expect(parse_runs_save({ season: "y", stars: -2, days: { a: 1.5 }, free: [] }, "y")).toEqual({ season: "y", stars: 0, days: {}, free: {} });
});

test("a run link picks its plain map before the kinds load; a map param wins over it", () => {
  const pick = daily("2026-11-13");
  const saved = { last_seed: null, last_world: null, last_map: null, played: true };
  expect(pick_world(new URLSearchParams({ run: pick.id }), "lobby", saved)).toEqual({ seed: pick.seed, kind: pick.kind, code: null });
  expect(pick_world(new URLSearchParams({ run: pick.id, map: "1C0000003" }), "lobby", saved).code).toBe("1C0000003");
});

test("a world picked with the type left open draws only types that run there", () => {
  for (let seed = 0; seed < 60; seed++) {
    const pick = custom({ type: null, kind: "sky", choice: null, difficulty: Difficulty.NORMAL, car: null, laps: 1 }, seed);
    expect(pick.kind).toBe("sky");
    expect(RUN_TYPES.find((t) => t.id === pick.type)?.kinds).toContain("sky");
  }
});

test("a daily date must read back as itself", () => {
  for (const bad of ["daily:2026-02-30", "daily:2026-02-29", "daily:2026-04-31", "daily:2026-00-10"]) expect(run_of(bad)).toBeNull();
  expect(run_of("daily:2028-02-29")).not.toBeNull();
});

test("a daily started before midnight UTC keeps its stars for its own date", () => {
  const store = new MemStore();
  const runs = new Runs(store, () => new Date("2026-11-14T00:05:00Z"));
  expect(runs.record(daily("2026-11-13"), 2, "2026-11-13")).toEqual({ gain: 2, capped: false });
  expect(runs.daily("2026-11-13")).toBe(2);
  expect(runs.free_left).toBe(FREE_CAP);
  expect(runs.record(daily("2026-11-13"), 3, "2026-11-14")).toEqual({ gain: 3, capped: false });
  expect(runs.free_left).toBe(FREE_CAP - 3);
});

test("relaxed, normal and hard runs keep separate bests", () => {
  const store = new MemStore();
  const at = (difficulty: Difficulty, laps = 1) => run_track(custom({ type: RunType.RACE, kind: "island", choice: null, difficulty, car: null, laps }, 5), "circuit", store, 5, "island", []);
  at(Difficulty.HARD).record("circuit", { stars: 3, ms: 1000 });
  expect(at(Difficulty.HARD).runs.circuit?.ms).toBe(1000);
  expect(at(Difficulty.NORMAL).runs.circuit).toBeUndefined();
  expect(at(Difficulty.RELAXED).runs.circuit).toBeUndefined();
  expect(at(Difficulty.HARD, 3).runs.circuit).toBeUndefined();
});

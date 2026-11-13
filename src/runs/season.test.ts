import { expect, test } from "bun:test";
import type { Store } from "../modes/track";
import { board_rows, daily_key, same_daily } from "./daily-board";
import { RUNS_KEY, Runs, SEEN_MAX, parse_runs_keep, parse_runs_save } from "./runs-store";
import { random, season_number, season_of } from "./runs";
import { SEASON_STEP, SEASON_TRACK, clean_tag, next_step, reached, season_steps, title_text } from "./season";

class MemStore implements Store {
  readonly data = new Map<string, string>();
  getItem = (key: string) => this.data.get(key) ?? null;
  setItem = (key: string, value: string) => void this.data.set(key, value);
}

const DAY_MS = 86_400_000;
const SEASON = season_of("2026-11-13");

test("a step every 15 season stars, eight of them, alternating tint and title", () => {
  expect(SEASON_STEP).toBe(15);
  expect(SEASON_TRACK.map((r) => r.kind)).toEqual(["tint", "title", "tint", "title", "tint", "title", "tint", "title"]);
  expect([season_steps(14), season_steps(15), season_steps(500)]).toEqual([0, 1, 8]);
  expect(next_step(16)?.at).toBe(30);
  expect(next_step(120)).toBeNull();
});

test("titles carry their season's number; tints are kept by id", () => {
  expect(season_number(SEASON)).toBe(1);
  expect(season_number(season_of(new Date(Date.parse(SEASON) + 28 * DAY_MS).toISOString().slice(0, 10)))).toBe(2);
  expect(reached(31, SEASON)).toEqual(["accent", "regular.1"]);
  expect(title_text("ace.3")).toBe("S3 Ace");
  expect(title_text("king.1")).toBeNull();
});

test("a tag keeps only titles and tints from the fixed set", () => {
  expect(clean_tag({ title: "ace.2", tint: "info" })).toEqual({ title: "ace.2", tint: "info" });
  expect(clean_tag({ title: "ace", tint: "primary" })).toBeNull();
  expect(clean_tag({ title: "ace.1", tint: "#fff" })).toEqual({ title: "ace.1" });
  for (const bad of [null, "ace.1", [], { title: "ace.0" }, { title: "<b>.1" }]) expect(clean_tag(bad)).toBeNull();
});

test("rewards reached stay owned past the season, and a worn tag only shows owned ones", () => {
  const store = new MemStore();
  let now = new Date("2026-11-13T10:00:00Z");
  const runs = new Runs(store, () => now);
  for (let day = 0; day < 4; day++) {
    now = new Date(Date.parse("2026-11-13T10:00:00Z") + day * DAY_MS);
    runs.record(random(day * 10), 3);
    runs.record(random(day * 10 + 1), 3);
    runs.record(random(day * 10 + 2), 3);
    runs.record(random(day * 10 + 3), 1);
  }
  expect(runs.stars).toBe(40);
  expect(runs.owned).toEqual(["accent", "regular.1"]);
  runs.wear({ title: "regular.1", tint: "info" });
  expect(runs.tag).toEqual({ title: "regular.1" });
  now = new Date(Date.parse(SEASON) + 28 * DAY_MS);
  const later = new Runs(store, () => now);
  expect(later.stars).toBe(0);
  expect(later.owned).toEqual(["accent", "regular.1"]);
  expect(later.tag).toEqual({ title: "regular.1" });
});

test("a season that ended while closed still pays out its steps", () => {
  const store = new MemStore();
  store.setItem(RUNS_KEY, JSON.stringify({ season: SEASON, stars: 16, days: {}, free: {} }));
  const runs = new Runs(store, () => new Date(Date.parse(SEASON) + 30 * DAY_MS));
  expect(runs.owned).toEqual(["accent"]);
  expect(JSON.parse(store.getItem(RUNS_KEY) ?? "{}").owned).toEqual(["accent"]);
});

test("the additions ride beside the season's fields: an old save parses, a new one parses the old way", () => {
  const old = { season: SEASON, stars: 7, days: { "2026-11-13": 3 }, free: { "2026-11-13": 4 } };
  expect(parse_runs_keep(old, "2026-11-13")).toEqual({ owned: [], wear: {}, board: { date: "2026-11-13", own: null, seen: [] } });
  const store = new MemStore();
  store.setItem(RUNS_KEY, JSON.stringify(old));
  const runs = new Runs(store, () => new Date("2026-11-13T12:00:00Z"));
  runs.wear({});
  const saved = JSON.parse(store.getItem(RUNS_KEY) ?? "{}");
  expect(parse_runs_save(saved, SEASON)).toEqual(old);
  expect(parse_runs_keep({ owned: ["accent", "x", 3, "ace.1"], wear: { title: "<b>" }, board: [] }, "2026-11-13").owned).toEqual(["accent", "ace.1"]);
});

const K = daily_key("2026-11-13", "1C0000003", "circuit", "3:w11");
const OTHER_LEVEL = daily_key("2026-11-13", "1C0000003", "street-1", "3:w11");

test("the board key: no level matches any level, anything else must match", () => {
  const want = daily_key("2026-11-13", "1C0000003", "", "3:w11");
  expect(same_daily(want, K)).toBe(true);
  expect(same_daily(K, OTHER_LEVEL)).toBe(false);
  expect(same_daily(want, daily_key("2026-11-13", "1C0000004", "circuit", "3:w11"))).toBe(false);
  expect(same_daily(want, daily_key("2026-11-12", "1C0000003", "circuit", "3:w11"))).toBe(false);
});

test("board rows: this room over the cache, the fastest first, other picks hidden", () => {
  const rows = board_rows(K, { name: "Me", k: K, ms: 61_000 }, [{ name: "Ana", k: K, ms: 60_000 }, { name: "Bo", k: OTHER_LEVEL, ms: 1 }], [
    { name: "Ana", k: K, ms: 59_000 },
    { name: "Cy", k: K, ms: 70_000 },
  ]);
  expect(rows).toEqual([
    { name: "Ana", ms: 59_000, you: false, here: true },
    { name: "Me", ms: 61_000, you: true, here: true },
    { name: "Cy", ms: 70_000, you: false, here: false },
  ]);
});

test("today's own best and the peers seen stay for the day, then clear", () => {
  const store = new MemStore();
  let now = new Date("2026-11-13T10:00:00Z");
  const runs = new Runs(store, () => now);
  expect(runs.post_daily({ k: K, ms: 62_000 })).toBe(true);
  expect(runs.post_daily({ k: K, ms: 63_000 })).toBe(false);
  expect(runs.post_daily({ k: daily_key("2026-11-12", "a", "b", "c"), ms: 1 })).toBe(false);
  runs.see_dailies([{ name: "Ana", k: K, ms: 60_000 }]);
  runs.see_dailies([{ name: "Ana", k: K, ms: 65_000 }]);
  const again = new Runs(store, () => now);
  expect(again.own_daily).toEqual({ k: K, ms: 62_000 });
  expect(again.seen_dailies).toEqual([{ name: "Ana", k: K, ms: 60_000 }]);
  again.see_dailies(Array.from({ length: SEEN_MAX + 5 }, (_, i) => ({ name: `P${i}`, k: K, ms: 1000 + i })));
  expect(again.seen_dailies.length).toBe(SEEN_MAX);
  now = new Date("2026-11-14T00:01:00Z");
  expect([again.own_daily, again.seen_dailies]).toEqual([null, []]);
});

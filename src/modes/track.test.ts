/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Track, add_race, parse_race_record, parse_runs, record, stars_for, unlocked, type Store } from "./track";

const IDS = ["g1", "g2", "g3"];

function memory(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

test("stars against par", () => {
  expect(stars_for(30_000, 30_000)).toBe(3);
  expect(stars_for(37_500, 30_000)).toBe(2);
  expect(stars_for(37_501, 30_000)).toBe(1);
});

test("next level opens when the one before is done", () => {
  expect(unlocked({}, IDS)).toBe(1);
  expect(unlocked({ g1: { stars: 1, ms: 5 } }, IDS)).toBe(2);
  expect(unlocked({ g2: { stars: 3, ms: 5 } }, IDS)).toBe(1);
  expect(unlocked({ g1: { stars: 1, ms: 5 }, g2: { stars: 1, ms: 5 }, g3: { stars: 1, ms: 5 } }, IDS)).toBe(3);
  expect(unlocked({}, [])).toBe(0);
});

test("a run replaces the best only on more stars, or the same stars faster", () => {
  const runs = { g1: { stars: 2, ms: 40_000 } };
  expect(record(runs, "g1", { stars: 1, ms: 10_000 }).improved).toBe(false);
  expect(record(runs, "g1", { stars: 2, ms: 39_000 }).runs.g1.ms).toBe(39_000);
  expect(record(runs, "g1", { stars: 3, ms: 50_000 }).runs.g1.stars).toBe(3);
  expect(record(runs, "g2", { stars: 1, ms: 1 }).first).toBe(true);
});

test("saves are validated entry by entry", () => {
  expect(parse_runs({ g1: { stars: 3, ms: 1000 }, g2: { stars: 4, ms: 1 }, g3: { stars: 1, ms: -1 }, g4: "x" })).toEqual({ g1: { stars: 3, ms: 1000 } });
  expect(parse_runs([1, 2])).toEqual({});
  expect(parse_runs(null)).toEqual({});
});

test("a track persists per mode and seed, and survives corrupt storage", () => {
  const store = memory();
  const track = new Track("gymkhana", 7, IDS, store);
  track.record("g1", { stars: 2, ms: 31_000 });
  expect(new Track("gymkhana", 7, IDS, store).runs.g1).toEqual({ stars: 2, ms: 31_000 });
  expect(new Track("gymkhana", 8, IDS, store).open).toBe(1);
  store.data.set("harepin:gymkhana:9", "{not json");
  expect(new Track("gymkhana", 9, IDS, store).runs).toEqual({});
  expect(new Track("gymkhana", 9, IDS, null).open).toBe(1);
});

test("race record keeps best per lap count and counts podiums", () => {
  const first = add_race({ best: {}, podiums: 0 }, 3, 90_000, true);
  expect(first).toEqual({ record: { best: { 3: 90_000 }, podiums: 1 }, improved: true });
  expect(add_race(first.record, 3, 95_000, false)).toEqual({ record: { best: { 3: 90_000 }, podiums: 1 }, improved: false });
  expect(parse_race_record({ best: { 3: 5, x: 1, 2: -4 }, podiums: 2.5 })).toEqual({ best: { 3: 5 }, podiums: 0 });
});

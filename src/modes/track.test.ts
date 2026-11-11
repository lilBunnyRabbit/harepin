/// <reference types="bun" />
import { expect, test } from "bun:test";
import { world_key } from "../worldgen/kinds/kinds";
import { Track, add_race, placing, parse_race_record, parse_runs, record, stars_for, unlocked, type Store } from "./track";

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

test("a starless run sets no best and opens nothing", () => {
  const zero = record({}, "g1", { stars: 0, ms: 30_000, score: 0 });
  expect(zero.improved).toBe(false);
  expect(zero.runs).toEqual({});
  expect(unlocked(zero.runs, IDS)).toBe(1);
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
  store.data.set(`harepin:gymkhana:${world_key(9)}`, "{not json");
  expect(new Track("gymkhana", 9, IDS, store).runs).toEqual({});
  expect(new Track("gymkhana", 9, IDS, null).open).toBe(1);
});

test("race record keeps best per lap count and counts wins and podiums", () => {
  const first = add_race({ best: {}, podiums: 0, wins: 0 }, 3, 90_000, { win: true, podium: true });
  expect(first).toEqual({ record: { best: { 3: 90_000 }, podiums: 1, wins: 1 }, improved: true });
  expect(add_race(first.record, 3, 95_000, { win: false, podium: false })).toEqual({ record: { best: { 3: 90_000 }, podiums: 1, wins: 1 }, improved: false });
  expect(parse_race_record({ best: { 3: 5, x: 1, 2: -4 }, podiums: 2.5, wins: -1 })).toEqual({ best: { 3: 5 }, podiums: 0, wins: 0 });
  expect(parse_race_record({ podiums: 2 })).toEqual({ best: {}, podiums: 2, wins: 0 });
});

test("podium needs four racers, a win needs one rival", () => {
  expect(placing(1, 1)).toEqual({ win: false, podium: false });
  expect(placing(1, 2)).toEqual({ win: true, podium: false });
  expect(placing(3, 3)).toEqual({ win: false, podium: false });
  expect(placing(3, 4)).toEqual({ win: false, podium: true });
  expect(placing(4, 6)).toEqual({ win: false, podium: false });
  expect(placing(1, 4)).toEqual({ win: true, podium: true });
});

test("a race on another route counts its placing but sets no best", () => {
  const run = add_race({ best: { 1: 80_000 }, podiums: 0, wins: 0 }, null, 60_000, { win: true, podium: true });
  expect(run).toEqual({ record: { best: { 1: 80_000 }, podiums: 1, wins: 1 }, improved: false });
});

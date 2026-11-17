/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Difficulty } from "../ai/difficulty";
import { RivalPick } from "../ai/field-pick";
import { plain_map } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import { DEFAULT_KIND } from "../worldgen/types";
import { DEFAULT_CUSTOM, MAX_RIVALS, RaceFormat, custom_host, grid_of, parse_custom_race, type CustomBase } from "./custom-race";
import { MAX_LAPS } from "./race-laps";

const base = {} as CustomBase;
const next = { label: "Custom race", go() {} };

describe("custom race setup", () => {
  test("a save that is not one, or holds junk, loads the defaults field by field", () => {
    expect(parse_custom_race(null)).toEqual(DEFAULT_CUSTOM);
    expect(parse_custom_race("race")).toEqual(DEFAULT_CUSTOM);
    expect(parse_custom_race({ map: "not a code!", route: 7, rivals: "many", format: "sprint", laps: NaN, minutes: 4, difficulty: "brutal", aggression: null, mistakes: {}, grid: "pole", cars: "bus", picked: "all" })).toEqual(DEFAULT_CUSTOM);
  });

  test("numbers are clamped to what a race can run, and a saved setup round-trips", () => {
    const read = parse_custom_race({ rivals: 40, laps: 99, aggression: 0, mistakes: 9, grid: -3, picked: ["Sturm GT", 4, "x".repeat(80)] });
    expect([read.rivals, read.laps, read.aggression, read.mistakes, read.grid]).toEqual([MAX_RIVALS, MAX_LAPS, 1, 5, 0]);
    expect(read.picked).toEqual(["Sturm GT"]);
    const setup = { ...DEFAULT_CUSTOM, map: map_code(plain_map(DEFAULT_KIND, 41)), route: "circuit", rivals: 3, format: RaceFormat.TIMED, minutes: 5, difficulty: Difficulty.HARD, cars: RivalPick.PICKED, picked: ["Maxed F1"] };
    expect(parse_custom_race(JSON.parse(JSON.stringify(setup)))).toEqual(setup);
  });

  test("the grid slot past the field is its last slot, whatever the rival count", () => {
    expect(grid_of({ ...DEFAULT_CUSTOM, rivals: 2 })).toBe(2);
    expect(grid_of({ ...DEFAULT_CUSTOM, rivals: 6, grid: 0 })).toBe(0);
  });

  test("the host carries the setup as field data: one car per rival on its levels, its laps, rules and cars", () => {
    const host = custom_host(base, { ...DEFAULT_CUSTOM, rivals: 3, laps: 4, aggression: 5, mistakes: 1, grid: 1, difficulty: Difficulty.EASY, cars: RivalPick.ANY }, "Circuit", next);
    expect(host.cars).toEqual([
      { aggression: 5, mistakes: 1 },
      { aggression: 5, mistakes: 1 },
      { aggression: 5, mistakes: 1 },
    ]);
    expect(host.difficulty()).toBe(Difficulty.EASY);
    expect(host.rivals).toEqual({ pick: RivalPick.ANY });
    expect([host.event?.laps, host.event?.grid, host.event?.knockout, host.event?.limit_ms]).toEqual([4, 1, false, null]);
  });

  test("auto laps leave the route's par to decide; knockout and timed set their rule", () => {
    expect(custom_host(base, DEFAULT_CUSTOM, "Circuit", next).event?.laps).toBeUndefined();
    expect(custom_host(base, { ...DEFAULT_CUSTOM, format: RaceFormat.KNOCKOUT }, "Circuit", next).event?.knockout).toBe(true);
    expect(custom_host(base, { ...DEFAULT_CUSTOM, format: RaceFormat.TIMED, minutes: 2 }, "Circuit", next).event?.limit_ms).toBe(120_000);
  });
});

/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { DEFAULT_BUILD, build_code, parse_build } from "../car/build";
import { within } from "../car/car-pick";
import { rating } from "../car/pi";
import { PRESETS } from "../car/presets";
import { field_builds } from "./field-pick";

describe("AI field cars", () => {
  test("six cars for a class C player: presets in or under the class, none looking alike, none wearing the player's paint", () => {
    const builds = field_builds(DEFAULT_BUILD, 6);
    expect(builds).toHaveLength(6);
    for (const build of builds) expect(within(rating(build).class, rating(DEFAULT_BUILD).class)).toBe(true);
    expect(new Set(builds.map(build_code)).size).toBe(6);
    expect(new Set(builds.map((b) => b.paint)).size).toBe(6);
    expect(builds.some((b) => b.paint === DEFAULT_BUILD.paint || b.number === DEFAULT_BUILD.number)).toBe(false);
  });

  test("the closest preset in rating comes first, and a route's left-out cars never race", () => {
    const rally = parse_build(PRESETS[2].code);
    if (!rally) throw new Error("no rally preset");
    const builds = field_builds(rally, 6, ["rally"]);
    expect(builds.every((b) => b.car !== "rally")).toBe(true);
    const gaps = builds.slice(0, 3).map((b) => Math.abs(rating(b).pi - rating(rally).pi));
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
  });
});

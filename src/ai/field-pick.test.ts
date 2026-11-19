/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { DEFAULT_BUILD, build_code, parse_build } from "../car/build";
import { rating } from "../car/pi";
import { PRESETS } from "../car/presets";
import { RivalPick, field_builds, field_presets } from "./field-pick";

describe("AI field cars", () => {
  test("six cars for a class C player: class C presets only, none looking alike, none wearing the player's paint", () => {
    const builds = field_builds(DEFAULT_BUILD, rating(DEFAULT_BUILD), 6);
    expect(builds).toHaveLength(6);
    for (const build of builds) expect(rating(build).class).toBe(rating(DEFAULT_BUILD).class);
    expect(new Set(builds.map(build_code)).size).toBe(6);
    expect(new Set(builds.map((b) => b.paint)).size).toBe(6);
    expect(builds.some((b) => b.paint === DEFAULT_BUILD.paint || b.number === DEFAULT_BUILD.number)).toBe(false);
  });

  test("a maxed class B player meets rivals tuned from its rating down to the lower half of B, not the class bottom", () => {
    const player = parse_build("sajin.19.0.5.2.4.0.7.1");
    if (!player) throw new Error("bad player code");
    const own = rating(player);
    expect(own).toEqual({ pi: 599, class: "b" });
    const pis = field_builds(player, own, 7).map((b) => rating(b));
    expect(pis.every((r) => r.class === "b")).toBe(true);
    const values = pis.map((r) => r.pi);
    expect(Math.max(...values)).toBeGreaterThanOrEqual(580);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(525);
    expect(Math.min(...values)).toBeLessThanOrEqual(550);
    expect(values[0]).toBeGreaterThan(values[values.length - 1]);
  });

  test("AI race cars never wear neon, even when their preset has it", () => {
    const glowing = PRESETS.map((p) => parse_build(p.code)).find((b) => b && b.neon > 0);
    if (!glowing) throw new Error("no preset with neon");
    const builds = field_builds(glowing, rating(glowing), 6, [], { pick: RivalPick.ANY });
    expect(builds.every((b) => b.neon === 0 && b.neon_tone === 0)).toBe(true);
  });

  test("the closest preset in rating comes first, and a route's left-out cars never race", () => {
    const rally = parse_build(PRESETS[2].code);
    if (!rally) throw new Error("no rally preset");
    const builds = field_builds(rally, rating(rally), 6, ["rally"]);
    expect(builds.every((b) => b.car !== "rally")).toBe(true);
    const gaps = builds.slice(0, 2).map((b) => Math.abs(rating(b).pi - rating(rally).pi));
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
  });

  test("a car flagged out of AI fields never races in one: a bus player, alone in class D, races class C presets", () => {
    const bus = parse_build(PRESETS.find((p) => p.code.startsWith("bus."))?.code ?? "");
    if (!bus) throw new Error("no bus preset");
    expect(rating(bus).class).toBe("d");
    const builds = field_builds(bus, rating(bus), 6);
    expect(builds).toHaveLength(6);
    for (const build of builds) expect([build.car, rating(build).class]).toEqual([build.car, "c"]);
  });

  test("any class: a field of four spans the slowest and the fastest preset, and the bus stays out", () => {
    const all = field_presets().map((p) => p.rated.pi);
    const builds = field_builds(DEFAULT_BUILD, rating(DEFAULT_BUILD), 4, [], { pick: RivalPick.ANY });
    const pis = builds.map((b) => rating(b).pi);
    expect(Math.min(...pis)).toBe(Math.min(...all));
    expect(Math.max(...pis)).toBeGreaterThan(rating(DEFAULT_BUILD).pi);
    expect(new Set(builds.map((b) => b.car)).size).toBe(4);
    const more = field_builds(DEFAULT_BUILD, rating(DEFAULT_BUILD), 7, [], { pick: RivalPick.ANY });
    expect(more.some((b) => b.car === "bus")).toBe(false);
  });

  test("picked presets cycle over the field; the bus or a name it does not know falls back to the player's class", () => {
    const builds = field_builds(DEFAULT_BUILD, rating(DEFAULT_BUILD), 5, [], { pick: RivalPick.PICKED, presets: ["Maxed F1", "Sturm GT"] });
    expect(builds.map((b) => b.car)).toEqual(["formula", "sturm", "formula", "sturm", "formula"]);
    expect(new Set(builds.map((b) => b.paint)).size).toBe(5);
    const none = field_builds(DEFAULT_BUILD, rating(DEFAULT_BUILD), 3, [], { pick: RivalPick.PICKED, presets: ["Party bus", "nope"] });
    expect(none).toEqual(field_builds(DEFAULT_BUILD, rating(DEFAULT_BUILD), 3));
  });
});

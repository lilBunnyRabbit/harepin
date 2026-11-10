import { expect, test } from "bun:test";
import { sky_layout, SKY } from "../sky";
import { WorldKind } from "../types";
import { clean_opts, KINDS, levels_of, world_key } from "./kinds";
import { opts_code, parse_opts, tune } from "./options";

test("the plain map keeps its key and an empty code", () => {
  for (const kind of Object.values(WorldKind)) {
    const { options } = KINDS[kind];
    expect(opts_code(options, options.map((o) => o.normal))).toBe("");
  }
  expect(world_key(42, WorldKind.ISLAND, "")).toBe("42:w6");
  expect(world_key(42, WorldKind.ISLAND, "111111")).toBe("42:w6");
  expect(world_key(42, WorldKind.ISLAND, "121111")).toBe("42:w6:121111");
});

test("every code a kind has reads back to itself", () => {
  for (const kind of Object.values(WorldKind)) {
    const { options } = KINDS[kind];
    let codes = [""];
    for (const o of options) codes = codes.flatMap((c) => o.labels.map((_, level) => c + level));
    for (const code of codes) expect(parse_opts(options, code)).toEqual(code ? [...code].map(Number) : options.map((o) => o.normal));
  }
});

test("malformed codes read as the plain map", () => {
  for (const bad of ["9", "1111111111", "abc", "11111", "-11111", "1.1111"]) expect(clean_opts(WorldKind.ISLAND, bad)).toBe("");
  expect(clean_opts(WorldKind.MAINLAND, "1")).toBe("");
});

test("the normal level leaves the recipe as it is", () => {
  const { options } = KINDS.island;
  const recipe = { n: 1 };
  expect(tune(recipe, [], [])).toBe(recipe);
  expect(levels_of(WorldKind.ISLAND, "")).toEqual(options.map((o) => o.normal));
});

test("a sky option no layout of a seed can meet falls back to that seed's plain track, never another seed's", () => {
  const impossible = { ...SKY, length: [1, 2] as const };
  expect(sky_layout(4, impossible)).toEqual(sky_layout(4));
});

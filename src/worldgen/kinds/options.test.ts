import { expect, test } from "bun:test";
import { sky_layout, SKY } from "../sky";
import { WorldKind } from "../types";
import { KINDS, world_key } from "./kinds";
import { clean_map_code, map_code, parse_map_code, pick_problem, PRESETS, read_pick } from "./map-code";
import { in_k2, opts_code, parse_opts, tune } from "./options";
import { MAX_SEED } from "../../net/seed";

test("the plain map keeps its key and an empty code", () => {
  for (const kind of Object.values(WorldKind)) {
    const { options } = KINDS[kind];
    expect(opts_code(options, options.map((o) => o.normal))).toBe("");
  }
  expect(world_key(42, WorldKind.ISLAND, [])).toBe("42:w8");
  expect(world_key(42, WorldKind.ISLAND, [1, 1, 1, 1, 1, 1])).toBe("42:w8");
  expect(world_key(42, WorldKind.ISLAND, [1, 2, 1, 1, 1, 1])).toBe("42:w8:121111");
});

test("every K2 digit code a kind has reads back to itself", () => {
  for (const kind of Object.values(WorldKind)) {
    const options = KINDS[kind].options.filter(in_k2);
    let codes = [""];
    for (const o of options) codes = codes.flatMap((c) => o.labels.map((_, level) => c + level));
    for (const code of codes) expect(parse_opts(options, code)).toEqual(code ? [...code].map(Number) : options.map((o) => o.normal));
  }
});

test("malformed option digits read as no levels", () => {
  for (const bad of ["9", "1111111111", "abc", "11111", "-11111", "1.1111"]) expect(parse_opts(KINDS.island.options, bad)).toBeNull();
  expect(parse_opts(KINDS.mainland.options, "1")).toBeNull();
});

test("the normal level leaves the recipe as it is", () => {
  const { options } = KINDS.island;
  const recipe = { n: 1 };
  expect(tune(recipe, [], [])).toBe(recipe);
  expect(parse_opts(options, "")).toEqual(options.map((o) => o.normal));
});

test("a sky option no layout of a seed can meet falls back to that seed's plain track, never another seed's", () => {
  const impossible = { ...SKY, length: [1, 2] as const };
  expect(sky_layout(4, impossible)).toEqual(sky_layout(4));
});

const read = (text: string, kind?: WorldKind) => {
  const result = parse_map_code(text, kind);
  if (!result.ok) throw new Error(`${text}: ${result.why}`);
  return result.map;
};

test("map code field letters and preset chars never move", () => {
  const fields = Object.fromEntries(Object.values(WorldKind).map((kind) => [kind, KINDS[kind].options.map((o) => o.field).join("")]));
  expect(fields).toEqual({ island: "EQYJCXHTGPZW", sky: "EQAVF", desert: "JCXHDKZW", mainland: "", alpine: "YJCHTGZW", tundra: "JCHTZ", volcano: "", rooftops: "" });
  expect(PRESETS.map((p) => `${p.char}${p.kind}`)).toEqual(["Cisland", "Ssky", "Ddesert", "Mmainland", "Aalpine", "Ttundra", "Vvolcano", "Rrooftops"]);
  for (const kind of Object.values(WorldKind)) {
    expect(new Set(fields[kind]).size).toBe(fields[kind].length);
    for (const field of fields[kind]) expect("ILOU0123456789").not.toContain(field);
  }
});

test("a plain map's code is the preset and the seed, nine chars", () => {
  expect(map_code({ kind: WorldKind.ISLAND, seed: 42, levels: KINDS.island.options.map((o) => o.normal) })).toBe("1C000001A");
  expect(map_code({ kind: WorldKind.DESERT, seed: MAX_SEED, levels: [1, 1, 1] })).toBe("1D3ZZZZZZ");
  expect(map_code({ kind: WorldKind.MAINLAND, seed: 0, levels: [] })).toBe("1M0000000");
});

test("every level of every field of every preset round-trips through its code", () => {
  for (const kind of Object.values(WorldKind)) {
    const { options } = KINDS[kind];
    const normal = options.map((o) => o.normal);
    for (const seed of [0, 1, 42, 123456789, MAX_SEED])
      options.forEach((o, i) =>
        o.labels.forEach((_, level) => {
          const levels = normal.map((n, j) => (j === i ? level : n));
          const code = map_code({ kind, seed, levels });
          expect(code.length).toBe(level === o.normal ? 9 : 12);
          expect(read(code)).toEqual({ kind, seed, levels });
          expect(read(code.toLowerCase())).toEqual({ kind, seed, levels });
        }),
      );
    const all = options.map((o) => o.labels.length - 1 - o.normal);
    expect(read(map_code({ kind, seed: 7, levels: all }))).toEqual({ kind, seed: 7, levels: all });
  }
});

test("overrides come out sorted, and ones equal to the preset drop out", () => {
  const code = map_code({ kind: WorldKind.ISLAND, seed: 42, levels: [2, 0, 1, 1, 1, 0, 31, 16, 0] });
  expect(code).toBe("1C000001A-E2G0HZQ0X0");
  expect(map_code(read("1c000001a-x0hzg0q0e2"))).toBe(code);
  expect(map_code(read("1C000001A-E2Y1Q0X0HZG0TG"))).toBe(code);
  expect(map_code(read(" 1c00-0001a e2 g0 hz q0 x0 "))).toBe(code);
  expect(map_code(read("1c0000o1a-e2g0hzq0x0"))).toBe(code);
});

test("K2 codes read as the picked kind's plain preset plus their digits", () => {
  expect(read("42-121111")).toEqual({ kind: WorldKind.ISLAND, seed: 42, levels: [1, 2, 1, 1, 1, 1, 16, 16, 16, 16, 16, 0] });
  expect(read("42", WorldKind.SKY)).toEqual({ kind: WorldKind.SKY, seed: 42, levels: [1, 1, 1, 1, 1] });
  expect(read("7-201", WorldKind.DESERT)).toEqual({ kind: WorldKind.DESERT, seed: 7, levels: [2, 0, 1, 16, 16, 16, 16, 0] });
  expect(map_code(read("42-121111"))).toBe("1C000001A-Q2");
  expect(map_code(read("42-111111"))).toBe("1C000001A");
  for (const bad of ["42-12111", "42-1211119", "4294967296", "42-", "-42"]) expect(parse_map_code(bad).ok).toBe(false);
});

test("a code this build can't build says newer, never builds another map", () => {
  for (const newer of ["2C000001A", "1Z000001A", "1C000001A-R3", "1C000001A-E3", "1D000001A-E2", "1M000001A-E2"]) expect(parse_map_code(newer)).toEqual({ ok: false, why: "newer" });
  for (const bad of ["", "1C00001A", "1C000001A-E", "1C000001A-E2E0", "1C00U001A", "1C000001!", "1CZZZZZZZ", "x".repeat(65)])
    expect(parse_map_code(bad)).toEqual({ ok: false, why: "bad" });
});

test("a link's code that can't be read is named as newer or bad, and the plain map it falls to is its own seed's", () => {
  const pick = (code: string | null) => ({ seed: 9, kind: WorldKind.SKY, code });
  expect(pick_problem(pick("1Z000001A"))).toBe("newer");
  expect(pick_problem(pick("1C000001A-R3"))).toBe("newer");
  expect(pick_problem(pick("hello"))).toBe("bad");
  expect(pick_problem(pick(null))).toBeNull();
  expect(pick_problem(pick("1C000001A-E2"))).toBeNull();
  expect(read_pick(pick("1Z000001A"))).toEqual({ kind: WorldKind.SKY, seed: 9, levels: [1, 1, 1, 1, 1] });
});

test("codes past the relief budget read as their clamped map, so one world has one code", () => {
  const over = read("1C000001A-GZHZ");
  expect(map_code(over)).toBe("1C000001A-HZ");
  expect(map_code(read("1C000001A-HZ"))).toBe("1C000001A-HZ");
  expect(clean_map_code("1C000001A-GZHZ")).toBeNull();
  expect(clean_map_code("1C000001A-HZ")).toBe("1C000001A-HZ");
});

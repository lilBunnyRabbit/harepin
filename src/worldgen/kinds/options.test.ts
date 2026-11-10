import { expect, test } from "bun:test";
const MAX_U32 = 0xffffffff;
import { sky_layout, SKY } from "../sky";
import { WorldKind } from "../types";
import { clean_opts, KINDS, kind_of_world, levels_of, opts_of_world, world_id, world_key } from "./kinds";
import { levels_of_number, opts_code, opts_number, parse_opts, tune } from "./options";

const every_code = (kind: WorldKind) => {
  const { options } = KINDS[kind];
  let codes = [""];
  for (const o of options) codes = codes.flatMap((c) => o.labels.map((_, level) => c + level));
  return codes.map((c) => opts_code(options, parse_opts(options, c) ?? []));
};

test("the plain map keeps its id, key and empty code", () => {
  for (const kind of Object.values(WorldKind)) {
    const { options, id } = KINDS[kind];
    const normal = options.map((o) => o.normal);
    expect(opts_code(options, normal)).toBe("");
    expect(opts_number(options, normal)).toBe(0);
    expect(world_id(kind)).toBe(id);
    expect(world_id(kind, "")).toBe(id);
  }
  expect(world_key(42, WorldKind.ISLAND, "")).toBe("42:w6");
  expect(world_key(42, WorldKind.ISLAND, "111111")).toBe("42:w6");
  expect(world_key(42, WorldKind.ISLAND, "121111")).toBe("42:w6:121111");
});

test("every option code has its own id, inside a u32 and back to the same kind and code", () => {
  const ids = new Set<number>();
  for (const kind of Object.values(WorldKind))
    for (const code of every_code(kind)) {
      const id = world_id(kind, code);
      expect(Number.isInteger(id) && id >= 1 && id <= MAX_U32).toBe(true);
      expect(kind_of_world(id)).toBe(kind);
      expect(opts_of_world(id)).toBe(code);
      ids.add(id);
    }
  expect(ids.size).toBe(Object.values(WorldKind).reduce((n, kind) => n + every_code(kind).length, 0));
});

test("malformed codes read as the plain map", () => {
  for (const bad of ["9", "1111111111", "abc", "11111", "-11111", "1.1111"]) expect(clean_opts(WorldKind.ISLAND, bad)).toBe("");
  expect(clean_opts(WorldKind.MAINLAND, "1")).toBe("");
  expect(levels_of_number(KINDS.island.options, 10 ** 9)).toBeNull();
  expect(opts_of_world(world_id(WorldKind.ISLAND) + 0x10000 * 10 ** 4)).toBe("");
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

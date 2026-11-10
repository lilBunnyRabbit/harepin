import { expect, test } from "bun:test";
import { WorldKind } from "../types";
import { KINDS, kind_of_world, parse_kind, world_id, world_key } from "./kinds";

test("ids and keys match what saved records and older peers use", () => {
  expect(world_id(WorldKind.ISLAND)).toBe(4);
  expect(world_id(WorldKind.SKY)).toBe(1003);
  expect(world_key(42)).toBe("42:w4");
  expect(world_key(42, WorldKind.ISLAND)).toBe("42:w4");
  expect(world_key(42, WorldKind.SKY)).toBe("42:sky3");
});

test("every kind has its own id and key and is keyed by its own kind", () => {
  const defs = Object.entries(KINDS);
  for (const [kind, def] of defs) expect(def.kind).toBe(kind as WorldKind);
  expect(new Set(defs.map(([, def]) => def.id)).size).toBe(defs.length);
  expect(new Set(defs.map(([, def]) => def.key(1))).size).toBe(defs.length);
  expect(Object.keys(KINDS).sort()).toEqual(Object.values(WorldKind).sort());
});

test("unknown ids and names fall back to the island", () => {
  expect(kind_of_world(1003)).toBe(WorldKind.SKY);
  expect(kind_of_world(undefined)).toBe(WorldKind.ISLAND);
  expect(kind_of_world(999)).toBe(WorldKind.ISLAND);
  expect(parse_kind("sky")).toBe(WorldKind.SKY);
  expect(parse_kind("toString")).toBe(WorldKind.ISLAND);
  expect(parse_kind(null)).toBe(WorldKind.ISLAND);
});

import { expect, test } from "bun:test";
import { sweep } from "../../sweep";
import { sample } from "../field";
import { steep_runup } from "../jumps";
import { ALPINE } from "../recipe";
import { crest_crossings, terrain } from "../terrain";
import { town_level } from "../towns";
import { WorldKind, parse_kind, type WorldData } from "../types";
import { generate_world, KINDS, kind_of_world, world_id, world_key } from "./kinds";

/** Road points either side of a crest crossing, 2 m apart, that the pass must hold. */
const PASS_REACH = 60;
/** Past a town's core and band the plateau holds the plane this much further, two cells, before it blends away. */
const PLATEAU_RIM = 8;
/** Generating every swept alpine world takes about a second each, so the first test to reach the cache pays for all of them. */
const ALPINE_TIMEOUT = 30_000;

const alpine_worlds = new Map<number, WorldData>();
function alpine(seed: number): WorldData {
  let world = alpine_worlds.get(seed);
  if (!world) alpine_worlds.set(seed, (world = generate_world(seed, WorldKind.ALPINE)));
  return world;
}

test("ids and keys match what saved records and older peers use", () => {
  expect(world_id(WorldKind.ISLAND)).toBe(7);
  expect(world_id(WorldKind.SKY)).toBe(1003);
  expect(world_key(42)).toBe("42:w7");
  expect(world_key(42, WorldKind.ISLAND)).toBe("42:w7");
  expect(world_key(42, WorldKind.SKY)).toBe("42:sky3");
  expect(world_id(WorldKind.DESERT)).toBe(2002);
  expect(world_key(42, WorldKind.DESERT)).toBe("42:d2");
});

test("a land kind's world carries its own kind, so grip, mood and dressing follow it", () => {
  expect(generate_world(0, WorldKind.DESERT).kind).toBe(WorldKind.DESERT);
});

test("alpine seeds join a strip village to the circuit", () => {
  for (const seed of sweep(10)) {
    const world = alpine(seed);
    expect(world.towns.length).toBeGreaterThan(0);
    expect(world.graph.edges.some((e) => e.kind === "highway" && !world.circuit.includes(e.id))).toBe(true);
  }
}, ALPINE_TIMEOUT);

test("the alpine circuit crosses the range over a pass, never through a trench in its crest", () => {
  for (const seed of sweep(10)) {
    const world = alpine(seed);
    const base = world.ground.base;
    if (base.kind !== "terrain") throw new Error("alpine ground is terrain");
    const range = base.shape.find((layer) => layer.kind === "range");
    if (range?.kind !== "range") throw new Error("alpine has a range");
    const raw = terrain(seed, base.shape).heights;
    const road = world.road;
    const crossings = crest_crossings(seed, range, road.map((p): [number, number] => [p.x, p.z]));
    expect(crossings.length).toBeGreaterThanOrEqual(2);
    for (const { index } of crossings)
      for (let k = -PASS_REACH; k <= PASS_REACH; k++) {
        const p = road[(index + k + road.length) % road.length];
        for (const d of [-40, -20, 0, 20, 40]) expect(sample(raw, p.x + d * p.tz, p.z - d * p.tx) - p.y).toBeLessThan(16);
      }
  }
}, ALPINE_TIMEOUT);

test("an alpine road kicker never sits at the foot of a steep descent", () => {
  const runup = ALPINE.road.runup;
  if (!runup) throw new Error("alpine sets a kicker run-up");
  for (const seed of sweep(10)) {
    const { road, ramps } = alpine(seed);
    for (const r of ramps) {
      if (!r.road) continue;
      const toe = road.findIndex((p) => p.x === r.x && p.z === r.z);
      expect(toe).toBeGreaterThanOrEqual(0);
      expect(steep_runup(road, toe, runup)).toBe(false);
    }
  }
}, ALPINE_TIMEOUT);

test("a strip village's plateau meets the valley side without a wall", () => {
  for (const seed of sweep(10)) {
    const world = alpine(seed);
    const base = world.ground.base;
    if (base.kind !== "terrain") throw new Error("alpine ground is terrain");
    const raw = terrain(seed, base.shape).heights;
    for (const town of world.towns) {
      if (town.band === undefined) continue;
      const radius = town.core + PLATEAU_RIM;
      const band = town.band + PLATEAU_RIM;
      for (let k = 0; k < 360; k++) {
        const c = Math.cos((k / 180) * Math.PI);
        const s = Math.sin((k / 180) * Math.PI);
        const d = Math.min(radius, Math.abs(s) > 1e-9 ? band / Math.abs(s) : Infinity);
        const x = town.x + (town.ux * c - town.uz * s) * d;
        const z = town.z + (town.uz * c + town.ux * s) * d;
        expect(Math.abs(sample(raw, x, z) - town_level(town, x, z))).toBeLessThan(19);
      }
    }
  }
}, ALPINE_TIMEOUT);

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

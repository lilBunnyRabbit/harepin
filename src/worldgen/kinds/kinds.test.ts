import { expect, test } from "bun:test";
import { FULL, sweep } from "../../sweep";
import { mulberry32, seed_of } from "../../rng";
import { sample } from "../field";
import { steep_runup } from "../jumps";
import { ALPINE } from "../recipe";
import { crest_crossings, terrain } from "../terrain";
import { town_level } from "../towns";
import { WorldKind, parse_kind, type WorldData } from "../types";
import { build_world, generate_world, is_plain, KINDS, kind_of_world, map_id, plain_map, world_id, world_key, type MapSpec } from "./kinds";
import { same_map } from "../../net/net";
import { map_code } from "./map-code";
import { in_k2 } from "./options";

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
  expect(world_id(WorldKind.ISLAND)).toBe(11);
  expect(world_id(WorldKind.SKY)).toBe(1003);
  expect(world_key(42)).toBe("42:w11");
  expect(world_key(42, WorldKind.ISLAND)).toBe("42:w11");
  expect(world_key(42, WorldKind.SKY)).toBe("42:sky3");
  expect(world_id(WorldKind.DESERT)).toBe(2004);
  expect(world_key(42, WorldKind.DESERT)).toBe("42:d4");
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

test("a plain map of every kind keeps its id and records key; levels at normal are plain", () => {
  const keys = Object.fromEntries(Object.values(WorldKind).map((kind) => [kind, [world_key(42, kind), map_id(plain_map(kind, 42))]]));
  expect(keys).toEqual({ island: ["42:w11", 11], sky: ["42:sky3", 1003], desert: ["42:d4", 2004], mainland: ["42:m6", 3006], alpine: ["42:a4", 4004], tundra: ["42:t3", 5003], volcano: ["42:v4", 6004], rooftops: ["42:roof1", 8001], dunes: ["42:bd11", 9011] });
  for (const kind of Object.values(WorldKind)) {
    const normal = KINDS[kind].options.map((o) => o.normal);
    expect(world_key(42, kind, normal)).toBe(world_key(42, kind));
    expect(world_key(42, kind, [])).toBe(world_key(42, kind));
    expect(kind_of_world(map_id(plain_map(kind, 42)))).toBe(kind);
  }
});

test("a custom map's w keeps its kind in the low bits, a never-zero 15-bit hash above, and stays a positive int", () => {
  for (const kind of Object.values(WorldKind)) {
    const { options } = KINDS[kind];
    options.forEach((o, i) =>
      o.labels.forEach((_, level) => {
        if (level === o.normal) return;
        const map = { kind, seed: 42, levels: options.map((p, j) => (j === i ? level : p.normal)) };
        const w = map_id(map);
        expect(w % 0x10000).toBe(world_id(kind));
        expect(Math.floor(w / 0x10000)).toBeGreaterThan(0);
        expect(Math.floor(w / 0x10000)).toBeLessThanOrEqual(0x7fff);
        expect(w).toBeLessThan(2 ** 31);
        expect(kind_of_world(w)).toBe(kind);
        expect(world_key(42, kind, map.levels)).not.toBe(world_key(42, kind));
      }),
    );
  }
});

test("an old build, which matches ids whole, sees a custom map as a foreign map on the plain kind", () => {
  const w = map_id({ kind: WorldKind.SKY, seed: 42, levels: [2, 1, 1, 1, 1] });
  const old_kind_of_world = (id: number) => Object.values(KINDS).find((def) => def.id === id)?.kind ?? WorldKind.ISLAND;
  expect(Object.values(KINDS).some((def) => def.id === w)).toBe(false);
  expect(old_kind_of_world(w)).toBe(WorldKind.ISLAND);
  expect(w).not.toBe(world_id(WorldKind.SKY));
});

test("maps that share a w still meet as different maps by their codes", () => {
  const options = KINDS.island.options.filter(in_k2);
  let all: number[][] = [[]];
  for (const o of options) all = all.flatMap((levels) => o.labels.map((_, level) => [...levels, level]));
  const maps = all.map((levels) => ({ kind: WorldKind.ISLAND, seed: 42, levels })).filter((map) => !is_plain(map));
  expect(new Set(maps.map(map_id)).size).toBe(maps.length);
  // No seed-42 pair collides under the w11 key (seed 1 has four), so the collision is staged: a hash that matched would leave only the codes to differ.
  const [a, b] = maps;
  const w = map_id(a);
  expect(same_map({ seed: 1, world: w, map: map_code(a) }, { seed: 1, w, map: map_code(b) })).toBe(false);
  expect(same_map({ seed: 42, world: w, map: map_code(a) }, { seed: 42, w, map: map_code(a) })).toBe(true);
});

test("records keys: a map off only K2 knobs keeps its digit key", () => {
  expect(world_key(42, WorldKind.DESERT, [2, 1, 0])).toBe("42:d4:210");
  expect(world_key(42, WorldKind.SKY, [1, 1, 0, 1, 1])).toBe("42:sky3:11011");
});

test("records keys: a slider off normal keys by the code's letters, never a K2 digit key", () => {
  const desert = KINDS.desert.options.map((o) => o.normal);
  expect(world_key(42, WorldKind.DESERT, desert.map((l, i) => (i === 3 ? 0 : l)))).toBe("42:d4:H0");
  expect(world_key(42, WorldKind.DESERT, desert.map((l, i) => (i === 0 ? 2 : i === 4 ? 31 : l)))).toBe("42:d4:DZJ2");
});

test("a slider's normal level is the kind's own value and its ends are the ranges it names", () => {
  for (const kind of Object.values(WorldKind))
    for (const o of KINDS[kind].options.filter((p) => p.slider)) {
      expect(o.labels).toHaveLength(32);
      expect(o.normal).toBe(16);
    }
  const hills = KINDS.island.options.find((o) => o.field === "H");
  expect([hills?.labels[0], hills?.labels[16], hills?.labels[31]]).toEqual(["40%", "100%", "150%"]);
});

/** Each slider alone at its ends (and its middle on a full run), the rest at the preset's levels. */
function slider_maps(kind: WorldKind): MapSpec[] {
  const { options } = KINDS[kind];
  const normal = options.map((o) => o.normal);
  const ends = FULL ? [0, 15, 31] : [0, 31];
  const seeds = sweep(10).slice(0, FULL ? 10 : 2);
  return options.flatMap((o, i) => (o.slider ? ends.flatMap((level) => seeds.map((seed) => ({ kind, seed, levels: normal.map((n, j) => (j === i ? level : n)) }))) : []));
}

/** Random full combinations of every option, on a full run only: each takes a whole generation. */
function combo_maps(kind: WorldKind): MapSpec[] {
  if (!FULL) return [];
  const rng = mulberry32(seed_of(`sweep:${kind}`));
  return Array.from({ length: 50 }, () => ({ kind, seed: Math.floor(rng() * 1000), levels: KINDS[kind].options.map((o) => Math.floor(rng() * o.labels.length)) }));
}

const SWEEP_TIMEOUT = FULL ? 600_000 : 60_000;

for (const kind of [WorldKind.ISLAND, WorldKind.DESERT, WorldKind.ALPINE, WorldKind.TUNDRA])
  test(`every ${kind} slider at its ends builds a drivable world of its own seed`, () => {
    const failed: string[] = [];
    for (const map of [...slider_maps(kind), ...combo_maps(kind)]) {
      const built = build_world(map.seed, map.kind, map.levels);
      if (built.fallback) failed.push(map_code(map));
      expect(built.data.terrain.seed).toBe(map.seed);
    }
    expect(failed).toEqual([]);
  }, SWEEP_TIMEOUT);

test("hills and the second relief slider share one budget; the clamp keeps every lower pair", () => {
  const island = KINDS.island;
  const at = (field: string) => island.options.findIndex((o) => o.field === field);
  const normal = island.options.map((o) => o.normal);
  const both = normal.map((n, i) => (i === at("H") || i === at("G") ? 31 : n));
  expect(island.clamp?.(both)[at("G")]).toBe(16);
  const low = normal.map((n, i) => (i === at("G") ? 31 : n));
  expect(island.clamp?.(low)).toEqual(low);
  const desert = KINDS.desert;
  const d = (field: string) => desert.options.findIndex((o) => o.field === field);
  const dunes = desert.options.map((o, i) => (i === d("H") || i === d("D") ? 31 : o.normal));
  expect(desert.clamp?.(dunes)[d("D")]).toBeLessThan(31);
});

test("a custom map builds the same world every time, and a plain map passes the checks it never runs", () => {
  const map = { kind: WorldKind.ISLAND, seed: 3, levels: KINDS.island.options.map((o) => (o.field === "P" ? 31 : o.normal)) };
  const a = build_world(map.seed, map.kind, map.levels);
  const b = build_world(map.seed, map.kind, map.levels);
  expect(a.retries).toBe(b.retries);
  expect(a.data.road).toEqual(b.data.road);
  const plain = generate_world(0, WorldKind.ISLAND);
  expect(KINDS.island.drivable?.(plain, KINDS.island.options.map((o) => o.normal))).toBe(true);
}, 60_000);

test("a custom map with no drivable build says so and stands in as its own seed's plain map", () => {
  const island = KINDS.island;
  const check = island.drivable;
  island.drivable = () => false;
  try {
    const built = build_world(4, WorldKind.ISLAND, island.options.map((o) => (o.field === "E" ? 2 : o.normal)));
    expect(built.fallback).toBe(true);
    expect(built.retries).toBe(4);
    expect(built.data.road).toEqual(generate_world(4, WorldKind.ISLAND).road);
    expect(build_world(4, WorldKind.ISLAND).fallback).toBe(false);
  } finally {
    island.drivable = check;
  }
}, 60_000);

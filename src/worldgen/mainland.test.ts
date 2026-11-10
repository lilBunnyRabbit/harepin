/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { CHUNK, chunk_of, extent } from "./chunk-grid";
import { build_tile } from "./ground";
import { GATE_CLEAR, MAINLAND_SIZE, plan_mainland } from "./mainland";
import { plan_sample } from "./plan-grid";
import { TILE_SIDE, TileStore } from "./tiles";
import type { Built } from "./tile-mesher";

const EXT = extent(MAINLAND_SIZE);

test("mainland ids and keys sit in their own thousand", async () => {
  const { world_id, world_key } = await import("./kinds/kinds");
  expect(world_id("mainland")).toBe(3001);
  expect(world_key(42, "mainland")).toBe("42:m1");
});

test("the mainland is land in the middle and sea at its border", () => {
  const { grid } = plan_mainland(0);
  expect(plan_sample(grid, 0, 0)).toBeGreaterThan(5);
  for (const [x, z] of [[EXT.origin, EXT.origin], [-EXT.origin - 1, 0], [0, EXT.origin]]) expect(plan_sample(grid, x, z)).toBeLessThan(0);
});

// Room qa7ml's map and the first sweep seeds: the start gate stood on the kink where the lap's first link meets a town.
for (const seed of [...sweep(3), 3516535473])
  test(`mainland ${seed}: gates run in lap order and stand clear of every road node`, () => {
    const { data } = plan_mainland(seed);
    const at = data.checkpoints.map((c) => data.road.findIndex((p) => p.x === c.x && p.z === c.z));
    expect(at[0]).toBe(0);
    at.forEach((s, i) => i && expect(s).toBeGreaterThan(at[i - 1]));
    for (const c of data.checkpoints) for (const n of data.graph.nodes) expect(Math.hypot(n.x - c.x, n.z - c.z)).toBeGreaterThanOrEqual(GATE_CLEAR);
  });

for (const seed of sweep(3))
  test(`mainland ${seed}: every pair of neighbouring tiles shares its border vertices bit for bit`, () => {
    const { data } = plan_mainland(seed);
    const tiles = Array.from({ length: EXT.side * EXT.side }, (_, index) => build_tile(data.ground, index, EXT));
    const last = TILE_SIDE - 1;
    let off = 0;
    for (let cj = 0; cj < EXT.side; cj++)
      for (let ci = 0; ci < EXT.side; ci++) {
        const here = tiles[cj * EXT.side + ci];
        const east = ci + 1 < EXT.side ? tiles[cj * EXT.side + ci + 1] : null;
        const north = cj + 1 < EXT.side ? tiles[(cj + 1) * EXT.side + ci] : null;
        for (let k = 0; k < TILE_SIDE; k++)
          for (const field of ["heights", "road_dist", "surface"] as const) {
            if (east && east[field][k * TILE_SIDE] !== here[field][k * TILE_SIDE + last]) off++;
            if (north && north[field][k] !== here[field][last * TILE_SIDE + k]) off++;
          }
      }
    expect(off).toBe(0);
  }, 30_000);

test("a mainland tile store answers from the tile under the point, and the plan grid agrees with it", () => {
  const { data, grid } = plan_mainland(2);
  const store = new TileStore(EXT);
  const corner = 0;
  store.add(corner, build_tile(data.ground, corner, EXT));
  const x = EXT.origin + CHUNK / 2;
  expect(store.height(x, x)).toBe(build_tile(data.ground, corner, EXT).heights[(TILE_SIDE >> 1) * TILE_SIDE + (TILE_SIDE >> 1)]);
  expect(Math.abs(store.height(x, x) - plan_sample(grid, x, x))).toBeLessThan(4);
});

for (const seed of sweep(5))
  test(`mainland ${seed}: towns joined by roads, and a circuit that is one unbroken closed loop over them`, () => {
    const { data } = plan_mainland(seed);
    expect(data.towns.length).toBeGreaterThanOrEqual(8);
    const local = data.graph.edges.filter((e) => e.kind === "local");
    expect(local.length).toBeGreaterThanOrEqual(data.towns.length - 1);
    expect(data.road.length).toBeGreaterThan(1000);
    const gaps = data.road.map((p, i) => {
      const q = data.road[(i + 1) % data.road.length];
      return Math.hypot(q.x - p.x, q.z - p.z);
    });
    expect(Math.max(...gaps)).toBeLessThan(8);
    expect(data.routes[0].closed).toBe(true);
    for (const id of data.circuit) expect(data.graph.edges[id]).toBeDefined();
  });

test("a mainland chunk meshes the same whatever was built before it, and shades a shared border alike", async () => {
  const { MESH_TONES } = await import("../../scripts/proof/tones");
  const { TileMesher } = await import("./tile-mesher");
  const { data } = plan_mainland(1);
  const road = data.road[0];
  const index = Math.floor((road.z - EXT.origin) / CHUNK) * EXT.side + Math.floor((road.x - EXT.origin) / CHUNK);
  const walked = new TileMesher(data, EXT, MESH_TONES);
  for (const other of [index - EXT.side - 1, index + 2, index - 1]) walked.build(other);
  const a = walked.build(index).chunk;
  const b = new TileMesher(data, EXT, MESH_TONES).build(index).chunk;
  expect(a.road?.positions.length).toBeGreaterThan(0);
  expect(Array.from(a.road?.positions ?? [])).toEqual(Array.from(b.road?.positions ?? []));
  expect(Array.from(a.terrain?.colors ?? [])).toEqual(Array.from(b.terrain?.colors ?? []));
  const west = walked.build(index - 1).chunk;
  const last = TILE_SIDE - 1;
  for (let k = 0; k < TILE_SIDE; k++)
    for (let c = 0; c < 3; c++) expect(west.terrain?.colors[(k * TILE_SIDE + last) * 3 + c]).toBe(a.terrain?.colors[k * TILE_SIDE * 3 + c]);
});

test("a mainland chunk plants the same trees whatever was built before it, each from a lattice point of its own", async () => {
  const { MESH_TONES } = await import("../../scripts/proof/tones");
  const { TileMesher } = await import("./tile-mesher");
  const { data } = plan_mainland(2);
  const centre = (EXT.side / 2) * EXT.side + EXT.side / 2;
  const ring = [-EXT.side - 1, -EXT.side, -EXT.side + 1, -1, 0, 1, EXT.side - 1, EXT.side, EXT.side + 1].map((d) => centre + d);
  const forward = new TileMesher(data, EXT, MESH_TONES);
  const ahead = new Map(ring.map((index) => [index, forward.build(index).planted]));
  const backward = new TileMesher(data, EXT, MESH_TONES);
  const behind = new Map([...ring].reverse().map((index) => [index, backward.build(index).planted]));
  let trees = 0;
  const seen = new Set<string>();
  for (const index of ring) {
    expect(behind.get(index)).toEqual(ahead.get(index) as NonNullable<ReturnType<typeof ahead.get>>);
    const planted = ahead.get(index);
    if (!planted) continue;
    trees += planted.trees.length;
    expect(planted.solids.length).toBeLessThanOrEqual(planted.trees.length);
    for (const t of planted.trees) {
      const key = `${t.x},${t.z}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  }
  expect(trees).toBeGreaterThan(50);
}, 60_000);

for (const seed of sweep(2))
  test(`mainland ${seed}: a circuit junction chunk meshes the same with neighbours built first or evicted and rebuilt`, async () => {
    const { MESH_TONES } = await import("../../scripts/proof/tones");
    const { TileMesher } = await import("./tile-mesher");
    const { road_junctions } = await import("./road-layers");
    const { data } = plan_mainland(seed);
    const ring = road_junctions(data).patched.find((j) => j.arms.some((a) => a.rank === 2));
    if (!ring) throw new Error("no circuit junction");
    const index = chunk_of(ring.x, ring.z, EXT);
    const digest = (built: Built) => ({
      tile: [...built.tile.heights, ...built.tile.road_dist, ...built.tile.surface],
      terrain: [...(built.chunk.terrain?.positions ?? []), ...(built.chunk.terrain?.colors ?? [])],
      road: [...(built.chunk.road?.positions ?? []), ...(built.chunk.road?.colors ?? [])],
      planted: built.planted,
    });
    const alone = digest(new TileMesher(data, EXT, MESH_TONES).build(index));
    expect(alone.road.length).toBeGreaterThan(0);

    const around = new TileMesher(data, EXT, MESH_TONES);
    for (const k of [index + EXT.side + 1, index - 1, index - EXT.side, index + 1]) around.build(k);
    expect(digest(around.build(index))).toEqual(alone);

    const evicted = new TileMesher(data, EXT, MESH_TONES);
    evicted.build(index);
    // Seven far rows touch nine rows of tiles, past the mesher's cache of 160.
    const row = Math.floor(index / EXT.side) < EXT.side / 2 ? EXT.side - 8 : 1;
    for (let k = 0; k < 7 * EXT.side; k++) evicted.build(row * EXT.side + k);
    expect(digest(evicted.build(index))).toEqual(alone);
  }, 60_000);

/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { CHUNK, extent } from "./chunk-grid";
import { build_tile } from "./ground";
import { MAINLAND_SIZE, plan_mainland } from "./mainland";
import { plan_sample } from "./plan-grid";
import { TILE_SIDE, TileStore } from "./tiles";

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

test("neighbouring mainland tiles share their border vertices bit for bit", () => {
  const { data } = plan_mainland(1);
  const centre = (EXT.side / 2) * EXT.side + EXT.side / 2;
  const here = build_tile(data.ground, centre, EXT);
  const east = build_tile(data.ground, centre + 1, EXT);
  const north = build_tile(data.ground, centre + EXT.side, EXT);
  const last = TILE_SIDE - 1;
  for (let k = 0; k < TILE_SIDE; k++) {
    expect(east.heights[k * TILE_SIDE]).toBe(here.heights[k * TILE_SIDE + last]);
    expect(north.heights[k]).toBe(here.heights[last * TILE_SIDE + k]);
  }
});

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

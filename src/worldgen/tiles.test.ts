/// <reference types="bun" />
import { expect, test } from "bun:test";
import { CHUNK, CHUNKS } from "./chunk-grid";
import { sample, slope_normal } from "./field";
import { generate } from "./index";
import { slice_tiles, TileStore } from "./tiles";
import { CELL, N, SIZE } from "./types";

const HALF = SIZE / 2;

function points(): [number, number][] {
  const out: [number, number][] = [];
  for (let a = -HALF - 8; a <= HALF + 8; a += CHUNK / 4)
    for (const off of [0, 1e-3, -1e-3, 2, CELL / 2]) {
      out.push([a + off, a], [a, a + off], [HALF - 1e-5, a + off], [a + off, -HALF]);
    }
  for (let k = 0; k < 20_000; k++) out.push([(((k * 7919) % 2203) / 2203 - 0.5) * (SIZE + 200), (((k * 104729) % 2161) / 2161 - 0.5) * (SIZE + 200)]);
  return out;
}

const out = { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { return Object.assign(this, { x, y, z }); } };

for (const seed of [0, 3])
  test(`tile reads equal the whole-grid reads on seed ${seed}`, () => {
    const terrain = generate(seed).terrain;
    const { heights, road_dist, surface } = terrain;
    const store = new TileStore(slice_tiles(terrain));
    let bad = 0;
    for (const [x, z] of points()) {
      const [nx, ny, nz] = slope_normal(heights, x, z);
      store.slope(x, z, out);
      if (!Object.is(store.height(x, z), sample(heights, x, z)) || !Object.is(store.road_dist(x, z), sample(road_dist, x, z)) || out.x !== nx || out.y !== ny || out.z !== nz) bad++;
    }
    for (let j = 0; j <= N; j += 3) for (let i = 0; i <= N; i++) if (store.surface(i, j) !== surface[j * (N + 1) + i]) bad++;
    expect(bad).toBe(0);
  }, 30_000);

test("a NaN coordinate reads NaN instead of throwing", () => {
  const store = new TileStore(slice_tiles(generate(0).terrain));
  expect(store.height(NaN, 0)).toBeNaN();
  expect(store.road_dist(0, NaN)).toBeNaN();
  expect(store.slope(NaN, NaN, out).x).toBeNaN();
});

test("a chunk not in yet reads flat sea-level ground far from a road, and an area wait resolves on its 3x3", async () => {
  const tiles = slice_tiles(generate(0).terrain);
  const store = new TileStore();
  const asked: [number, number][] = [];
  store.on_need = (_, focus) => focus && asked.push([focus.x, focus.z]);
  expect(store.height(10, 10)).toBe(0);
  expect(store.road_dist(10, 10)).toBeGreaterThan(1000);
  expect(store.surface(0, 0)).toBe(0);
  let ready = false;
  const wait = store.ensure(10, 10).then(() => (ready = true));
  expect(asked).toEqual([[10, 10]]);
  const centre = (CHUNKS / 2) * CHUNKS + CHUNKS / 2;
  const area = [-1, 0, 1].flatMap((dj) => [-1, 0, 1].map((di) => centre + dj * CHUNKS + di));
  for (const index of area.slice(0, 8)) store.add(index, tiles[index]);
  await Promise.resolve();
  expect(ready).toBe(false);
  store.add(area[8], tiles[area[8]]);
  await wait;
  expect(store.height(10, 10)).toBe(new TileStore(tiles).height(10, 10));
  expect(store.complete).toBe(false);
  tiles.forEach((tile, index) => store.add(index, tile));
  expect(store.complete).toBe(true);
  await store.whole();
});

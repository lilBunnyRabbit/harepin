/// <reference types="bun" />
import { expect, test } from "bun:test";
import { CHUNK } from "./chunk-grid";
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

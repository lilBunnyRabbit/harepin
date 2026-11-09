/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Biome, biome_at, biome_cuts, plant, TreeKind } from "./biomes";
import { terrain } from "./terrain";
import { CELL, N, ORIGIN } from "./types";

const SEED = 3;
const land = terrain(SEED);
const cuts = biome_cuts(SEED, land.heights);

function shares(): Record<Biome, number> {
  const count: Record<Biome, number> = { coast: 0, meadow: 0, forest: 0, upland: 0 };
  for (let j = 0; j <= N; j += 4)
    for (let i = 0; i <= N; i += 4) {
      const y = land.heights[j * (N + 1) + i];
      if (y >= 0) count[biome_at(cuts, ORIGIN + i * CELL, ORIGIN + j * CELL, y)]++;
    }
  return count;
}

test("every island splits its land above the shore into three regions of about a third each", () => {
  const count = shares();
  const inland = count.meadow + count.forest + count.upland;
  for (const biome of [Biome.MEADOW, Biome.FOREST, Biome.UPLAND]) {
    expect(count[biome] / inland).toBeGreaterThan(0.28);
    expect(count[biome] / inland).toBeLessThan(0.39);
  }
  expect(count.coast).toBeGreaterThan(0);
});

test("the dry upland sits higher than the meadows on average", () => {
  const heights: Record<Biome, number[]> = { coast: [], meadow: [], forest: [], upland: [] };
  for (let j = 0; j <= N; j += 4)
    for (let i = 0; i <= N; i += 4) {
      const y = land.heights[j * (N + 1) + i];
      if (y >= 0) heights[biome_at(cuts, ORIGIN + i * CELL, ORIGIN + j * CELL, y)].push(y);
    }
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  expect(mean(heights.upland)).toBeGreaterThan(mean(heights.meadow) + 10);
});

test("forests are dense, meadows open, and only scrub grows without a solid", () => {
  const { trees, solids } = plant(cuts, land, () => true);
  const per: Record<Biome, number> = { coast: 0, meadow: 0, forest: 0, upland: 0 };
  for (const t of trees) per[biome_at(cuts, t.x, t.z, t.y)]++;
  const area = shares();
  expect(per.forest / area.forest).toBeGreaterThan((4 * per.meadow) / area.meadow);
  const scrub = trees.filter((t) => t.kind === TreeKind.SCRUB);
  expect(scrub.length).toBeGreaterThan(0);
  expect(solids.length).toBe(trees.length - scrub.length);
});

test("the same seed plants the same trees", () => {
  const a = plant(cuts, land, () => true).trees;
  const b = plant(biome_cuts(SEED, terrain(SEED).heights), land, () => true).trees;
  expect(b).toEqual(a);
});

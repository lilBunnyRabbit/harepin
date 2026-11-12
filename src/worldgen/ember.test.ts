/// <reference types="bun" />
import { expect, test } from "bun:test";
import { JITTER_LEVELS, terrain_bases, terrain_colors, TERRAIN_BASES } from "./chunks";
import { generate_world } from "./kinds/kinds";
import { Ground, N, WorldKind } from "./types";

test("the crater wall takes the lava's glow over a band of heights, so the band's edge follows the slope, not the lattice", () => {
  const data = generate_world(1, WorldKind.VOLCANO);
  const pool = data.ground.ops.flatMap((op) => (op.kind === "lava" ? op.pools : []))[0];
  const rows = Object.fromEntries(Object.values(Ground).map((g) => [g, g === Ground.EMBER ? 1 : 0])) as Record<Ground, number>;
  const bases = terrain_bases(rows, () => 0, 0, 0);
  expect(bases.length).toBe(TERRAIN_BASES);
  const lut = new Float32Array(TERRAIN_BASES * JITTER_LEVELS * 3);
  bases.forEach((hot, b) => lut.fill(hot, b * JITTER_LEVELS * 3, (b + 1) * JITTER_LEVELS * 3));
  const glow = terrain_colors(data, lut);
  const { heights } = data.terrain;
  const between: number[] = [];
  let cold = 0;
  for (let k = 0; k < heights.length; k++) {
    const rise = heights[k] - pool.level;
    if (rise < 0 || rise > 30) continue;
    const g = glow[k * 3];
    if (rise > 20) cold = Math.max(cold, g);
    else if (g > 0 && g < 1) between.push(rise);
  }
  expect(cold).toBe(0);
  expect(between.length).toBeGreaterThan(N / 2);
  expect(Math.max(...between) - Math.min(...between)).toBeGreaterThan(4);
});

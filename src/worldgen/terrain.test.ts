import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { land_height, pan_floor } from "./terrain";
import { generate_world } from "./kinds/kinds";
import type { TerrainRecipe } from "./recipe";
import { WorldKind } from "./types";

const DUNE = { wave: 100, height: 10, lee: 0.2 };
const FLAT: TerrainRecipe = [{ kind: "dunes", seed: 0, bands: [DUNE] }];
/** Inside the dune wall the mask raises round the map's edge. */
const PLAY = 700;

test("a dune's lee face is steeper than its windward slope", () => {
  const height = land_height(3, FLAT);
  let up = 0;
  let down = 0;
  for (let x = -600; x < 600; x += 2)
    for (const z of [-200, 0, 200]) {
      const d = height(x + 2, z) - height(x, z);
      up = Math.max(up, d);
      down = Math.max(down, -d);
    }
  expect(Math.max(up, down) / Math.min(up, down)).toBeGreaterThan(2);
});

test("a pan fills its share of the map flat at one level and leaves higher ground untouched", () => {
  const base: TerrainRecipe = [{ kind: "fbm", scale: 400, seed: 7, octaves: 3, power: 1, amp: 30 }, ...FLAT];
  const shape: TerrainRecipe = [...base, { kind: "pan", share: 0.3, blend: 2 }];
  const level = (pan_floor(3, shape) ?? NaN) - 0.2;
  const height = land_height(3, shape);
  const bare = land_height(3, base);
  let flat = 0;
  let count = 0;
  for (let z = -1000; z <= 1000; z += 50)
    for (let x = -1000; x <= 1000; x += 50) {
      const h = bare(x, z);
      if (h <= level - 2) expect(height(x, z)).toBeCloseTo(level, 6);
      if (h >= level + 2) expect(height(x, z)).toBe(h);
      expect(height(x, z)).toBeGreaterThanOrEqual(level - 1e-6);
      if (Math.abs(height(x, z) - level) < 1e-6) flat++;
      count++;
    }
  expect(flat / count).toBeGreaterThan(0.15);
  expect(flat / count).toBeLessThan(0.3);
});

for (const seed of sweep(20))
  test(`big dunes ${seed}: no ground inside the play area, before or after stamping, is steeper than the 34 degree repose, and crests stand 90 m over the pans`, () => {
    const data = generate_world(seed, WorldKind.BIG_DUNES);
    if (data.ground.base.kind !== "terrain") throw new Error("big dunes is a terrain kind");
    const shape = data.ground.base.shape;
    const height = land_height(seed, shape);
    const floor = pan_floor(seed, shape) ?? NaN;
    const repose = Math.tan((34 * Math.PI) / 180);
    let steepest = 0;
    let top = -Infinity;
    for (let z = -PLAY; z <= PLAY; z += 8)
      for (let x = -PLAY; x <= PLAY; x += 8) {
        if (x * x + z * z > PLAY * PLAY) continue;
        steepest = Math.max(steepest, Math.hypot(height(x + 2, z) - height(x - 2, z), height(x, z + 2) - height(x, z - 2)) / 4);
        top = Math.max(top, height(x, z));
      }
    const { heights, cell, size } = data.terrain;
    const n = Math.round(Math.sqrt(heights.length));
    let stamped = 0;
    for (let j = 1; j < n - 1; j++)
      for (let i = 1; i < n - 1; i++) {
        const x = i * cell - size / 2;
        const z = j * cell - size / 2;
        if (x * x + z * z > PLAY * PLAY) continue;
        stamped = Math.max(stamped, Math.hypot(heights[j * n + i + 1] - heights[j * n + i - 1], heights[(j + 1) * n + i] - heights[(j - 1) * n + i]) / (2 * cell));
      }
    expect(steepest).toBeLessThan(repose);
    expect(stamped).toBeLessThan(repose);
    expect(top - floor).toBeGreaterThan(90);
  }, 30_000);

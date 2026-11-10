import { expect, test } from "bun:test";
import { land_height, pan_floor } from "./terrain";
import type { TerrainRecipe } from "./recipe";

const DUNE = { wave: 100, height: 10, lee: 0.2 };
const FLAT: TerrainRecipe = [{ kind: "dunes", seed: 0, bands: [DUNE] }];

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

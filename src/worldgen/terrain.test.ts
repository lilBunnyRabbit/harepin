import { expect, test } from "bun:test";
import { land_height } from "./terrain";
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

test("a pan fills ground under its level flat and leaves ground over it untouched", () => {
  const level = 6;
  const height = land_height(3, [...FLAT, { kind: "pan", level, blend: 2 }]);
  const bare = land_height(3, FLAT);
  for (let x = -400; x < 400; x += 7) {
    const h = bare(x, 50);
    if (h <= level - 2) expect(height(x, 50)).toBe(level);
    if (h >= level + 2) expect(height(x, 50)).toBe(h);
    expect(height(x, 50)).toBeGreaterThanOrEqual(level);
  }
});

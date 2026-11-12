import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { sample } from "./field";
import { land_height, pan_floor } from "./terrain";
import { generate_world } from "./kinds/kinds";
import type { TerrainRecipe } from "./recipe";
import { WorldKind } from "./types";

const DUNE = { wave: 100, height: 10, lee: 0.2 };
const FLAT: TerrainRecipe = [{ kind: "dunes", seed: 0, bands: [DUNE] }];
/** Inside the dune wall the mask raises round the map's edge. */
const PLAY = 700;
/** Packed dirt lines (planned at 14 degrees) climb at most 15 over any 20 m of their length: every car climbs that (car.test.ts "dune sand"). */
const PACKED_CLIMB = Math.tan((15 * Math.PI) / 180);
const PACKED_RUN = 5;
/** The bed's side trails and their shoulders reach this far from their own line, plus a cell for the central difference. */
const DUG = 14;

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
    const last = data.ground.ops.findLast((op) => op.kind === "trail");
    const bed = last?.kind === "trail" ? last.lines : [];
    // The packed bed is cut level across a slope, so its own edge may stand past repose; its banks may not.
    const dug = new Uint8Array(heights.length);
    const reach = Math.ceil(DUG / cell);
    for (const { points } of bed)
      for (const q of points) {
        const ci = Math.round((q.x + size / 2) / cell);
        const cj = Math.round((q.z + size / 2) / cell);
        for (let dj = -reach; dj <= reach; dj++) for (let di = -reach; di <= reach; di++) if (ci + di >= 0 && ci + di < n && cj + dj >= 0 && cj + dj < n) dug[(cj + dj) * n + ci + di] = 1;
      }
    let stamped = 0;
    for (let j = 1; j < n - 1; j++)
      for (let i = 1; i < n - 1; i++) {
        const x = i * cell - size / 2;
        const z = j * cell - size / 2;
        if (x * x + z * z > PLAY * PLAY || dug[j * n + i]) continue;
        stamped = Math.max(stamped, Math.hypot(heights[j * n + i + 1] - heights[j * n + i - 1], heights[(j + 1) * n + i] - heights[(j - 1) * n + i]) / (2 * cell));
      }
    expect(steepest).toBeLessThan(repose);
    expect(stamped).toBeLessThan(repose);
    expect(top - floor).toBeGreaterThan(90);
    expect(bed.length).toBeGreaterThan(0);
    let climb = 0;
    for (const { points } of bed.filter((_, i) => i % 3 === 1)) {
      const along = [0];
      for (let i = 1; i < points.length; i++) along.push(along[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
      for (let i = PACKED_RUN; i < points.length; i++) {
        const a = points[i - PACKED_RUN];
        const b = points[i];
        climb = Math.max(climb, Math.abs(sample(heights, b.x, b.z) - sample(heights, a.x, a.z)) / (along[i] - along[i - PACKED_RUN]));
      }
    }
    expect(climb).toBeLessThan(PACKED_CLIMB);
  }, 30_000);

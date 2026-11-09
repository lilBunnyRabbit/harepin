/// <reference types="bun" />
import { expect, test } from "bun:test";
import { carve, crossings, plan_canyon } from "./canyon";
import { sample } from "./field";
import { generate } from "./index";
import { loop_road } from "./path";
import { terrain } from "./terrain";

test("most seeds get one canyon, flank to coast, crossing the circuit at most once", () => {
  let found = 0;
  for (let seed = 0; seed < 20; seed++) {
    const land = terrain(seed);
    const { road } = loop_road(seed, land.heights);
    const canyon = plan_canyon(seed, land.heights, road);
    if (!canyon) continue;
    found++;
    const before = Float32Array.from(land.heights);
    carve(land.heights, canyon);
    expect(crossings(canyon.points, road).length).toBeLessThanOrEqual(1);
    const [sx, sz] = canyon.points[0];
    const [ex, ez] = canyon.points[canyon.points.length - 1];
    expect(sample(before, sx, sz)).toBeGreaterThan(sample(before, ex, ez) + 30);
    for (const [x, z] of canyon.points) {
      const was = sample(before, x, z);
      const now = sample(land.heights, x, z);
      if (was > 5) expect(now).toBeGreaterThanOrEqual(3.5 - 1e-3);
      if (was > canyon.depth + 4) expect(was - now).toBeGreaterThan(canyon.depth * 0.8);
    }
  }
  expect(found).toBeGreaterThanOrEqual(16);
}, 60_000);

test("the circuit keeps its causeway where it crosses the canyon", () => {
  const world = generate(0);
  expect(world.canyon).not.toBeNull();
  for (const p of world.road) expect(Math.abs(sample(world.terrain.heights, p.x, p.z) - p.y)).toBeLessThan(0.3);
}, 30_000);

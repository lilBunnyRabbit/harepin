/// <reference types="bun" />
import { expect, test } from "bun:test";
import { carve, crossings, plan_canyon } from "./canyon";
import { sample } from "./field";
import { generate } from "./index";
import { loop_road } from "./path";
import { terrain } from "./terrain";
import { FULL, sweep } from "../sweep";

test("most seeds get one canyon, flank to coast, crossing the circuit at most once", () => {
  let found = 0;
  for (const seed of sweep(20)) {
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
    // Per vertex: a point sampled between a carved vertex and one already under the floor dips below it.
    expect(before.filter((h, k) => h > 3.5 && land.heights[k] < 3.5).length).toBe(0);
    for (const [x, z] of canyon.points) {
      const was = sample(before, x, z);
      const now = sample(land.heights, x, z);
      if (was > canyon.depth + 4) expect(was - now).toBeGreaterThan(canyon.depth * 0.8);
    }
  }
  if (FULL) expect(found).toBeGreaterThanOrEqual(16);
}, 60_000);

test("the trail's canyon gap stays open: no bank or trail stamp fills the slot under it", () => {
  for (let seed = 0; seed < 10; seed++) {
    const world = generate(seed);
    const takeoff = world.ramps.find((r) => r.road && world.ramps.some((d) => d.kind === "landing" && d.id === r.id + 1));
    const landing = world.ramps.find((d) => takeoff && d.kind === "landing" && d.id === takeoff.id + 1);
    if (!takeoff || !landing) continue;
    const x = (takeoff.x + takeoff.fx * takeoff.length + landing.x) / 2;
    const z = (takeoff.z + takeoff.fz * takeoff.length + landing.z) / 2;
    expect(sample(world.terrain.heights, x, z)).toBeLessThan(landing.y - 4);
  }
}, 120_000);

test("the circuit keeps its causeway where it crosses the canyon", () => {
  const world = generate(0);
  expect(world.canyon).not.toBeNull();
  for (const p of world.road) expect(Math.abs(sample(world.terrain.heights, p.x, p.z) - p.y)).toBeLessThan(0.3);
}, 30_000);

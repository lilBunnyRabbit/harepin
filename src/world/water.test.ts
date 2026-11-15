/// <reference types="bun" />
import { expect, test } from "bun:test";
import { chunk_of, extent } from "../worldgen/chunk-grid";
import { build_tile } from "../worldgen/ground";
import { WINTER_GRIP } from "../worldgen/kinds/kind-def";
import { MAINLAND_KNOBS } from "../worldgen/kinds/land-knobs";
import { tune } from "../worldgen/kinds/options";
import { MAINLAND_SIZE, plan_mainland } from "../worldgen/mainland";
import { MAINLAND } from "../worldgen/recipe";
import { SurfaceId } from "../worldgen/types";
import { water_index } from "../worldgen/water";
import { DEEP_WATER, World } from "./world";

const EXT = extent(MAINLAND_SIZE);

const WINTER = [1];

function mainland(seed: number, levels: number[] = []) {
  const { data } = plan_mainland(seed, tune(MAINLAND, MAINLAND_KNOBS, levels));
  const world = new World(seed, data, [], levels);
  const load = (x: number, z: number) => {
    const index = chunk_of(x, z, EXT);
    if (!world.tiles.get(index)) world.tiles.add(index, build_tile(data.ground, index, EXT));
  };
  const op = data.ground.ops.find((o) => o.kind === "water");
  if (op?.kind !== "water") throw new Error("mainland plans no water");
  return { world, rivers: op.water.rivers, water: water_index(op.water), load };
}

test("deep water resets on its depth over the ground, not on where the car's origin rides", () => {
  const { world, rivers, load } = mainland(0);
  const deep = rivers.flat().find((p) => {
    load(p.x, p.z);
    return world.depth(p.x, p.z) > DEEP_WATER;
  });
  if (!deep) throw new Error("no deep river point on seed 0");
  expect(world.drowned(deep.x, deep.z)).toBe(true);
  const start = world.road[0];
  load(start.x, start.z);
  expect(world.drowned(start.x, start.z)).toBe(false);
});

test("grip then roll at one wheel reads the footing once and agrees with footing()", () => {
  const { world, rivers, load } = mainland(0);
  for (const p of rivers[0].filter((_, i) => i % 25 === 0)) {
    load(p.x, p.z);
    const { grip, roll } = { ...world.footing(p.x, p.z) };
    expect(world.grip(p.x, p.z)).toBe(grip);
    expect(world.roll(p.x, p.z)).toBe(roll);
    expect(world.roll(p.x + 4, p.z)).toBe(world.footing(p.x + 4, p.z).roll);
  }
});

test("winter freezes every lake and river: the car stands on ice, never under the water's surface", () => {
  const { world, rivers, water, load } = mainland(0, WINTER);
  let checked = 0;
  for (const p of rivers.flat().filter((_, i) => i % 7 === 0)) {
    load(p.x, p.z);
    const level = water.level(p.x, p.z);
    if (!Number.isFinite(level)) continue;
    expect(world.drowned(p.x, p.z)).toBe(false);
    expect(world.depth(p.x, p.z)).toBeLessThanOrEqual(0);
    expect(world.surface(p.x, p.z)).toBe(SurfaceId.ICE);
    if (world.distance_to_road(p.x, p.z) > 12) expect(world.footing(p.x, p.z)).toBe(WINTER_GRIP.surfaces[SurfaceId.ICE]);
    expect(world.height(p.x, p.z)).toBeGreaterThan(level - 0.01);
    checked++;
  }
  expect(checked).toBeGreaterThan(20);
});

test("winter ice meets its banks without a step: across a river the ground never jumps between half-metre samples", () => {
  const { world, rivers, load } = mainland(0, WINTER);
  for (const river of rivers)
    for (let i = 1; i < river.length; i += 40) {
      const a = river[i - 1];
      const b = river[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const nx = -(b.z - a.z) / len;
      const nz = (b.x - a.x) / len;
      let last = NaN;
      for (let s = -(b.half + 30); s <= b.half + 30; s += 0.5) {
        const x = b.x + nx * s;
        const z = b.z + nz * s;
        load(x, z);
        const y = world.height(x, z);
        if (Number.isFinite(last)) expect(Math.abs(y - last)).toBeLessThan(0.6);
        last = y;
      }
    }
});

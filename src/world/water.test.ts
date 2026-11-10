/// <reference types="bun" />
import { expect, test } from "bun:test";
import { chunk_of, extent } from "../worldgen/chunk-grid";
import { build_tile } from "../worldgen/ground";
import { MAINLAND_SIZE, plan_mainland } from "../worldgen/mainland";
import { DEEP_WATER, World } from "./world";

const EXT = extent(MAINLAND_SIZE);

function mainland(seed: number) {
  const { data } = plan_mainland(seed);
  const world = new World(seed, data, []);
  const load = (x: number, z: number) => {
    const index = chunk_of(x, z, EXT);
    if (!world.tiles.get(index)) world.tiles.add(index, build_tile(data.ground, index, EXT));
  };
  const op = data.ground.ops.find((o) => o.kind === "water");
  if (op?.kind !== "water") throw new Error("mainland plans no water");
  return { world, rivers: op.water.rivers, load };
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

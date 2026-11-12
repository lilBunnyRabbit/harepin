/// <reference types="bun" />
import { expect, test } from "bun:test";
import { World } from "../world/world";
import { generate_sky } from "../worldgen/sky";
import { sweep } from "../sweep";
import { VIEWS } from "./catalog";
import { plan_views, view_of } from "./viewpoints";

const finite = (v: readonly number[]) => v.every(Number.isFinite);

test("every island view stands clear of the ground, on the circuit, looking somewhere else", async () => {
  for (const seed of sweep(3)) {
    const world = new World(seed);
    const planned = plan_views(world);
    expect(Object.keys(planned)).toEqual([...VIEWS]);
    for (const name of VIEWS) {
      const view = await view_of(world, name);
      if (!view) throw new Error(`seed ${seed}: no ${name} view`);
      expect(view.at).toBeGreaterThanOrEqual(0);
      expect(view.at).toBeLessThan(world.road.length);
      expect(finite(view.from) && finite(view.to)).toBe(true);
      expect(view.from[1]).toBeGreaterThan(world.height(view.from[0], view.from[2]));
      expect(Math.hypot(view.to[0] - view.from[0], view.to[2] - view.from[2])).toBeGreaterThan(1);
    }
  }
}, 60_000);

test("a sky world has no shore view, and an unknown name none at all", async () => {
  const world = new World(2, generate_sky(2));
  expect(plan_views(world).shore).toBeUndefined();
  expect(await view_of(world, "nowhere")).toBeNull();
});

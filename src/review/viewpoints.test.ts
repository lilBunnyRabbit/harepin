/// <reference types="bun" />
import { expect, test } from "bun:test";
import { World } from "../world/world";
import { extent } from "../worldgen/chunk-grid";
import { DUNE_SEA_SIZE, generate_dune_sea } from "../worldgen/dune-sea";
import { build_tile } from "../worldgen/ground";
import { generate_sky } from "../worldgen/sky";
import { sweep } from "../sweep";
import { VIEWS } from "./catalog";
import { plan_views, view_of } from "./viewpoints";

const finite = (v: readonly number[]) => v.every(Number.isFinite);
const ROAD_VIEWS = VIEWS.filter((name) => name !== "crest" && name !== "bowl" && name !== "rim");

test("every island view stands clear of the ground, on the circuit, looking somewhere else", async () => {
  for (const seed of sweep(3)) {
    const world = new World(seed);
    const planned = plan_views(world);
    expect(Object.keys(planned)).toEqual(ROAD_VIEWS);
    for (const name of ROAD_VIEWS) {
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

test("a world with a road has no crest view", async () => {
  expect(await view_of(new World(0), "crest")).toBeNull();
});

test("a road-less dune sea has its start and a crest view: over a dune downwind of the spawn, looking on down the wind", async () => {
  for (const seed of sweep(3)) {
    const data = generate_dune_sea(seed);
    const world = new World(seed, data, []);
    const ext = extent(DUNE_SEA_SIZE);
    if (data.ground.base.kind !== "terrain") throw new Error("the dune sea is a terrain kind");
    // A test has no worker to stream from: build each chunk asked for, after the wait on it is queued.
    world.tiles.on_need = (missing) => queueMicrotask(() => missing.forEach((index) => world.tiles.add(index, build_tile(data.ground, index, ext))));
    expect(Object.keys(plan_views(world))).toEqual(["start"]);
    const view = await view_of(world, "crest");
    if (!view) throw new Error(`seed ${seed}: no crest view`);
    const spawn = world.road[0];
    expect(view.at).toBe(0);
    expect(finite(view.from) && finite(view.to)).toBe(true);
    expect(view.from[1]).toBeGreaterThan(world.height(view.from[0], view.from[2]));
    expect(view.to[1]).toBeLessThan(view.from[1]);
    const ahead = (p: readonly number[]) => (p[0] - spawn.x) * spawn.tx + (p[2] - spawn.z) * spawn.tz;
    expect(ahead(view.to)).toBeGreaterThan(ahead(view.from));
  }
}, 60_000);

test("a sky world has no shore view, and an unknown name none at all", async () => {
  const world = new World(2, generate_sky(2));
  expect(plan_views(world).shore).toBeUndefined();
  expect(await view_of(world, "nowhere")).toBeNull();
});

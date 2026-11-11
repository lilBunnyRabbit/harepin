/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { sweep } from "../sweep";
import { generate_world } from "../worldgen/kinds/kinds";
import { CELL, SPAWN_INDEX, SurfaceId, WorldKind } from "../worldgen/types";
import { World } from "./world";

test("a car down in the crater's lava has fallen; one jumping over it, or on the rim road, has not", () => {
  const data = generate_world(0, WorldKind.VOLCANO);
  const world = new World(0, data);
  const { surface, heights, size } = data.terrain;
  const n = Math.round(Math.sqrt(surface.length));
  const k = surface.indexOf(SurfaceId.LAVA);
  expect(k).toBeGreaterThanOrEqual(0);
  const x = (k % n) * CELL - size / 2;
  const z = Math.floor(k / n) * CELL - size / 2;
  expect(world.fallen(new Vector3(x, heights[k] + 0.6, z))).toBe(true);
  expect(world.fallen(new Vector3(x, heights[k] + 10, z))).toBe(false);
  const spawn = data.road[(SPAWN_INDEX + data.road.length) % data.road.length];
  expect(world.fallen(new Vector3(spawn.x, spawn.y + 0.6, spawn.z))).toBe(false);
});

for (const seed of sweep(10))
  test(`volcano ${seed}: no road, route, tree or prop runs into lava`, () => {
    const data = generate_world(seed, WorldKind.VOLCANO);
    const world = new World(seed, data);
    const lava = (x: number, z: number) => world.surface(x, z) === SurfaceId.LAVA;
    expect(data.road.filter((p) => lava(p.x, p.z))).toEqual([]);
    expect(data.routes.filter((r) => r.points.some((p) => lava(p.x, p.z))).map((r) => r.id)).toEqual([]);
    expect([...data.trees, ...data.props, ...data.items].filter((t) => lava(t.x, t.z))).toEqual([]);
  });

/// <reference types="bun" />
import "../../scripts/fake-dom";
import { expect, test } from "bun:test";

test("skid marks draw with the contact patch, before the cars, in the opaque pass, so a tyre always covers them", async () => {
  const { Skids } = await import("./effects");
  const { CAR_ORDER, DECAL_ORDER } = await import("../car/contact-shadow");
  const { mesh } = new Skids();
  const material = mesh.material as import("three").Material;
  expect(DECAL_ORDER).toBeLessThan(CAR_ORDER);
  expect(mesh.renderOrder).toBe(DECAL_ORDER);
  expect([material.transparent, material.depthWrite]).toEqual([false, false]);
});

test("a skid mark blends its colour only: custom blending on alpha too left the frame see-through, and the page showed in every mark", async () => {
  const { Skids } = await import("./effects");
  const { ZeroFactor, OneFactor } = await import("three");
  const material = new Skids().mesh.material as import("three").Material;
  expect([material.blendSrcAlpha, material.blendDstAlpha]).toEqual([ZeroFactor, OneFactor]);
});

test("puffs draw after the cars and the water, so spray shows on the surface it is thrown from", async () => {
  const { Smoke } = await import("./effects");
  const { CAR_ORDER } = await import("../car/contact-shadow");
  expect(new Smoke("grass").mesh.renderOrder).toBeGreaterThan(CAR_ORDER);
});

test("puffs are unlit, so a puff keeps its tint at dusk instead of going near black", async () => {
  const { Smoke } = await import("./effects");
  const material = new Smoke("dust").mesh.material as import("three").Material;
  expect([material.type, material.transparent, material.depthWrite]).toEqual(["MeshBasicMaterial", true, false]);
});

async function touchdown(sink: number) {
  const { Smoke } = await import("./effects");
  const { Vector3, Matrix4 } = await import("three");
  const wheels = [0, 1, 2, 3].map((i) => ({ contact: false, point: new Vector3(i, 0, 0), lateral: 0, slip: 0 }));
  const car = { vel: new Vector3(0, -sink, 10), wheels };
  const world = { on_road: () => true, depth: () => -1, water_level: () => 0, surface: () => 0, footing: () => 0, own_ground: 0 };
  const smoke = new Smoke("grass");
  const update = (dt: number) => smoke.update(dt, car as never, world as never);
  for (let t = 0; t < 0.4; t += 0.05) update(0.05);
  for (const w of wheels) w.contact = true;
  car.vel.y = 0;
  update(0.02);
  const m = new Matrix4();
  const s = new Vector3();
  let live = 0;
  for (let i = 0; i < smoke.mesh.count; i++) {
    smoke.mesh.getMatrixAt(i, m);
    if (s.setFromMatrixScale(m).x > 0) live++;
  }
  return live;
}

test("a wheel landing from a drop throws a burst; rolling over a crest throws none", async () => {
  expect(await touchdown(4)).toBeGreaterThan(0);
  expect(await touchdown(0)).toBe(0);
});

test("wheel dust on an island beach is the beach's sand, not the turf's soil", async () => {
  const { Smoke } = await import("./effects");
  const { World } = await import("../world/world");
  const { biome_at, biome_cuts } = await import("../worldgen/biomes");
  const { ISLAND } = await import("../worldgen/recipe");
  const { generate } = await import("../worldgen/index");
  const { Biome } = await import("../worldgen/biomes");
  const data = generate(0);
  const world = new World(0, data);
  const cuts = biome_cuts(data.terrain.seed, data.terrain.heights, ISLAND.biomes);
  const own = (x: number, z: number) => !world.on_road(x, z) && world.surface(x, z) === 0 && world.footing(x, z) === world.own_ground && world.depth(x, z) <= 0;
  const find = (beach: boolean) => {
    for (let x = -1200; x < 1200; x += 7)
      for (let z = -1200; z < 1200; z += 7) {
        const y = world.tiles.height(x, z);
        if (y > 0 && own(x, z) && (biome_at(cuts, x, z, y) === Biome.COAST || y < ISLAND.biomes.limits.beach) === beach) return [x, z] as const;
      }
    throw new Error("no point");
  };
  const grass = new Smoke("grass");
  const [bx, bz] = find(true);
  const [ix, iz] = find(false);
  const sand = new Smoke("dust").dust_tint(world, ix, iz);
  expect(grass.dust_tint(world, bx, bz).getHex()).toBe(sand.getHex());
  expect(grass.dust_tint(world, ix, iz).getHex()).not.toBe(sand.getHex());
});

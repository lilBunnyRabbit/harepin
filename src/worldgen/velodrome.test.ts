/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { generate_world } from "./kinds/kinds";
import { generate_sky } from "./sky";
import { DECK_STRIDE, WorldKind } from "./types";

const DEG = Math.PI / 180;
const worlds = sweep(10).map((seed) => generate_world(seed, WorldKind.VELODROME));

function banks(world: (typeof worlds)[number]): number[] {
  const line = world.deck?.line;
  if (!line) throw new Error("velodrome world without a deck");
  return Array.from({ length: line.length / DECK_STRIDE }, (_, i) => Math.abs(line[i * DECK_STRIDE + 5]));
}

test("a velodrome seed draws its own track, not the sky track of the same seed", () => {
  for (const seed of [0, 1]) expect(generate_world(seed, WorldKind.VELODROME).road[5]).not.toEqual(generate_sky(seed).road[5]);
  for (const world of worlds) expect(world.kind).toBe(WorldKind.VELODROME);
});

test("every lap has a bowl each way, kicked past 60° and never past 70°", () => {
  for (const world of worlds) {
    const line = world.deck?.line ?? new Float64Array();
    const steep = banks(world).map((b, i) => (b > 40 * DEG ? Math.sign(line[i * DECK_STRIDE + 5]) : 0));
    expect(steep).toContain(1);
    expect(steep).toContain(-1);
    const most = Math.max(...banks(world));
    expect(most).toBeGreaterThan(60 * DEG);
    expect(most).toBeLessThanOrEqual(70 * DEG + 1e-9);
  }
});

test("no route of a velodrome is raced in the bus", () => {
  for (const world of worlds) for (const route of world.routes) expect(route.excludes).toEqual(["bus"]);
});

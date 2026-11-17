/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { World } from "../world/world";
import { sample } from "./field";
import { generate_world, KINDS } from "./kinds/kinds";
import { tune } from "./kinds/options";
import { RACEWAY_KNOBS } from "./kinds/raceway";
import { RACEWAY } from "./raceway";
import { BAYS, GRAVEL_NEAR, layout_of, side_index, STAND_FRONT, stand_depth, WALL } from "./raceway-layout";
import { BAY_HEIGHT, TYRE_HEIGHT, WALL_HEIGHT } from "./raceway-venue";
import { CELL, ROAD_HALF, SurfaceId, WorldKind, type Solid, type WorldData } from "./types";

type Box = Extract<Solid, { kind: "box" }>;

const NARROW = KINDS[WorldKind.RACEWAY].options.map((o) => (o.name === "Run-off" ? 0 : o.normal));
const plain = sweep(10).map((seed) => generate_world(seed, WorldKind.RACEWAY));
const narrow = sweep(4).map((seed) => generate_world(seed, WorldKind.RACEWAY, NARROW));
const boxes = (data: WorldData) => data.solids.filter((s): s is Box => s.kind === "box");
const layout = (data: WorldData, levels: readonly number[] = []) => layout_of(data.road, tune(RACEWAY, RACEWAY_KNOBS, levels).stand);

function gap(box: Box, x: number, z: number): number {
  const ox = x - box.x;
  const oz = z - box.z;
  return Math.max(Math.abs(ox * box.cos - oz * box.sin) - box.hw, Math.abs(ox * box.sin + oz * box.cos) - box.hd);
}

function nearest(all: readonly Box[], points: readonly { x: number; z: number }[]): number {
  let best = Infinity;
  for (const box of all) {
    const reach = box.hw + box.hd + best;
    for (const p of points) if (Math.abs(p.x - box.x) < reach && Math.abs(p.z - box.z) < reach) best = Math.min(best, gap(box, p.x, p.z));
  }
  return best;
}

test("every raceway has its terrace, ten garages, walls and a tyre wall, none of them on the road", () => {
  for (const data of plain) {
    const all = boxes(data);
    const found = layout(data);
    expect(found.stands.length).toBe(6);
    expect(found.bays.length).toBe(BAYS);
    expect(all.filter((b) => b.height >= BAY_HEIGHT && b.hw > 4).length).toBe(6 + BAYS);
    expect(all.filter((b) => b.soft).length).toBeGreaterThan(20);
    expect(all.filter((b) => !b.soft && b.hw < 0.5).length).toBeGreaterThan(200);
    expect(nearest(all, data.road)).toBeGreaterThan(ROAD_HALF + 1.5);
  }
});

test("a barrier stands on the ground along its whole length and never much over its height", () => {
  for (const data of plain)
    for (const box of boxes(data).filter((b) => b.hw < 0.5)) {
      expect(box.hd).toBeLessThan(4.5);
      expect(box.y).toBeLessThanOrEqual(sample(data.terrain.heights, box.x, box.z) + 1e-6);
      expect(box.height).toBeLessThan(Math.max(WALL_HEIGHT, TYRE_HEIGHT) + 1);
    }
});

test("walls line the pit straight a car's width off the road, the pit wall between it and the lane", () => {
  for (const data of plain) {
    const found = layout(data);
    for (const s of [0, 10, data.road.length - 20]) expect(found.concrete[side_index(-found.inside)][s]).toBeCloseTo(WALL, 5);
    expect(found.concrete[side_index(found.inside)][10]).toBeCloseTo(WALL, 5);
  }
});

test("gravel lies outside each hairpin and slow corner, drives as its own row, and leaves the road asphalt", () => {
  const def = KINDS[WorldKind.RACEWAY];
  for (const data of plain.slice(0, 4)) {
    const world = new World(0, data);
    const found = layout(data);
    const traps = found.bends.filter((b) => b.kind !== "fast" && found.gravel[side_index(-b.sign)][b.apex] >= 2 * CELL - 1);
    expect(traps.length).toBeGreaterThan(0);
    for (const bend of traps) {
      const p = data.road[bend.apex];
      const off = -bend.sign * (GRAVEL_NEAR + CELL);
      expect(world.footing(p.x - p.tz * off, p.z + p.tx * off)).toBe(def.grip.surfaces[SurfaceId.GRAVEL]);
      expect(world.footing(p.x, p.z)).toBe(def.grip.road);
    }
    const p = data.road[20];
    expect(world.footing(p.x - p.tz * 12, p.z + p.tx * 12)).not.toBe(def.grip.surfaces[SurfaceId.GRAVEL]);
  }
  expect(def.grip.surfaces[SurfaceId.GRAVEL].roll).toBeGreaterThan(def.grip.surfaces[SurfaceId.GRASS].roll);
});

test("no tree stands in or against a stand, a garage or a barrier, whatever the run-off", () => {
  for (const data of [...plain, ...narrow]) expect(nearest(boxes(data), data.trees)).toBeGreaterThan(2);
});

test("Narrow run-off builds a low, short terrace that ends inside what the trees leave", () => {
  for (const data of narrow) {
    const found = layout(data, NARROW);
    expect(found.tiers).toBe(3);
    expect(found.stands.length).toBeLessThanOrEqual(4);
    expect(STAND_FRONT + stand_depth(found.tiers)).toBeLessThan(18 + 1);
  }
  expect(STAND_FRONT + stand_depth(RACEWAY.stand.tiers)).toBeLessThan(RACEWAY.runoff);
});

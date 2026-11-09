/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { World } from "../world";
import { generate_sky, sky_layout } from "./sky";
import { DECK_STRIDE, SPAWN_INDEX } from "./types";

const SEEDS = 12;
const worlds = Array.from({ length: SEEDS }, (_, seed) => generate_sky(seed));

test("the lap closes on itself in position and heading", () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const layout = sky_layout(seed);
    expect(layout.error).toBeLessThan(1e-6);
    const turned = layout.pieces.reduce((h, p) => h + (p.kind === "arc" ? p.curve * (p.length - p.ease) : 0), 0);
    expect(turned).toBeCloseTo(2 * Math.PI, 9);
  }
});

test("a seed makes the same track every time", () => {
  const again = generate_sky(5);
  expect(again.deck?.line).toEqual(worlds[5].deck?.line);
  expect(again.solids).toEqual(worlds[5].solids);
  expect(again.checkpoints).toEqual(worlds[5].checkpoints);
});

test("sections that aren't neighbours keep 40 m apart, and the track stays inside the map and the sky", () => {
  for (const world of worlds) {
    const { road } = world;
    const step = Math.hypot(road[1].x - road[0].x, road[1].z - road[0].z);
    const skip = Math.ceil(120 / step);
    let closest = Infinity;
    for (let i = 0; i < road.length; i += 3)
      for (let j = i + skip; j < road.length; j += 3) if (road.length - (j - i) >= skip) closest = Math.min(closest, Math.hypot(road[i].x - road[j].x, road[i].z - road[j].z));
    expect(closest).toBeGreaterThan(40);
    for (const p of road) {
      expect(Math.abs(p.x)).toBeLessThan(900);
      expect(Math.abs(p.z)).toBeLessThan(900);
      expect(p.y).toBeGreaterThan(120);
      expect(p.y).toBeLessThan(420);
    }
  }
});

test("grade stays within 10% up and 25% down and bank rolls in at most 1.2° per metre", () => {
  for (const world of worlds) {
    const line = world.deck?.line;
    if (!line) throw new Error("sky world without a deck");
    const n = line.length / DECK_STRIDE;
    for (let i = 0; i < n; i++) {
      const a = i * DECK_STRIDE;
      const b = ((i + 1) % n) * DECK_STRIDE;
      const run = Math.hypot(line[b] - line[a], line[b + 2] - line[a + 2]);
      const grade = (line[b + 1] - line[a + 1]) / run;
      expect(grade).toBeLessThan(0.1 + 1e-9);
      expect(grade).toBeGreaterThan(-0.25 - 1e-9);
      expect(Math.abs(line[b + 5] - line[a + 5]) / run).toBeLessThan((1.2 * Math.PI) / 180 + 1e-9);
    }
  }
});

test("the surface normal is continuous along the deck, joints included", () => {
  const n0 = new Vector3();
  const n1 = new Vector3();
  for (const seed of [0, 3, 7]) {
    const world = new World(seed, worlds[seed]);
    const { road } = world;
    for (let i = 0; i < road.length; i++) {
      const p = road[i];
      for (const u of [-4, 0, 4]) {
        const x = p.x + p.tz * u;
        const z = p.z - p.tx * u;
        world.normal(x - p.tx * 0.1, z - p.tz * 0.1, n0);
        world.normal(x + p.tx * 0.1, z + p.tz * 0.1, n1);
        expect(n0.angleTo(n1)).toBeLessThan((0.5 * Math.PI) / 180);
      }
    }
  }
});

test("checkpoints, the start line and the spawn sit on unbanked deck, and the rails keep the car on it", () => {
  for (const world of worlds) {
    const w = new World(0, world);
    const deck = w.deck;
    if (!deck) throw new Error("sky world without a deck");
    const spawn = world.road[(SPAWN_INDEX + world.road.length) % world.road.length];
    for (const p of [...world.checkpoints, spawn]) {
      const i = deck.nearest(p.x, p.z);
      expect(deck.at(i, 5)).toBe(0);
      expect(w.height(p.x, p.z)).toBeCloseTo(p.y, 6);
    }
    expect(world.checkpoints.length).toBeGreaterThan(4);
    expect(world.solids.filter((s) => s.kind === "box").length).toBeGreaterThan(world.road.length * 0.9);
  }
});

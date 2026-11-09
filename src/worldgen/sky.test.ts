/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { World } from "../world";
import { generate_sky, rail_open, sky_layout, size_gap } from "./sky";
import { DECK_STRIDE, SPAWN_INDEX } from "./types";

const SEEDS = 12;
const worlds = Array.from({ length: SEEDS }, (_, seed) => generate_sky(seed));

/** Kicker face and gap: a step in grade by design, and the one place the deck may climb past 10%. */
function in_jump(world: (typeof worlds)[number], s: number): boolean {
  return (world.deck?.pieces ?? []).some((p) => (p.kind === "kicker" || p.kind === "gap") && s >= p.s0 - 2.5 && s <= p.s0 + p.length + 2.5);
}

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

function run_short(line: Float64Array, a: number, b: number): boolean {
  return Math.hypot(line[b] - line[a], line[b + 2] - line[a + 2]) < 0.5;
}

test("grade stays within 10% up and 25% down and bank rolls in at most 1.2° per metre", () => {
  for (const world of worlds) {
    const line = world.deck?.line;
    if (!line) throw new Error("sky world without a deck");
    const n = line.length / DECK_STRIDE;
    for (let i = 0; i < n; i++) {
      const a = i * DECK_STRIDE;
      const b = ((i + 1) % n) * DECK_STRIDE;
      if (in_jump(world, line[a + 8]) || run_short(line, a, b)) continue;
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
    const line = worlds[seed].deck?.line ?? new Float64Array();
    for (let i = 0; i < road.length; i++) {
      const p = road[i];
      if (in_jump(worlds[seed], line[i * DECK_STRIDE + 8])) continue;
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
    expect(world.solids.filter((s) => s.kind === "box").length).toBeGreaterThan(world.road.length * 0.6);
  }
});

test("every seed gets gap jumps, each with a checkpoint on the flat before its run-up and no rail across the gap", () => {
  const { gap } = size_gap();
  for (const world of worlds) {
    expect(world.ramps.length).toBeGreaterThan(0);
    for (const r of world.ramps) {
      expect(r.deck).toBe(true);
      const before = world.checkpoints.filter((c) => {
        const along = (c.x - r.x) * r.fx + (c.z - r.z) * r.fz;
        return along < -30 && along > -90 && Math.abs((c.x - r.x) * r.fz - (c.z - r.z) * r.fx) < 3;
      });
      expect(before.length).toBe(1);
      const mid = r.length + gap / 2;
      const mx = r.x + r.fx * mid;
      const mz = r.z + r.fz * mid;
      const w = new World(0, world);
      expect(w.height(mx, mz)).toBeLessThan(r.y - 100);
      for (const s of world.solids) if (s.kind === "box") expect(Math.hypot(s.x - mx, s.z - mz)).toBeGreaterThan(gap / 2 - 3);
    }
  }
});

test("open sections drop a rail on 15-30% of the lap, only on straights and wide flat arcs, clear of banks and jumps", () => {
  const { span } = size_gap();
  for (const world of worlds) {
    const deck = world.deck;
    if (!deck) throw new Error("sky world without a deck");
    const length = deck.line[deck.line.length - DECK_STRIDE + 8];
    const open = deck.open.reduce((sum, o) => sum + o.s1 - o.s0, 0);
    expect(deck.open.length).toBeGreaterThan(0);
    expect(open / length).toBeLessThan(0.31);
    for (let i = 0; i < deck.line.length / DECK_STRIDE; i++) {
      const s = deck.line[i * DECK_STRIDE + 8];
      if (!rail_open(deck.open, s, 1) && !rail_open(deck.open, s, -1)) continue;
      expect(deck.line[i * DECK_STRIDE + 5]).toBe(0);
      for (const r of world.ramps) {
        const toe = deck.line[world.road.findIndex((p) => p.x === r.x && p.z === r.z) * DECK_STRIDE + 8];
        expect(s < toe - 70 || s > toe + span + 50).toBe(true);
      }
    }
  }
});

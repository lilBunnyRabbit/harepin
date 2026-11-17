/// <reference types="bun" />
import { expect, test } from "bun:test";
import { field_races } from "../modes/field-route";
import { sweep } from "../sweep";
import { sample } from "./field";
import { generate_world, KINDS } from "./kinds/kinds";
import { RUNOFF } from "./raceway";
import { ATTEMPTS, BOUND, CLEARANCE, Corner, crowded, FALLBACK_SEED, LAP_LENGTH, NEIGHBOUR, raceway_lap } from "./raceway-plan";
import { ROAD_HALF, SPAWN_INDEX, WorldKind } from "./types";

const SEEDS = sweep(20);
const laps = SEEDS.map((seed) => raceway_lap(seed));
const worlds = sweep(10).map((seed) => generate_world(seed, WorldKind.RACEWAY));
const MIN_RADIUS = 20;
const MAX_GRADE = 0.12;
const GRID = 60;

function radius(path: readonly (readonly [number, number])[], i: number, span: number): number {
  const n = path.length;
  const [ax, az] = path[(i - span + n) % n];
  const [bx, bz] = path[i];
  const [cx, cz] = path[(i + span) % n];
  const cross = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
  return cross < 1e-9 ? Infinity : (Math.hypot(bx - ax, bz - az) * Math.hypot(cx - bx, cz - bz) * Math.hypot(cx - ax, cz - az)) / (2 * cross);
}

test("every seed draws its own lap inside the attempts", () => {
  for (const lap of laps) expect(lap.attempt).toBeLessThan(ATTEMPTS);
  expect(raceway_lap(FALLBACK_SEED).attempt).toBeLessThan(ATTEMPTS);
});

test("a lap closes: even 2 m steps all the way round, the last one back onto the first point", () => {
  for (const { path } of laps)
    path.forEach(([x, z], i) => {
      const [nx, nz] = path[(i + 1) % path.length];
      const step = Math.hypot(nx - x, nz - z);
      expect(step).toBeGreaterThan(1);
      expect(step).toBeLessThan(3.01);
    });
});

test("a lap turns once round, left on some seeds and right on others", () => {
  const turned = laps.map(({ path }) => {
    let sum = 0;
    path.forEach(([x, z], i) => {
      const [px, pz] = path[(i - 1 + path.length) % path.length];
      const [nx, nz] = path[(i + 1) % path.length];
      sum += Math.atan2((x - px) * (nz - z) - (z - pz) * (nx - x), (x - px) * (nx - x) + (z - pz) * (nz - z));
    });
    return sum / (2 * Math.PI);
  });
  for (const t of turned) expect(Math.abs(t)).toBeCloseTo(1, 6);
  expect(new Set(turned.map((t) => Math.sign(t))).size).toBe(2);
});

test("no two stretches of a lap that are not neighbours come within the clearance", () => {
  for (const { path } of laps) {
    expect(crowded(path)).toBe(false);
    const n = path.length;
    let nearest = Infinity;
    for (let i = 0; i < n; i += 3)
      for (let j = i + NEIGHBOUR / 2; j < n; j++) {
        if (n - j + i < NEIGHBOUR / 2) break;
        nearest = Math.min(nearest, Math.hypot(path[j][0] - path[i][0], path[j][1] - path[i][1]));
      }
    expect(nearest).toBeGreaterThanOrEqual(CLEARANCE);
  }
});

test("a lap holds its length, fits the map and never bends tighter than a chicane", () => {
  for (const { path, length } of laps) {
    expect(length).toBeGreaterThanOrEqual(LAP_LENGTH[0]);
    expect(length).toBeLessThanOrEqual(LAP_LENGTH[1]);
    expect(Math.abs(path.length * 2 - length)).toBeLessThan(4);
    for (const [x, z] of path) expect(Math.max(Math.abs(x), Math.abs(z))).toBeLessThanOrEqual(BOUND);
    for (let i = 0; i < path.length; i++) expect(radius(path, i, 3)).toBeGreaterThan(MIN_RADIUS * 0.95);
  }
});

test("every lap has a hairpin, esses and a sweeper onto the pit straight", () => {
  for (const { corners } of laps) {
    expect(corners).toContain(Corner.HAIRPIN);
    expect(corners).toContain(Corner.ESSES);
    expect(corners.at(-1)).toBe(Corner.SWEEPER);
  }
});

test("the pit straight is straight for the grid behind the line and well past it", () => {
  for (const { path } of laps) for (let k = -GRID; k <= GRID; k++) expect(radius(path, (k + path.length) % path.length, 3)).toBeGreaterThan(5000);
});

test("a seed makes the same lap every time, and seeds differ", () => {
  expect(raceway_lap(3)).toEqual(raceway_lap(3));
  expect(raceway_lap(3).path[40]).not.toEqual(raceway_lap(4).path[40]);
});

test("the road follows the hills inside the grade limit and the ground lies level across it", () => {
  for (const world of worlds) {
    const { road } = world;
    let low = Infinity;
    let high = -Infinity;
    road.forEach((p, i) => {
      const next = road[(i + 1) % road.length];
      expect(Math.abs(next.y - p.y) / Math.hypot(next.x - p.x, next.z - p.z)).toBeLessThanOrEqual(MAX_GRADE + 1e-6);
      low = Math.min(low, p.y);
      high = Math.max(high, p.y);
      for (const side of [-1, 1]) expect(Math.abs(sample(world.terrain.heights, p.x - p.tz * side * (ROAD_HALF - 1), p.z + p.tx * side * (ROAD_HALF - 1)) - p.y)).toBeLessThan(0.4);
    });
    expect(high - low).toBeGreaterThan(3);
  }
});

test("a raceway races: a lap and its reverse an AI field can run, the spawn on the road", () => {
  const def = KINDS[WorldKind.RACEWAY];
  for (const world of worlds) {
    expect(world.routes.map((r) => r.id)).toEqual(["circuit", "circuit-rev"]);
    for (const route of world.routes) {
      expect(field_races(route, false, def.rails)).toBe(true);
      expect(route.par_ms).toBeLessThanOrEqual(450_000);
      expect(route.checkpoints).toHaveLength(12);
      expect(route.excludes).toEqual(["bus"]);
    }
    const spawn = world.road.at(SPAWN_INDEX);
    expect(spawn && sample(world.terrain.road_dist, spawn.x, spawn.z)).toBeLessThan(ROAD_HALF);
  }
});

test("no tree stands on the run-off", () => {
  for (const world of worlds)
    for (const tree of world.trees) {
      let nearest = Infinity;
      for (let i = 0; i < world.road.length; i += 2) nearest = Math.min(nearest, Math.hypot(world.road[i].x - tree.x, world.road[i].z - tree.z));
      expect(nearest).toBeGreaterThan(RUNOFF - 6);
    }
});

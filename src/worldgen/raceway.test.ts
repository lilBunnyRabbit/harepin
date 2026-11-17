/// <reference types="bun" />
import { expect, test } from "bun:test";
import { field_races } from "../modes/field-route";
import { sweep } from "../sweep";
import { sample } from "./field";
import { generate_world, KINDS } from "./kinds/kinds";
import { BANK, RACEWAY } from "./raceway";
import { ATTEMPTS, BOUND, CLEARANCE, Corner, crowded, FALLBACK_SEED, LAP, LAP_LENGTH, NEIGHBOUR, raceway_lap } from "./raceway-plan";
import { ROAD_HALF, SPAWN_INDEX, WorldKind, type WorldData } from "./types";

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

test("the longest straight is the back straight, and it brakes into a hairpin or the chicane", () => {
  for (const { path, pit, back, brakes } of laps) {
    expect(back).toBeGreaterThan(pit);
    expect(brakes === Corner.HAIRPIN || brakes === Corner.CHICANE).toBe(true);
    const n = path.length;
    const bent = path.map((_, i) => radius(path, i, 3) < 5000);
    const from = bent.indexOf(true);
    let longest = 0;
    let run = 0;
    for (let k = 1; k <= n; k++) {
      run = bent[(from + k) % n] ? 0 : run + 1;
      longest = Math.max(longest, run);
    }
    expect(Math.abs(longest * 2 - back)).toBeLessThan(16);
  }
});

test("the pit straight is straight for the grid behind the line and well past it", () => {
  for (const { path } of laps) for (let k = -GRID; k <= GRID; k++) expect(radius(path, (k + path.length) % path.length, 3)).toBeGreaterThan(5000);
});

test("a seed makes the same lap every time, and seeds differ", () => {
  expect(raceway_lap(3)).toEqual(raceway_lap(3));
  expect(raceway_lap(3).path[40]).not.toEqual(raceway_lap(4).path[40]);
});

test("the road follows the hills inside the grade limit", () => {
  for (const world of worlds) {
    const { road } = world;
    let low = Infinity;
    let high = -Infinity;
    road.forEach((p, i) => {
      const next = road[(i + 1) % road.length];
      expect(Math.abs(next.y - p.y) / Math.hypot(next.x - p.x, next.z - p.z)).toBeLessThanOrEqual(MAX_GRADE + 1e-6);
      low = Math.min(low, p.y);
      high = Math.max(high, p.y);
    });
    expect(high - low).toBeGreaterThan(3);
  }
});

test("the ground under the road leans into each bend by its bank, and lies level on the straights", () => {
  const off = ROAD_HALF - 1;
  for (const world of worlds) {
    const { road } = world;
    const lean = world.graph.edges[0].banks ?? [];
    expect(lean).toHaveLength(road.length);
    let most = 0;
    road.forEach((p, i) => {
      const left = sample(world.terrain.heights, p.x - p.tz * off, p.z + p.tx * off);
      const right = sample(world.terrain.heights, p.x + p.tz * off, p.z - p.tx * off);
      const tilt = (left - right) / (2 * off);
      expect(Math.abs(lean[i])).toBeLessThanOrEqual(BANK + 1e-9);
      expect(Math.abs(tilt - lean[i])).toBeLessThan(0.02);
      const from = road[(i - 3 + road.length) % road.length];
      const to = road[(i + 3) % road.length];
      const turn = to.tx * from.tz - to.tz * from.tx;
      if (Math.abs(lean[i]) > BANK / 2) expect(Math.sign(lean[i])).toBe(Math.sign(turn));
      most = Math.max(most, Math.abs(tilt));
    });
    expect(most).toBeGreaterThan(BANK * 0.8);
    expect(lean[0]).toBeCloseTo(0, 9);
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

function nearest_tree(world: WorldData): number {
  return world.trees.reduce((nearest, tree) => Math.min(nearest, sample(world.terrain.road_dist, tree.x, tree.z)), Infinity);
}

test("no tree stands on the run-off", () => {
  for (const world of worlds) expect(nearest_tree(world)).toBeGreaterThan(RACEWAY.runoff - 6);
});

const OPTIONS = KINDS[WorldKind.RACEWAY].options;
const with_level = (name: string, level: number) => OPTIONS.map((o) => (o.name === name ? level : o.normal));
const custom = (seed: number, name: string, level: number) => generate_world(seed, WorldKind.RACEWAY, with_level(name, level));
const metres = (world: WorldData) => world.road.length * 2;
const climb = (world: WorldData) => Math.max(...world.road.map((p) => p.y)) - Math.min(...world.road.map((p) => p.y));
function tight(world: WorldData): number {
  const path = world.road.map((p) => [p.x, p.z] as const);
  return path.filter((_, i) => radius(path, i, 3) < 45).length;
}
const KNOB_SEEDS = sweep(5);

test("the normal levels build the plain raceway", () => {
  expect(generate_world(2, WorldKind.RACEWAY, OPTIONS.map((o) => o.normal))).toEqual({ ...worlds[2], timings: expect.anything() });
});

test("Length short and long draw another lap of the seed, inside their own window", () => {
  for (const seed of KNOB_SEEDS) {
    const short = custom(seed, "Length", 0);
    const long = custom(seed, "Length", 2);
    expect(metres(short)).toBeGreaterThanOrEqual(LAP_LENGTH[0] - 4);
    expect(metres(short)).toBeLessThanOrEqual(3404);
    expect(metres(long)).toBeGreaterThanOrEqual(3696);
    expect(metres(long)).toBeLessThanOrEqual(LAP_LENGTH[1] + 4);
    expect(short.road[40]).not.toEqual(worlds[seed].road[40]);
    expect(long.road[40]).not.toEqual(worlds[seed].road[40]);
  }
});

test("Corners flowing has less tight road than the plain lap, technical more", () => {
  const sum = (level: number) => KNOB_SEEDS.reduce((total, seed) => total + tight(custom(seed, "Corners", level)), 0);
  const mixed = KNOB_SEEDS.reduce((total, seed) => total + tight(worlds[seed]), 0);
  expect(sum(0)).toBeLessThan(mixed);
  expect(sum(2)).toBeGreaterThan(mixed);
});

test("Hills keep the lap and change how far it climbs, inside the grade limit", () => {
  for (const seed of KNOB_SEEDS) {
    const flat = custom(seed, "Hills", 0);
    const rolling = custom(seed, "Hills", 2);
    expect(flat.road.map((p) => [p.x, p.z])).toEqual(worlds[seed].road.map((p) => [p.x, p.z]));
    expect(climb(flat)).toBeLessThan(climb(worlds[seed]));
    expect(climb(rolling)).toBeGreaterThan(climb(worlds[seed]));
    rolling.road.forEach((p, i) => {
      const next = rolling.road[(i + 1) % rolling.road.length];
      expect(Math.abs(next.y - p.y) / Math.hypot(next.x - p.x, next.z - p.z)).toBeLessThanOrEqual(MAX_GRADE + 1e-6);
    });
  }
});

test("Run-off moves the trees: closer than the plain run-off when narrow, further when wide", () => {
  for (const seed of KNOB_SEEDS) {
    const narrow = nearest_tree(custom(seed, "Run-off", 0));
    expect(narrow).toBeGreaterThan(18 - 6);
    expect(narrow).toBeLessThan(RACEWAY.runoff - 6);
    expect(nearest_tree(custom(seed, "Run-off", 2))).toBeGreaterThan(54 - 6);
  }
});

test("a recipe no draw of a seed can meet falls back to that seed's plain lap, never another seed's", () => {
  const lap = raceway_lap(4, { ...LAP, length: [1, 2] });
  expect(lap.recipe).toBe(LAP);
  expect(lap).toEqual(raceway_lap(4));
});

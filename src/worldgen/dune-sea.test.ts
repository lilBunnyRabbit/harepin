/// <reference types="bun" />
import { expect, test } from "bun:test";
import { CARS } from "../car/cars";
import { sweep } from "../sweep";
import { World } from "../world/world";
import { climb_kmh, coast, grade_of, SAND } from "../../scripts/dunes";
import { CHUNK, chunk_of, extent } from "./chunk-grid";
import { DUNE_SEA_SIZE, generate_dune_sea } from "./dune-sea";
import { build_tile } from "./ground";
import { dune_wind, land_height } from "./terrain";
import { WorldKind, type WorldData } from "./types";

const EXT = extent(DUNE_SEA_SIZE);
/** Inside the dune wall the mask raises round the sea. */
const PLAY = 2200;
const REPOSE = Math.tan((35 * Math.PI) / 180);
/** A crest: rising at least this up to 6 m short of it, falling at least this 6 m past it. */
const WINDWARD = 0.08;
const SLIP = 0.3;
/** Crests per drop to the ground past them: hops under 15 m, mid dunes, big ones over 40 m. */
const SIZES = [15, 40, Infinity];
const PER_SIZE = 3;
/** The S1 crest speeds, m/s, plus each car's own top speed up a 12 degree loose windward face: what it brings to a crest. */
const SPEEDS = [15, 20, 25];
const WINDWARD_CLIMB = grade_of(12);
/** Crest jumps flat out, km/h, launched along the windward grade under the brink. */
const JUMP_KMH = [60, 80, 95, 110];
const GRAVITY = 9.81;
/** Past the touchdown the car needs this many metres to land in, none of it climbing steeper than a big dune's windward. */
const RUNOUT = 20;
const LANDING_RISE = 0.2;
/** Crests are noise-bent and fields overlap, so a few land short; this share of every size must land clear. */
const CLEAR = 0.95;

function shape_of(data: WorldData) {
  if (data.ground.base.kind !== "terrain") throw new Error("the dune sea is a terrain kind");
  return data.ground.base.shape;
}

function wind_of(seed: number, data: WorldData) {
  const dunes = shape_of(data).find((l) => l.kind === "dunes");
  if (dunes?.kind !== "dunes") throw new Error("the dune sea has a dune layer");
  return dune_wind(seed, dunes.seed);
}

test("the dune sea streams past the mainland's size, keyed bd16", async () => {
  const { KINDS, world_key } = await import("./kinds/kinds");
  expect(KINDS[WorldKind.BIG_DUNES].size).toBe(DUNE_SEA_SIZE);
  expect(EXT.side).toBeGreaterThan(extent(6144).side);
  expect(world_key(42, WorldKind.BIG_DUNES)).toBe("42:bd16");
});

for (const seed of sweep(10))
  test(`dune sea ${seed}: no roads, a flat spawn facing downwind, nothing in the play area past repose, dunes from hops to 60 m+`, () => {
    const data = generate_dune_sea(seed);
    expect(data.road.length).toBe(1);
    expect(data.graph.edges).toEqual([]);
    expect(data.routes.map((r) => r.id)).toEqual(["crossing"]);
    expect(data.checkpoints).toEqual([]);
    expect(data.ground.ops).toEqual([]);
    const height = land_height(seed, shape_of(data));
    const wind = wind_of(seed, data);
    const spawn = data.road[0];
    expect(Math.hypot(spawn.x, spawn.z)).toBeLessThan(PLAY / 2);
    expect([spawn.tx, spawn.tz]).toEqual([wind.x, wind.z]);
    expect(Math.abs(height(spawn.x + 8, spawn.z) - height(spawn.x - 8, spawn.z))).toBeLessThan(1.3);
    expect(Math.abs(height(spawn.x, spawn.z + 8) - height(spawn.x, spawn.z - 8))).toBeLessThan(1.3);
    let steepest = 0;
    let low = Infinity;
    let top = -Infinity;
    for (let z = -PLAY; z <= PLAY; z += 12)
      for (let x = -PLAY; x <= PLAY; x += 12) {
        if (x * x + z * z > PLAY * PLAY) continue;
        steepest = Math.max(steepest, Math.hypot(height(x + 2, z) - height(x - 2, z), height(x, z + 2) - height(x, z - 2)) / 4);
        low = Math.min(low, height(x, z));
        top = Math.max(top, height(x, z));
      }
    expect(steepest).toBeLessThan(REPOSE);
    expect(top - low).toBeGreaterThan(60);
  });

/** The crossing never climbs anything steeper than a windward with a hop on it: no slip face, 6 m at a time. */
const CROSSING_CLIMB = 0.35;
const CROSSING_GATES = 460;

for (const seed of sweep(10))
  test(`dune sea ${seed}: the crossing runs one way downwind inside the play area, up no slip face, a gate on crests at most ${CROSSING_GATES} m apart, the finish on a crest`, () => {
    const data = generate_dune_sea(seed);
    const [route] = data.routes;
    const wind = wind_of(seed, data);
    const { points, checkpoints } = route;
    expect(route.closed).toBe(false);
    expect(route.length).toBeGreaterThan(2500);
    expect(route.length).toBeLessThan(3800);
    expect(route.par_ms).toBeGreaterThan(0);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      expect(Math.hypot(p.x, p.z)).toBeLessThan(PLAY);
      expect([p.tx, p.tz]).toEqual([wind.x, wind.z]);
      if (i >= 3) expect((p.y - points[i - 3].y) / Math.hypot(p.x - points[i - 3].x, p.z - points[i - 3].z)).toBeLessThan(CROSSING_CLIMB);
    }
    const finish = points[points.length - 1];
    expect(checkpoints[checkpoints.length - 1]).toMatchObject({ x: finish.x, z: finish.z });
    const height = land_height(seed, shape_of(data));
    expect(height(finish.x - wind.x * 6, finish.z - wind.z * 6)).toBeLessThan(finish.y);
    expect(height(finish.x + wind.x * 12, finish.z + wind.z * 12)).toBeLessThan(finish.y - 0.3 * 6);
    let from: { x: number; z: number } = points[0];
    for (const gate of checkpoints) {
      expect(Math.hypot(gate.x - from.x, gate.z - from.z)).toBeLessThan(CROSSING_GATES);
      from = gate;
    }
  });

test("a free-driving reset rights the car where it stands, kilometres from the spawn", () => {
  const data = generate_dune_sea(0);
  const world = new World(0, data, []);
  const [x, z] = [1500, -900];
  const index = chunk_of(x, z, EXT);
  world.tiles.add(index, build_tile(data.ground, index, EXT));
  expect(world.spawn_near(x, z, 0, -1)).toEqual({ x, y: world.height(x, z), z, heading: Math.PI });
});

function crests(seed: number, data: WorldData): { x: number; z: number; drop: number }[] {
  const height = land_height(seed, shape_of(data));
  const { x: wx, z: wz } = wind_of(seed, data);
  const out: { x: number; z: number; drop: number }[] = [];
  const size = (drop: number) => SIZES.findIndex((top) => drop < top);
  const full = (at: number) => out.filter((c) => size(c.drop) === at).length >= PER_SIZE;
  for (let k = 0; out.length < SIZES.length * PER_SIZE && k < 4000; k++) {
    const x0 = ((k * 7919) % (PLAY * 1.6)) - PLAY * 0.8;
    const z0 = ((k * 104729) % (PLAY * 1.6)) - PLAY * 0.8;
    const grade = (x: number, z: number, d: number) => (height(x + wx * (d + 1), z + wz * (d + 1)) - height(x + wx * (d - 1), z + wz * (d - 1))) / 2;
    for (let s = 0; s < 400; s++) {
      const x = x0 + wx * s;
      const z = z0 + wz * s;
      if (grade(x, z, -6) <= WINDWARD || grade(x, z, 6) >= -SLIP) continue;
      let floor = Infinity;
      for (let a = 0; a < 300; a += 4) floor = Math.min(floor, height(x + wx * a, z + wz * a));
      const drop = height(x, z) - floor;
      if (!full(size(drop))) out.push({ x, z, drop });
      break;
    }
  }
  return out;
}

/** Metres past the crest where a point launched at `v` m/s along `lift` touches the ground ahead. */
function touchdown(ahead: (d: number) => number, lift: number, v: number): number {
  const vx = v / Math.hypot(1, lift);
  const y0 = ahead(0);
  for (let d = 0.5; d < 500; d += 0.5) {
    const t = d / vx;
    if (y0 + vx * lift * t - (GRAVITY * t * t) / 2 <= ahead(d)) return d;
  }
  return Infinity;
}

for (const seed of sweep(4))
  test(`dune sea ${seed}: off ${CLEAR * 100}% of crests of every size at ${JUMP_KMH[0]}-${JUMP_KMH[JUMP_KMH.length - 1]} km/h the car lands with ${RUNOUT} m clear of the next dune face`, () => {
    const data = generate_dune_sea(seed);
    const height = land_height(seed, shape_of(data));
    const { x: wx, z: wz } = wind_of(seed, data);
    const along = (x: number, z: number) => (d: number) => height(x + wx * d, z + wz * d);
    const crests = SIZES.map(() => 0);
    const short = SIZES.map(() => 0);
    const examples: string[] = [];
    for (let line = 0; line < 30; line++) {
      const x0 = ((line * 7919) % (PLAY * 1.4)) - PLAY * 0.7;
      const z0 = ((line * 104729) % (PLAY * 1.4)) - PLAY * 0.7;
      for (let s = -PLAY / 2; s < PLAY / 2; s++) {
        const ahead = along(x0 + wx * s, z0 + wz * s);
        if ((ahead(-5) - ahead(-7)) / 2 <= WINDWARD || (ahead(7) - ahead(5)) / 2 >= -SLIP) continue;
        let top = 0;
        for (let d = -6; d <= 6; d++) if (ahead(d) > ahead(top)) top = d;
        const crest = along(x0 + wx * (s + top), z0 + wz * (s + top));
        let floor = Infinity;
        for (let a = 0; a < 300; a += 4) floor = Math.min(floor, crest(a));
        const size = SIZES.findIndex((cap) => crest(0) - floor < cap);
        const lift = Math.max(0, (crest(-3) - crest(-11)) / 8);
        crests[size]++;
        for (const kmh of JUMP_KMH) {
          const d = touchdown(crest, lift, kmh / 3.6);
          let rise = d === Infinity ? Infinity : 0;
          for (let e = d; rise !== Infinity && e <= d + RUNOUT; e++) rise = Math.max(rise, (crest(e + 1) - crest(e - 1)) / 2);
          if (rise <= LANDING_RISE) continue;
          short[size]++;
          examples.push(`${kmh} km/h off ${(x0 + wx * (s + top)).toFixed(0)},${(z0 + wz * (s + top)).toFixed(0)} lands ${d} m out on ${rise.toFixed(2)}`);
          break;
        }
        s += 20;
      }
    }
    for (let size = 0; size < SIZES.length; size++) {
      expect(crests[size]).toBeGreaterThan(5);
      if (short[size] > (1 - CLEAR) * crests[size]) throw new Error(`size ${size}: ${short[size]} of ${crests[size]} crests land short, e.g. ${examples.slice(0, 3).join("; ")}`);
    }
  });

for (const seed of sweep(2))
  test(`dune sea ${seed}: every car coasting off a natural crest at 15-25 m/s, or at its own speed up a windward face, lands upright and never rolls`, () => {
    const data = generate_dune_sea(seed);
    const world = new World(seed, data, []);
    const { x: wx, z: wz } = wind_of(seed, data);
    const found = crests(seed, data);
    expect(found.length).toBe(SIZES.length * PER_SIZE);
    for (const c of found)
      for (let dz = -2; dz <= 2; dz++)
        for (let dx = -2; dx <= 2; dx++) {
          const index = chunk_of(c.x + dx * CHUNK, c.z + dz * CHUNK, EXT);
          if (!world.tiles.get(index)) world.tiles.add(index, build_tile(data.ground, index, EXT));
        }
    const failed: string[] = [];
    for (const spec of Object.values(CARS)) {
      const own = climb_kmh(spec, WINDWARD_CLIMB, SAND) / 3.6;
      for (const v of own > SPEEDS[SPEEDS.length - 1] ? [...SPEEDS, own] : SPEEDS)
        for (const c of found) {
          const run = coast(spec, world, c.x, c.z, Math.atan2(wx, wz), v);
          if (run.rolled || !run.upright) failed.push(`${spec.id} ${v.toFixed(0)} m/s off ${c.x.toFixed(0)},${c.z.toFixed(0)} (${c.drop.toFixed(0)} m): ${run.air.toFixed(1)} s air, ${run.tilt.toFixed(0)} deg${run.rolled ? ", rolled" : ""}`);
        }
    }
    expect(failed).toEqual([]);
  }, 120_000);

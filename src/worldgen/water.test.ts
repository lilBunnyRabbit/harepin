/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DEEP_WATER, World } from "../world/world";
import { chunk_of, chunk_vertex, extent } from "./chunk-grid";
import { build_tile } from "./ground";
import { MAINLAND_SIZE, plan_mainland } from "./mainland";
import { MAINLAND } from "./recipe";
import { TILE_SIDE } from "./tiles";
import { CELL, ORIGIN } from "./types";
import { SEA_LEVEL, water_index, type Water } from "./water";

const EXT = extent(MAINLAND_SIZE);
const SEEDS = [0, 1, 2, 3, 4];
const DEEPEST = (MAINLAND.water?.rivers.depth[1] ?? 0) + 0.01;
/** Most a river's banks may steepen the rise between two vertices a cell apart: a bank eases, never stands as a wall. */
const BANK_STEP = 1.5;

function planned(seed: number) {
  const { data } = plan_mainland(seed);
  const op = data.ground.ops.find((o) => o.kind === "water");
  if (op?.kind !== "water") throw new Error("mainland plans no water");
  return { data, water: op.water };
}

function in_lake(water: Water, x: number, z: number): boolean {
  const m = water.n + 1;
  const i = Math.round((x - water.origin) / water.cell);
  const j = Math.round((z - water.origin) / water.cell);
  return water.lake_of[j * m + i] >= 0;
}

test("river surfaces never step uphill downstream", () => {
  for (const seed of SEEDS)
    for (const river of planned(seed).water.rivers) for (let i = 1; i < river.length; i++) expect(river[i].level).toBeLessThanOrEqual(river[i - 1].level);
});

test("a river never stands deeper than its channel over the ground under it", () => {
  for (const seed of SEEDS) {
    const { data, water } = planned(seed);
    const world = new World(seed, data, []);
    for (const river of water.rivers)
      for (let i = 0; i < river.length; i += 2) {
        const p = river[i];
        const q = river[i + 1] ?? river[i - 1];
        const len = Math.hypot(q.x - p.x, q.z - p.z);
        for (const w of [-0.5, 0, 0.5]) {
          // On the lattice: between vertices the ground is their interpolation, which a steep reach's fall can dip under.
          const x = ORIGIN + Math.round((p.x + ((q.z - p.z) / len) * p.half * w - ORIGIN) / CELL) * CELL;
          const z = ORIGIN + Math.round((p.z - ((q.x - p.x) / len) * p.half * w - ORIGIN) / CELL) * CELL;
          const index = chunk_of(x, z, EXT);
          if (!world.tiles.get(index)) world.tiles.add(index, build_tile(data.ground, index, EXT));
          if (world.tiles.height(x, z) < 0 || in_lake(water, x, z)) continue;
          const depth = world.depth(x, z);
          if (depth > DEEPEST) throw new Error(`seed ${seed}: ${depth.toFixed(2)} m of river at ${x.toFixed(0)},${z.toFixed(0)}`);
        }
      }
    expect(DEEPEST).toBeGreaterThan(DEEP_WATER);
  }
});

test("a river mouth lays no water on the sea plane", async () => {
  const { MESH_TONES } = await import("../../scripts/proof/tones");
  const { TileMesher } = await import("./tile-mesher");
  for (const seed of SEEDS) {
    const { data, water } = planned(seed);
    const mesher = new TileMesher(data, EXT, MESH_TONES);
    const mouths = new Set(water.rivers.map((river) => chunk_of(river[river.length - 1].x, river[river.length - 1].z, EXT)));
    for (const chunk of mouths) {
      const positions = mesher.build(chunk).chunk.water?.positions ?? new Float32Array();
      for (let t = 0; t < positions.length; t += 9) {
        const top = Math.max(positions[t + 1], positions[t + 4], positions[t + 7]);
        if (top <= SEA_LEVEL) throw new Error(`seed ${seed}: water triangle at sea level by ${positions[t].toFixed(0)},${positions[t + 2].toFixed(0)}`);
      }
    }
  }
});

test("river banks ease into the land without a step", () => {
  for (const seed of SEEDS) {
    const { data, water } = planned(seed);
    const index = water_index(water);
    const chunks = new Set(water.rivers.flatMap((r) => r.filter((_, i) => i % 8 === 0).map((p) => chunk_of(p.x, p.z, EXT))));
    let worst = 0;
    for (const chunk of chunks) {
      const bare = build_tile({ base: data.ground.base, ops: [] }, chunk, EXT).heights;
      const cut = build_tile({ base: data.ground.base, ops: [{ kind: "water", water }] }, chunk, EXT).heights;
      const [i0, j0] = chunk_vertex(chunk, EXT);
      const dry = (i: number, j: number) => index.level(ORIGIN + (i0 + i) * CELL, ORIGIN + (j0 + j) * CELL) === -Infinity;
      for (let j = 0; j < TILE_SIDE; j++)
        for (let i = 0; i < TILE_SIDE; i++) {
          const k = j * TILE_SIDE + i;
          if (!dry(i, j)) continue;
          for (const [a, b] of [[i + 1, j], [i, j + 1]]) {
            if (a >= TILE_SIDE || b >= TILE_SIDE || !dry(a, b)) continue;
            const n = b * TILE_SIDE + a;
            const step = Math.abs(cut[n] - cut[k]) - Math.abs(bare[n] - bare[k]);
            worst = Math.max(worst, step);
          }
        }
    }
    if (worst > BANK_STEP) throw new Error(`seed ${seed}: banks add a ${worst.toFixed(2)} m step`);
  }
});

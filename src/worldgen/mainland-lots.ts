import { at, type Grid } from "./field";
import { empty_lots, Lots, type TownLots } from "./lots";
import { length } from "./noise";
import type { Recipe } from "./recipe";
import { road_junctions } from "./road-layers";
import { Stamp, type GroundOp } from "./stamp";
import { terrain } from "./terrain";
import { CELL, ORIGIN, SIDEWALK, type RoadGraph, type RoadPoint, type Town } from "./types";
import { water_index, type Water } from "./water";

const WINDOW_PAD = 48;
const PATCH_CLEAR = SIDEWALK + 1;
const WET_MARGIN = 0.5;

interface Outline {
  points: readonly { x: number; z: number }[];
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

function window_of(town: Town): Grid {
  const reach = town.radius + WINDOW_PAD;
  const i0 = Math.floor((town.x - reach - ORIGIN) / CELL);
  const j0 = Math.floor((town.z - reach - ORIGIN) / CELL);
  const i1 = Math.ceil((town.x + reach - ORIGIN) / CELL);
  const j1 = Math.ceil((town.z + reach - ORIGIN) / CELL);
  return { i0, j0, i1, j1, row: i1 - i0 + 1 };
}

function inside(points: Outline["points"], x: number, z: number): boolean {
  let hit = false;
  for (let a = 0, b = points.length - 1; a < points.length; b = a++) {
    const p = points[a];
    const q = points[b];
    if (p.z > z !== q.z > z && x < ((q.x - p.x) * (z - p.z)) / (q.z - p.z) + p.x) hit = !hit;
  }
  return hit;
}

function rim_dist(points: Outline["points"], x: number, z: number): number {
  let best = Infinity;
  for (let a = 0, b = points.length - 1; a < points.length; b = a++) {
    const p = points[a];
    const q = points[b];
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (z - p.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, length(p.x + dx * t - x, p.z + dz * t - z));
  }
  return best;
}

// The mainland stamps no junction patches into road_dist and levels its towns over river channels, so both are
// marked taken before any lot looks for room.
function block(occupied: Uint8Array, grid: Grid, heights: Float32Array, outlines: readonly Outline[], wet: ((x: number, z: number) => number) | null) {
  for (let j = grid.j0; j <= grid.j1; j++)
    for (let i = grid.i0; i <= grid.i1; i++) {
      const x = ORIGIN + i * CELL;
      const z = ORIGIN + j * CELL;
      const k = at(grid, i, j);
      if (wet && wet(x, z) > heights[k] - WET_MARGIN) occupied[k] = 1;
      for (const o of outlines) {
        if (x < o.x0 || x > o.x1 || z < o.z0 || z > o.z1) continue;
        if (inside(o.points, x, z) || rim_dist(o.points, x, z) < PATCH_CLEAR) occupied[k] = 1;
      }
    }
}

/**
 * Every town's lots, each planned over a window of the ground rebuilt from the plan's ops: the same heights and road
 * distances its tiles get, so a lot never depends on which chunks happen to be built.
 */
export function mainland_lots(seed: number, recipe: Recipe, graph: RoadGraph, towns: readonly Town[], circuit: number[], road: RoadPoint[], ops: readonly GroundOp[], water: Water | null): TownLots {
  const out = empty_lots();
  const outlines: Outline[] = road_junctions({ road, graph, circuit }).patched.map(({ patch }) => {
    const xs = patch.outline.map((p) => p.x);
    const zs = patch.outline.map((p) => p.z);
    return { points: patch.outline, x0: Math.min(...xs) - PATCH_CLEAR, z0: Math.min(...zs) - PATCH_CLEAR, x1: Math.max(...xs) + PATCH_CLEAR, z1: Math.max(...zs) + PATCH_CLEAR };
  });
  const level = water && water_index(water);
  const wet = level && ((x: number, z: number) => level.level(x, z));
  for (const town of towns) {
    const streets = graph.edges.filter((edge) => edge.kind === "street" && towns.find((t) => length(t.x - edge.points[0].x, t.z - edge.points[0].z) <= t.radius + 1) === town);
    if (!streets.length) continue;
    const grid = window_of(town);
    const land = terrain(seed, recipe.terrain, grid);
    const stamp = new Stamp(land, grid, false);
    for (const op of ops) stamp.replay(op);
    const lots = new Lots(seed, land, stamp, recipe.towns, grid, out, true);
    const near = outlines.filter((o) => o.x1 >= ORIGIN + grid.i0 * CELL && o.x0 <= ORIGIN + grid.i1 * CELL && o.z1 >= ORIGIN + grid.j0 * CELL && o.z0 <= ORIGIN + grid.j1 * CELL);
    block(lots.occupied, grid, land.heights, near, wet);
    for (const edge of streets) lots.street(edge, town);
  }
  return out;
}

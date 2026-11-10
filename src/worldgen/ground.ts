import { CHUNKS } from "./chunk-grid";
import type { Grid } from "./field";
import { Stamp, type GroundPlan } from "./stamp";
import { terrain } from "./terrain";
import { TILE_SIDE, type Tile } from "./tiles";
import type { Terrain } from "./types";

const TILE_CELLS = TILE_SIDE - 1;

export function tile_grid(index: number): Grid {
  const i0 = (index % CHUNKS) * TILE_CELLS;
  const j0 = Math.floor(index / CHUNKS) * TILE_CELLS;
  return { i0, j0, i1: i0 + TILE_CELLS, j1: j0 + TILE_CELLS, row: TILE_SIDE };
}

function base(plan: GroundPlan, grid: Grid): Terrain {
  if (plan.base.kind === "terrain") return terrain(plan.base.seed, plan.base.shape, grid);
  const heights = new Float32Array(TILE_SIDE * TILE_SIDE).fill(plan.base.height);
  return { seed: 0, size: 0, cell: 0, n: 0, heights, road_dist: new Float32Array(heights.length).fill(plan.base.road_dist), surface: new Uint8Array(heights.length) };
}

export function build_tile(plan: GroundPlan, index: number): Tile {
  const grid = tile_grid(index);
  const land = base(plan, grid);
  const stamp = new Stamp(land, grid, false);
  for (const op of plan.ops) stamp.replay(op);
  return { heights: land.heights, road_dist: land.road_dist, surface: land.surface };
}

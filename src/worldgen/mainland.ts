import { extent } from "./chunk-grid";
import { plan_grid, type PlanGrid } from "./plan-grid";
import { MAINLAND, type Recipe } from "./recipe";
import { land_height } from "./terrain";
import { CELL, WorldKind, type WorldData } from "./types";

export const MAINLAND_SIZE = 6144;
/** Plan grid spacing: towns, routing and the world map read land this coarse; tiles rebuild it on the 4 m lattice. */
export const PLAN_CELL = 32;

export interface MainlandPlan {
  grid: PlanGrid;
  data: WorldData;
}

// The plan never holds fine grids: every tile is the terrain base plus the ground ops, rebuilt per chunk.
export function plan_mainland(seed: number, recipe: Recipe = MAINLAND): MainlandPlan {
  const timings: [string, number][] = [];
  let clock = performance.now();
  const lap = (stage: string) => {
    const now = performance.now();
    timings.push([stage, now - clock]);
    clock = now;
  };
  const ext = extent(MAINLAND_SIZE);
  const grid = plan_grid(ext, PLAN_CELL, land_height(seed, recipe.terrain));
  lap("plan grid");
  const empty = new Float32Array(0);
  const data: WorldData = {
    kind: WorldKind.MAINLAND,
    deck: null,
    terrain: { seed, size: ext.size, cell: CELL, n: ext.n, heights: empty, road_dist: new Float32Array(0), surface: new Uint8Array(0) },
    ground: { base: { kind: "terrain", seed, shape: recipe.terrain }, ops: [] },
    graph: { nodes: [], edges: [] },
    towns: [],
    lots: [],
    buildings: [],
    props: [],
    parking: [],
    trees: [],
    solids: [],
    ramps: [],
    items: [],
    challenges: [],
    checkpoints: [],
    circuit: [],
    road: [],
    routes: [],
    canyon: null,
    timings,
  };
  return { grid, data };
}

export function generate_mainland(seed: number): WorldData {
  return plan_mainland(seed).data;
}

import { extent } from "./chunk-grid";
import { mainland_network } from "./mainland-network";
import { plan_grid, type PlanGrid } from "./plan-grid";
import { MAINLAND, type Recipe } from "./recipe";
import { circuit_route, heading } from "./routes";
import type { GroundOp } from "./stamp";
import { land_height } from "./terrain";
import { CELL, WorldKind, type Checkpoint, type WorldData } from "./types";

const CHECKPOINTS = 16;

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
  const { graph, towns, circuit, road } = mainland_network(seed, grid, recipe.towns);
  lap("network");
  // Stamp order as the island's: plateaus, then the circuit, then every other edge by id, then one blend.
  const on_circuit = new Set(circuit);
  const ops: GroundOp[] = [
    ...towns.map((town): GroundOp => ({ kind: "plateau", town })),
    ...circuit.map((id): GroundOp => ({ kind: "edge", edge: graph.edges[id] })),
    ...graph.edges.filter((e) => !on_circuit.has(e.id)).map((edge): GroundOp => ({ kind: "edge", edge })),
    { kind: "blend" },
  ];
  const checkpoints: Checkpoint[] = road.length ? Array.from({ length: CHECKPOINTS }, (_, index) => {
    const p = road[Math.floor((index / CHECKPOINTS) * road.length)];
    return { x: p.x, y: p.y, z: p.z, heading: heading(p), index };
  }) : [];
  const routes = road.length ? [circuit_route(road, checkpoints)] : [];
  lap("routes");
  const empty = new Float32Array(0);
  const data: WorldData = {
    kind: WorldKind.MAINLAND,
    deck: null,
    terrain: { seed, size: ext.size, cell: CELL, n: ext.n, heights: empty, road_dist: new Float32Array(0), surface: new Uint8Array(0) },
    ground: { base: { kind: "terrain", seed, shape: recipe.terrain }, ops },
    graph,
    towns,
    lots: [],
    buildings: [],
    props: [],
    parking: [],
    trees: [],
    solids: [],
    ramps: [],
    items: [],
    challenges: [],
    checkpoints,
    circuit,
    road,
    routes,
    canyon: null,
    timings,
  };
  return { grid, data };
}

export function generate_mainland(seed: number): WorldData {
  return plan_mainland(seed).data;
}

import { extent } from "./chunk-grid";
import { BIG_DUNES } from "./recipe";
import { dune_wind, land_height } from "./terrain";
import { CELL, WorldKind, type RoadPoint, type WorldData } from "./types";

export const DUNE_SEA_SIZE = 8192;
/** The spawn search walks rings this far apart out from the middle, to this far, for ground this flat. */
const SPAWN_STEP = 16;
const SPAWN_REACH = 1200;
const SPAWN_FLAT = 0.04;
const SPAWN_PAD = 8;

type Height = (x: number, z: number) => number;

function flat(height: Height, x: number, z: number): boolean {
  const h = height(x, z);
  for (const [dx, dz] of [[SPAWN_PAD, 0], [-SPAWN_PAD, 0], [0, SPAWN_PAD], [0, -SPAWN_PAD]]) if (Math.abs(height(x + dx, z + dz) - h) > SPAWN_FLAT * SPAWN_PAD) return false;
  return true;
}

function spawn_spot(height: Height): [number, number] {
  for (let r = 0; r <= SPAWN_REACH; r += SPAWN_STEP)
    for (let k = -r; k <= r; k += SPAWN_STEP)
      for (const [x, z] of [[k, -r], [k, r], [-r, k], [r, k]]) if (flat(height, x, z)) return [x, z];
  return [0, 0];
}

/**
 * The car starts on the flattest ground near the middle, facing downwind: up the next windward slope to a crest. The
 * "road" is that one spawn point: a single point draws no road, kerb or post, and there are no edges, routes or gates.
 */
export function generate_dune_sea(seed: number): WorldData {
  const recipe = BIG_DUNES;
  const t0 = performance.now();
  const height = land_height(seed, recipe.terrain);
  const dunes = recipe.terrain.find((layer) => layer.kind === "dunes");
  const wind = dunes?.kind === "dunes" ? dune_wind(seed, dunes.seed) : { x: 0, z: 1 };
  const [x, z] = spawn_spot(height);
  const road: RoadPoint[] = [{ x, y: height(x, z), z, tx: wind.x, tz: wind.z }];
  const ext = extent(DUNE_SEA_SIZE);
  const empty = new Float32Array(0);
  return {
    kind: WorldKind.BIG_DUNES,
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
    road,
    routes: [],
    canyon: null,
    timings: [["plan", performance.now() - t0]],
  };
}

import { biome_cuts, plant } from "./biomes";
import { cell_range, vertex } from "./field";
import { loop_heights, road_points } from "./path";
import { raceway_lap } from "./raceway-plan";
import { ISLAND, type TerrainRecipe } from "./recipe";
import { circuit_route, loop_gates, reverse_circuit } from "./routes";
import { Stamp } from "./stamp";
import { terrain } from "./terrain";
import { CELL, N, ORIGIN, ROAD_HALF, WorldKind, type RoadEdge, type RoadPoint, type WorldData } from "./types";

const CHECKPOINTS = 12;
// scripts/races.ts: the bus runs wide of the hairpins and chicanes on most seeds, and laps a fifth over par.
const EXCLUDES = ["bus"];
export const RUNOFF = 34;
// The lift keeps every hill above the island biomes' coast: meshing paints a kind with no recipe from those.
export const RACEWAY_TERRAIN: TerrainRecipe = [
  { kind: "lift", height: 16 },
  { kind: "fbm", scale: 700, seed: 7, octaves: 3, power: 1, amp: 50 },
];

function runoff(road: readonly RoadPoint[]): (x: number, z: number) => boolean {
  const grass = new Uint8Array((N + 1) * (N + 1));
  for (const p of road) {
    const [i0, i1] = cell_range(p.x - RUNOFF, p.x + RUNOFF);
    const [j0, j1] = cell_range(p.z - RUNOFF, p.z + RUNOFF);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = ORIGIN + i * CELL - p.x;
        const dz = ORIGIN + j * CELL - p.z;
        if (dx * dx + dz * dz <= RUNOFF * RUNOFF) grass[vertex(i, j)] = 1;
      }
  }
  return (x, z) => grass[vertex(Math.round((x - ORIGIN) / CELL), Math.round((z - ORIGIN) / CELL))] === 1;
}

export function generate_raceway(seed: number): WorldData {
  const t0 = performance.now();
  const lap = raceway_lap(seed);
  const land = terrain(seed, RACEWAY_TERRAIN);
  const road = road_points(lap.path, loop_heights({ path: lap.path, stack: null }, land.heights), true);
  const ring: RoadEdge = { id: 0, a: 0, b: 0, kind: "highway", half: ROAD_HALF, closed: true, points: road };
  const stamp = new Stamp(land);
  stamp.edge(ring);
  stamp.blend();
  const at = Array.from({ length: CHECKPOINTS }, (_, i) => Math.floor((i / CHECKPOINTS) * road.length));
  const { checkpoints, posts } = loop_gates(road, at, land.heights);
  const on_runoff = runoff(road);
  const planted = plant(biome_cuts(seed, land.heights, ISLAND.biomes), land, (x, z) => !on_runoff(x, z));
  const loop = { ...circuit_route(road, checkpoints), excludes: EXCLUDES };
  const reverse = reverse_circuit(loop, []);
  return {
    kind: WorldKind.RACEWAY,
    deck: null,
    terrain: land,
    ground: { base: { kind: "terrain", seed, shape: RACEWAY_TERRAIN }, ops: stamp.ops },
    graph: { nodes: [{ id: 0, x: road[0].x, z: road[0].z, y: road[0].y, kind: "junction" }], edges: [ring] },
    towns: [],
    lots: [],
    buildings: [],
    props: [],
    parking: [],
    trees: planted.trees,
    solids: [...posts, ...planted.solids],
    ramps: [],
    items: [],
    challenges: [],
    checkpoints,
    circuit: [0],
    road,
    routes: reverse ? [loop, reverse] : [loop],
    canyon: null,
    timings: [[WorldKind.RACEWAY, performance.now() - t0]],
  };
}

import { biome_cuts, plant } from "./biomes";
import { cell_range, vertex } from "./field";
import { length } from "./noise";
import { loop_heights, road_points, smooth, type Path } from "./path";
import { layout_of, type Stand } from "./raceway-layout";
import { LAP, raceway_lap, type LapRecipe } from "./raceway-plan";
import { gravel_lines, lane_lines, venue_discs, venue_solids, type Disc } from "./raceway-venue";
import { ISLAND, type TerrainRecipe } from "./recipe";
import { circuit_route, loop_gates, reverse_circuit } from "./routes";
import { Stamp } from "./stamp";
import { terrain } from "./terrain";
import { CELL, N, ORIGIN, ROAD_HALF, SurfaceId, WorldKind, type RoadEdge, type RoadPoint, type WorldData } from "./types";

const CHECKPOINTS = 12;
// scripts/races.ts: the bus runs wide of the hairpins and chicanes on most seeds, and laps a fifth over par.
const EXCLUDES = ["bus"];
/** Rise per metre across the road in a bend: a slight lean, under the 6% kinds/road-tilt.test.ts holds every road to. */
export const BANK = 0.04;
const BANK_RADIUS = 80;
const BANK_SPAN = 5;

export interface RacewayRecipe {
  lap: LapRecipe;
  terrain: TerrainRecipe;
  /** Metres of grass kept clear of trees each side of the road's centre. */
  runoff: number;
  stand: Stand;
}

/** The lift keeps every hill above the island biomes' coast: meshing paints a kind with no recipe from those. */
export const hills = (amp: number): TerrainRecipe => [
  { kind: "lift", height: 16 },
  { kind: "fbm", scale: 700, seed: 7, octaves: 3, power: 1, amp },
];

export const RACEWAY: RacewayRecipe = { lap: LAP, terrain: hills(50), runoff: 34, stand: { modules: 6, tiers: 6 } };

function cleared(discs: readonly Disc[]): (x: number, z: number) => boolean {
  const grass = new Uint8Array((N + 1) * (N + 1));
  for (const [x, z, reach] of discs) {
    const [i0, i1] = cell_range(x - reach, x + reach);
    const [j0, j1] = cell_range(z - reach, z + reach);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = ORIGIN + i * CELL - x;
        const dz = ORIGIN + j * CELL - z;
        if (dx * dx + dz * dz <= reach * reach) grass[vertex(i, j)] = 1;
      }
  }
  return (x, z) => grass[vertex(Math.round((x - ORIGIN) / CELL), Math.round((z - ORIGIN) / CELL))] === 1;
}

/** Each bend leans into its inside: the full bank at BANK_RADIUS and tighter, less on a wider bend, none on a straight. */
export function banks(path: Path): number[] {
  const n = path.length;
  const lean = path.map(([bx, bz], i) => {
    const [ax, az] = path[(i - BANK_SPAN + n) % n];
    const [cx, cz] = path[(i + BANK_SPAN) % n];
    const cross = (bx - ax) * (cz - bz) - (bz - az) * (cx - bx);
    const curve = (2 * cross) / (length(bx - ax, bz - az) * length(cx - bx, cz - bz) * length(cx - ax, cz - az));
    return -BANK * Math.max(-1, Math.min(1, curve * BANK_RADIUS));
  });
  return smooth(lean, BANK_SPAN, 2, true);
}

export function generate_raceway(seed: number, recipe: RacewayRecipe = RACEWAY): WorldData {
  const t0 = performance.now();
  const lap = raceway_lap(seed, recipe.lap);
  const land = terrain(seed, recipe.terrain);
  const road = road_points(lap.path, loop_heights({ path: lap.path, stack: null }, land.heights), true);
  const ring: RoadEdge = { id: 0, a: 0, b: 0, kind: "highway", half: ROAD_HALF, closed: true, points: road, banks: banks(lap.path) };
  const stamp = new Stamp(land);
  stamp.edge(ring);
  stamp.blend();
  const at = Array.from({ length: CHECKPOINTS }, (_, i) => Math.floor((i / CHECKPOINTS) * road.length));
  const { checkpoints, posts } = loop_gates(road, at, land.heights);
  const layout = layout_of(road, recipe.stand);
  stamp.paint(gravel_lines(road, layout), 0, SurfaceId.GRAVEL);
  stamp.paint(lane_lines(road, layout), 0, SurfaceId.HARDPACK);
  const clear = cleared([...road.map((p): Disc => [p.x, p.z, recipe.runoff]), ...venue_discs(road, layout)]);
  const planted = plant(biome_cuts(seed, land.heights, ISLAND.biomes), land, (x, z) => !clear(x, z));
  const loop = { ...circuit_route(road, checkpoints), excludes: EXCLUDES };
  const reverse = reverse_circuit(loop, []);
  return {
    kind: WorldKind.RACEWAY,
    deck: null,
    terrain: land,
    ground: { base: { kind: "terrain", seed, shape: recipe.terrain }, ops: stamp.ops },
    graph: { nodes: [{ id: 0, x: road[0].x, z: road[0].z, y: road[0].y, kind: "junction" }], edges: [ring] },
    towns: [],
    lots: [],
    buildings: [],
    props: [],
    parking: [],
    trees: planted.trees,
    solids: [...posts, ...venue_solids(road, layout, land.heights), ...planted.solids],
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

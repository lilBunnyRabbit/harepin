import { sample } from "./field";
import { fbm, smoothstep } from "./noise";
import { mulberry32, sub } from "../rng";
import { SurfaceId, type RoadGraph, type Terrain, type Town } from "./types";

/** Frozen lakes in the lowest open ground: up to `count`, each `radius` metres across its rim before the wobble. */
export interface IceRecipe {
  count: number;
  radius: readonly [number, number];
  /** Lake centres stay this far inside the map's middle. */
  reach: number;
}

export interface FrozenLake {
  x: number;
  z: number;
  radius: number;
  level: number;
}

const STEP = 32;
/** The rim wanders up to half this share of the radius in and out, over noise this many metres across. */
const WOBBLE = 1.2;
const WOBBLE_SCALE = 45;
const WOBBLE_SEED = 71;
/** Ground eases from the ice back to the land over this many metres past the rim. */
const SHORE = 24;
/** Metres of open ground every lake's shore keeps from a road's side, a town and another lake. */
const ROAD_CLEAR = 20;
const TOWN_CLEAR = 40;
const LAKE_CLEAR = 60;

const outer = (lake: FrozenLake) => lake.radius * (1 + WOBBLE / 2) + SHORE;

export function plan_ice(seed: number, land: Terrain, graph: RoadGraph, towns: readonly Town[], shape: IceRecipe): FrozenLake[] {
  const next = mulberry32(sub(seed, "ice"));
  const points = graph.edges.flatMap((e) => e.points.map((p) => ({ x: p.x, z: p.z, half: e.half })));
  const room = (x: number, z: number) => {
    let best = Infinity;
    for (const p of points) best = Math.min(best, Math.sqrt((p.x - x) * (p.x - x) + (p.z - z) * (p.z - z)) - p.half - ROAD_CLEAR);
    for (const t of towns) best = Math.min(best, Math.sqrt((t.x - x) * (t.x - x) + (t.z - z) * (t.z - z)) - t.radius - TOWN_CLEAR);
    return best;
  };
  const spots: { x: number; z: number; y: number }[] = [];
  for (let z = -shape.reach; z <= shape.reach; z += STEP)
    for (let x = -shape.reach; x <= shape.reach; x += STEP) if (x * x + z * z <= shape.reach * shape.reach) spots.push({ x, z, y: sample(land.heights, x, z) });
  spots.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
  const lakes: FrozenLake[] = [];
  for (const spot of spots) {
    if (lakes.length >= shape.count) break;
    const want = shape.radius[0] + (shape.radius[1] - shape.radius[0]) * next();
    let free = room(spot.x, spot.z);
    for (const l of lakes) free = Math.min(free, Math.sqrt((l.x - spot.x) * (l.x - spot.x) + (l.z - spot.z) * (l.z - spot.z)) - outer(l) - LAKE_CLEAR);
    const radius = Math.min(want, (free - SHORE) / (1 + WOBBLE / 2));
    if (radius < shape.radius[0]) continue;
    lakes.push({ x: spot.x, z: spot.z, radius, level: spot.y });
  }
  return lakes;
}

export function on_ice(lakes: readonly FrozenLake[], x: number, z: number): boolean {
  return lakes.some((l) => (l.x - x) * (l.x - x) + (l.z - z) * (l.z - z) < l.radius * l.radius * (1 + WOBBLE / 2) * (1 + WOBBLE / 2));
}

export function freeze_vertex(lakes: readonly FrozenLake[], seed: number, heights: Float32Array, surface: Uint8Array, k: number, x: number, z: number) {
  for (const lake of lakes) {
    const dx = x - lake.x;
    const dz = z - lake.z;
    const reach = outer(lake);
    if (dx * dx + dz * dz >= reach * reach) continue;
    const d = Math.sqrt(dx * dx + dz * dz);
    const rim = lake.radius * (1 + (fbm(x / WOBBLE_SCALE, z / WOBBLE_SCALE, seed + WOBBLE_SEED, 3) - 0.5) * WOBBLE);
    if (d < rim) {
      heights[k] = lake.level;
      surface[k] = SurfaceId.ICE;
    } else heights[k] = lake.level + (heights[k] - lake.level) * smoothstep(rim, rim + SHORE, d);
  }
}

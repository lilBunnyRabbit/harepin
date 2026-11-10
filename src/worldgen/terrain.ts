import { mulberry32, sub } from "../rng";
import { at, cells, WHOLE, type Grid } from "./field";
import { fbm, smoothstep } from "./noise";
import { ISLAND, type TerrainRecipe } from "./recipe";
import { CELL, N, ORIGIN, SIZE, type Terrain } from "./types";

interface Peak {
  x: number;
  z: number;
}

function peak_of(seed: number, reach: number): Peak {
  const next = mulberry32(sub(seed, "peak"));
  let x = 0;
  let z = 0;
  while (x * x + z * z < 0.01) {
    x = next() - 0.5;
    z = next() - 0.5;
  }
  const scale = (Math.sqrt(next()) * reach) / Math.sqrt(x * x + z * z);
  return { x: x * scale, z: z * scale };
}

// hills ** 1.75 and the polynomial bump stand in for ** 1.7 and exp(), which are not bit-exact across engines.
function raw_height(x: number, z: number, seed: number, peak: Peak, shape: TerrainRecipe): number {
  const r = Math.sqrt(x * x + z * z) / shape.mask + (fbm(x / 380, z / 380, seed + 3) - 0.5) * 0.3;
  const mask = 1 - smoothstep(0.8, 1.0, r);
  const hills = fbm(x / 520, z / 520, seed + 7);
  const ridge = 1 - Math.abs(2 * fbm(x / 300, z / 300, seed + 11) - 1);
  const dx = x - peak.x;
  const dz = z - peak.z;
  const t = Math.min(1, (dx * dx + dz * dz) / (shape.peak.radius * shape.peak.radius));
  const top = shape.peak.height * (1 - t) * (1 - t) * (1 - t);
  let land = 5 + hills * Math.sqrt(hills) * Math.sqrt(Math.sqrt(hills)) * shape.hills + ridge * ridge * ridge * shape.ridge + top;
  if (shape.mesas) land = terraced(land, shape.mesas);
  const ground = shape.edge + (land - shape.edge) * mask;
  return shape.dunes ? ground + dunes(x, z, seed, shape.dunes) : ground;
}

// The riser blend is smoothstep over the top `riser` share of each step, so a terrace face stays a slope the mesh can draw.
function terraced(h: number, mesas: NonNullable<TerrainRecipe["mesas"]>): number {
  if (h <= mesas.base) return h;
  const t = (h - mesas.base) / mesas.step;
  const floor = Math.floor(t);
  return mesas.base + (floor + smoothstep(1 - mesas.riser, 1, t - floor)) * mesas.step;
}

function dunes(x: number, z: number, seed: number, shape: NonNullable<TerrainRecipe["dunes"]>): number {
  const crest = 1 - Math.abs(2 * fbm(x / shape.scale, (z * 3) / shape.scale, seed + 17, 3) - 1);
  return crest * crest * shape.height;
}

export function terrain(seed: number, shape: TerrainRecipe = ISLAND.terrain, grid: Grid = WHOLE): Terrain {
  const heights = new Float32Array(cells(grid));
  const peak = peak_of(seed, shape.peak.reach);
  for (let j = grid.j0; j <= grid.j1; j++)
    for (let i = grid.i0; i <= grid.i1; i++) heights[at(grid, i, j)] = raw_height(ORIGIN + i * CELL, ORIGIN + j * CELL, seed, peak, shape);
  return { seed, size: SIZE, cell: CELL, n: N, heights, road_dist: new Float32Array(heights.length).fill(1e9), surface: new Uint8Array(heights.length) };
}

import { mulberry32, sub } from "../rng";
import { at, cells, WHOLE, type Grid } from "./field";
import { fbm, smoothstep } from "./noise";
import { ISLAND, type Power, type TerraceLayer, type TerrainLayer, type TerrainRecipe } from "./recipe";
import { CELL, N, ORIGIN, SIZE, type Terrain } from "./types";

/** Share of the mask radius where the land starts fading to the edge height. */
const MASK_FADE = 0.8;

function peak_of(seed: number, reach: number): { x: number; z: number } {
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

// t ** 1.75 as nested roots: a float power is not bit-exact across engines.
function shaped(t: number, power: Power): number {
  switch (power) {
    case 1:
      return t;
    case 1.75:
      return t * Math.sqrt(t) * Math.sqrt(Math.sqrt(t));
    case 2:
      return t * t;
    case 3:
      return t * t * t;
  }
}

// The riser blend is smoothstep over the top `riser` share of each step, so a terrace face stays a slope the mesh can draw.
function terraced(h: number, layer: TerraceLayer): number {
  if (h <= layer.base) return h;
  const t = (h - layer.base) / layer.step;
  const floor = Math.floor(t);
  return layer.base + (floor + smoothstep(1 - layer.riser, 1, t - floor)) * layer.step;
}

/** A layer with what it draws from the seed once: the peak's position. */
interface Seeded {
  layer: TerrainLayer;
  x: number;
  z: number;
}

// The polynomial bump stands in for exp(), which is not bit-exact across engines.
function apply(seeded: Seeded, seed: number, x: number, z: number, h: number): number {
  const layer = seeded.layer;
  switch (layer.kind) {
    case "lift":
      return h + layer.height;
    case "fbm":
      return h + shaped(fbm(x / layer.scale, z / layer.scale, seed + layer.seed, layer.octaves), layer.power) * layer.amp;
    case "ridged":
      return h + shaped(1 - Math.abs(2 * fbm(x / layer.scale, (z * layer.stretch) / layer.scale, seed + layer.seed, layer.octaves) - 1), layer.power) * layer.amp;
    case "peak": {
      const dx = x - seeded.x;
      const dz = z - seeded.z;
      const t = Math.min(1, (dx * dx + dz * dz) / (layer.radius * layer.radius));
      return h + layer.height * (1 - t) * (1 - t) * (1 - t);
    }
    case "terrace":
      return terraced(h, layer);
    case "mask": {
      const r = Math.sqrt(x * x + z * z) / layer.radius + (fbm(x / layer.scale, z / layer.scale, seed + layer.seed) - 0.5) * layer.wobble;
      return layer.edge + (h - layer.edge) * (1 - smoothstep(MASK_FADE, 1.0, r));
    }
  }
}

function seeded(seed: number, shape: TerrainRecipe): Seeded[] {
  return shape.map((layer) => (layer.kind === "peak" ? { layer, ...peak_of(seed, layer.reach) } : { layer, x: 0, z: 0 }));
}

/** The recipe's point layers folded in order over a height starting at 0. */
function fold(layers: readonly Seeded[], seed: number, x: number, z: number): number {
  let h = 0;
  for (let k = 0; k < layers.length; k++) h = apply(layers[k], seed, x, z, h);
  return h;
}

// The lattice loop calls `fold` itself: through the `land_height` closure the terrain stage runs a sixth slower.
export function terrain(seed: number, shape: TerrainRecipe = ISLAND.terrain, grid: Grid = WHOLE): Terrain {
  const heights = new Float32Array(cells(grid));
  const layers = seeded(seed, shape);
  for (let j = grid.j0; j <= grid.j1; j++)
    for (let i = grid.i0; i <= grid.i1; i++) heights[at(grid, i, j)] = fold(layers, seed, ORIGIN + i * CELL, ORIGIN + j * CELL);
  return { seed, size: SIZE, cell: CELL, n: N, heights, road_dist: new Float32Array(heights.length).fill(1e9), surface: new Uint8Array(heights.length) };
}

/** `terrain`'s height with the seed's layers drawn once, for plans that sample land off the vertex lattice. */
export function land_height(seed: number, shape: TerrainRecipe): (x: number, z: number) => number {
  const layers = seeded(seed, shape);
  return (x, z) => fold(layers, seed, x, z);
}

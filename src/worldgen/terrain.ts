import { mulberry32, sub } from "../rng";
import { at, cells, WHOLE, type Grid } from "./field";
import { circle16, circle24, fbm, smoothstep } from "./noise";
import { ISLAND, type CraterLayer, type DunesLayer, type PanLayer, type Power, type RangeLayer, type TerraceLayer, type TerrainLayer, type TerrainRecipe } from "./recipe";
import type { LavaPool } from "./lava";
import { CELL, N, ORIGIN, SIZE, type Terrain } from "./types";

/** Share of the mask radius where the land starts fading to the edge height. */
const MASK_FADE = 0.8;
/** Crests bend over noise this many waves across, by up to half of `DUNE_BEND` waves either way. */
const DUNE_BEND_SCALE = 2.5;
const DUNE_BEND = 1.6;
/** Dune fields come and go over noise this many waves across; between the cuts a field fades in. */
const DUNE_FIELD_SCALE = 4;
const DUNE_FIELD = [0.4, 0.6] as const;
/** Spacing of the coarse sample a pan's level is drawn from, metres. */
const PAN_SAMPLE = 64;
/** Height over the pan level, as a share of its blend, still counted as pan floor. */
const PAN_TOP = 0.1;
/** A range's crest meanders over noise this many metres along it; its teeth are this far apart along it, half that across. */
const RANGE_BEND = 700;
const RANGE_TEETH = 220;

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

function wind_of(seed: number, offset: number): { x: number; z: number } {
  const [x, z] = circle16()[Math.floor(mulberry32(sub(seed, "wind") + offset)() * 16)];
  return { x, z };
}

// Each wave rises over smoothstep to a sharp brink, then drops down the lee face, so the face stays a slope the mesh can draw.
function dunes(layer: DunesLayer, seed: number, wx: number, wz: number, x: number, z: number): number {
  const along = x * wx + z * wz;
  const across = z * wx - x * wz;
  let h = 0;
  for (let b = 0; b < layer.bands.length; b++) {
    const band = layer.bands[b];
    const s = seed + layer.seed + b * 31;
    const bend = (fbm(across / (band.wave * DUNE_BEND_SCALE), along / (band.wave * DUNE_BEND_SCALE * 2), s, 3) - 0.5) * DUNE_BEND;
    const u = along / band.wave + bend;
    const t = u - Math.floor(u);
    const rise = 1 - band.lee;
    const profile = t < rise ? smoothstep(0, rise, t) : smoothstep(1, rise, t);
    const field = smoothstep(DUNE_FIELD[0], DUNE_FIELD[1], fbm(x / (band.wave * DUNE_FIELD_SCALE), z / (band.wave * DUNE_FIELD_SCALE), s + 7, 3));
    h += profile * band.height * field;
  }
  return h;
}

// Quadratic smooth max of the height and the level: flat under level - blend, the height itself over level + blend.
function pan(h: number, level: number, blend: number): number {
  const t = (h - level) / blend;
  if (t >= 1) return h;
  if (t <= -1) return level;
  return level + (blend * (t + 1) * (t + 1)) / 4;
}

/** Offset of a range's crest line from its middle, across the heading, `along` metres along it. */
function crest_of(layer: RangeLayer, seed: number, along: number): number {
  return (fbm(along / RANGE_BEND, 0.5, seed + layer.seed, 3) - 0.5) * 2 * layer.meander;
}

// Crest line along the heading, meandering over noise; teeth from ridged noise; each pass a smoothstep dip on the crest,
// the deepest one winning where two overlap.
function range(layer: RangeLayer, seed: number, ax: number, az: number, x: number, z: number): number {
  const along = x * ax + z * az;
  const across = z * ax - x * az;
  const fall = 1 - smoothstep(0, layer.width, Math.abs(across - crest_of(layer, seed, along)));
  if (fall <= 0) return 0;
  const teeth = 1 - Math.abs(2 * fbm(along / RANGE_TEETH, across / (RANGE_TEETH / 2), seed + layer.seed + 3, 4) - 1);
  const { at, depth, floor, width } = layer.saddle;
  let dip = 0;
  for (const a of at) dip = Math.max(dip, 1 - smoothstep(floor, width, Math.abs(along - a)));
  return fall * layer.height * (1 - layer.saw + layer.saw * teeth) * (1 - depth * dip);
}

/** Where the closed `path` crosses a range's crest line: the point before each crossing and how far along the range it is. */
export function crest_crossings(seed: number, layer: RangeLayer, path: readonly (readonly [number, number])[]): { index: number; along: number }[] {
  const { x: ax, z: az } = wind_of(seed, layer.seed);
  const along = path.map(([x, z]) => x * ax + z * az);
  const side = path.map(([x, z], i) => z * ax - x * az - crest_of(layer, seed, along[i]));
  const out: { index: number; along: number }[] = [];
  for (let i = 0; i < path.length; i++) {
    const j = (i + 1) % path.length;
    if (side[i] < 0 === side[j] < 0) continue;
    out.push({ index: i, along: along[i] + ((along[j] - along[i]) * side[i]) / (side[i] - side[j]) });
  }
  return out;
}

/** The shape with each range's passes where the closed `path` crosses its crest; the shape itself when it has no range. */
export function with_passes(seed: number, shape: TerrainRecipe, path: readonly (readonly [number, number])[]): TerrainRecipe {
  if (!shape.some((layer) => layer.kind === "range")) return shape;
  return shape.map((layer) =>
    layer.kind === "range" ? { ...layer, saddle: { ...layer.saddle, at: crest_crossings(seed, layer, path).map((c) => c.along) } } : layer,
  );
}

/** A layer with what it draws from the seed once: the peak's position, the dunes' wind or range's heading, or the pan's or crater's level. */
interface Seeded {
  layer: TerrainLayer;
  x: number;
  z: number;
  level: number;
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
    case "crater": {
      const d = Math.sqrt(x * x + z * z);
      const lipped = h + layer.lip * (1 - smoothstep(0, layer.lip_width, Math.abs(d - layer.radius)));
      return seeded.level + (lipped - seeded.level) * smoothstep(layer.radius * layer.floor, layer.radius, d);
    }
    case "terrace":
      return terraced(h, layer);
    case "mask": {
      const r = Math.sqrt(x * x + z * z) / layer.radius + (fbm(x / layer.scale, z / layer.scale, seed + layer.seed) - 0.5) * layer.wobble;
      return layer.edge + (h - layer.edge) * (1 - smoothstep(MASK_FADE, 1.0, r));
    }
    case "dunes":
      return h + dunes(layer, seed, seeded.x, seeded.z, x, z);
    case "pan":
      return pan(h, seeded.level, layer.blend);
    case "range":
      return h + range(layer, seed, seeded.x, seeded.z, x, z);
  }
}

// The share's height among the layers so far, sampled on a coarse lattice over the whole map.
function level_of(below: readonly Seeded[], seed: number, share: number): number {
  const hs: number[] = [];
  for (let z = ORIGIN; z <= -ORIGIN; z += PAN_SAMPLE) for (let x = ORIGIN; x <= -ORIGIN; x += PAN_SAMPLE) hs.push(fold(below, seed, x, z));
  hs.sort((a, b) => a - b);
  return hs[Math.min(hs.length - 1, Math.floor(hs.length * share))];
}

// The mean height round the rim of the layers so far, less the crater's depth.
function crater_floor(below: readonly Seeded[], seed: number, layer: CraterLayer): number {
  let sum = 0;
  const ring = circle24();
  for (const [c, s] of ring) sum += fold(below, seed, c * layer.radius, s * layer.radius);
  return sum / ring.length - layer.depth;
}

function seeded(seed: number, shape: TerrainRecipe): Seeded[] {
  const out: Seeded[] = [];
  for (const layer of shape) {
    if (layer.kind === "peak") out.push({ layer, ...peak_of(seed, layer.reach), level: 0 });
    else if (layer.kind === "dunes" || layer.kind === "range") out.push({ layer, ...wind_of(seed, layer.seed), level: 0 });
    else if (layer.kind === "pan") out.push({ layer, x: 0, z: 0, level: level_of(out, seed, layer.share) });
    else if (layer.kind === "crater") out.push({ layer, x: 0, z: 0, level: crater_floor(out, seed, layer) });
    else out.push({ layer, x: 0, z: 0, level: 0 });
  }
  return out;
}

/** Height at or under which the ground is a pan's floor, or null when the recipe has no pan layer. */
export function pan_floor(seed: number, shape: TerrainRecipe): number | null {
  const layers = seeded(seed, shape);
  const at = layers.findIndex((s) => s.layer.kind === "pan");
  if (at < 0) return null;
  const { layer, level } = layers[at];
  return layer.kind === "pan" ? level + layer.blend * PAN_TOP : null;
}

/** A pool per crater that holds lava, over the crater's floor. */
export function lava_pools(seed: number, shape: TerrainRecipe): LavaPool[] {
  return seeded(seed, shape).flatMap(({ layer, level }) => (layer.kind === "crater" && layer.lava > 0 ? [{ x: 0, z: 0, radius: layer.radius, level: level + layer.lava }] : []));
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

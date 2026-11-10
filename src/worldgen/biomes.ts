import { at, sample, up, WHOLE, type Grid } from "./field";
import { fbm, hash } from "./noise";
import type { PlanGrid } from "./plan-grid";
import { ISLAND, type BiomeRecipe, type ZoneRecipe } from "./recipe";
import { CELL, N, ORIGIN, ROAD_HALF, SurfaceId, type Ground, type ItemKind, type Solid, type Terrain, type Tree } from "./types";

export const Biome = {
  COAST: "coast",
  MEADOW: "meadow",
  FOREST: "forest",
  UPLAND: "upland",
} as const;
export type Biome = (typeof Biome)[keyof typeof Biome];

export const TreeKind = { PINE: 0, BROADLEAF: 1, SCRUB: 2 } as const;
export type TreeKind = (typeof TreeKind)[keyof typeof TreeKind];

const FIELD_SCALE = 700;
const FIELD_SEED = 61;
/** Score per metre of height, so the dry third sits on high ground and meadows on low ground. */
const UPLAND_PULL = 0.0016;
const CUT_STEP = 8;
const PATCH_SCALE = 140;
const PATCH_SEED = 21;
const DENSITY_SCALE = 180;
const DENSITY_SEED = 55;
/** Slope of the tree threshold across the density field: steep, so forests end in edges and clearings, not speckle. */
const EDGE = 6;
const TREE_SPACING = 13;
// Scrub is waist-high brush the car pushes through, so it gets no solid.
const SCRUB_SCALE = [0.45, 0.8];

export interface BiomeCuts {
  seed: number;
  recipe: BiomeRecipe;
  /** Score where each inland band after the first starts. */
  cuts: number[];
}

export interface TreeRule {
  start: number;
  fill: number;
  pine: number;
  scrub: number;
  extra: number;
}

function score(seed: number, x: number, z: number, y: number): number {
  return fbm(x / FIELD_SCALE, z / FIELD_SCALE, seed + FIELD_SEED, 3) + y * UPLAND_PULL;
}

function coast_top(seed: number, coast: ZoneRecipe["coast"], x: number, z: number): number {
  return coast.top + (fbm(x / coast.scale, z / coast.scale, seed + FIELD_SEED + 2, 2) - 0.5) * coast.wobble;
}

// Cut into equal shares of the field over this island's own land, so every seed gets every band whatever its noise does.
export function biome_cuts(seed: number, heights: Float32Array, recipe: BiomeRecipe = ISLAND.biomes): BiomeCuts {
  const scores: number[] = [];
  for (let j = 0; j <= N; j += CUT_STEP)
    for (let i = 0; i <= N; i += CUT_STEP) {
      const y = heights[j * (N + 1) + i];
      const x = ORIGIN + i * CELL;
      const z = ORIGIN + j * CELL;
      if (y >= coast_top(seed, recipe.zones.coast, x, z)) scores.push(score(seed, x, z, y));
    }
  return cut_into_bands(seed, scores, recipe);
}

/** The same shares over a streamed world's coarse plan grid, which every tile of it shares. */
export function plan_cuts(seed: number, grid: PlanGrid, recipe: BiomeRecipe): BiomeCuts {
  const scores: number[] = [];
  for (let j = 0; j <= grid.n; j++)
    for (let i = 0; i <= grid.n; i++) {
      const y = grid.heights[j * (grid.n + 1) + i];
      const x = grid.ext.origin + i * grid.cell;
      const z = grid.ext.origin + j * grid.cell;
      if (y >= coast_top(seed, recipe.zones.coast, x, z)) scores.push(score(seed, x, z, y));
    }
  return cut_into_bands(seed, scores, recipe);
}

function cut_into_bands(seed: number, scores: number[], recipe: BiomeRecipe): BiomeCuts {
  scores.sort((a, b) => a - b);
  const parts = recipe.zones.bands.length;
  const cuts: number[] = [];
  for (let k = 1; k < parts; k++) cuts.push(scores.length ? scores[Math.floor((scores.length * k) / parts)] : 0);
  return { seed, recipe, cuts };
}

export function biome_at(cuts: BiomeCuts, x: number, z: number, y: number): Biome {
  const { coast, bands } = cuts.recipe.zones;
  if (y < coast.top + coast.wobble / 2 && y < coast_top(cuts.seed, coast, x, z)) return Biome.COAST;
  const s = score(cuts.seed, x, z, y);
  for (let k = 0; k < cuts.cuts.length; k++) if (s < cuts.cuts[k]) return bands[k];
  return bands[bands.length - 1];
}

export function tree_tries(cuts: BiomeCuts, biome: Biome): number {
  return 1 + cuts.recipe.rules[biome].extra;
}

export function tree_kind(cuts: BiomeCuts, biome: Biome, x: number, z: number, k: number): TreeKind | null {
  const rule = cuts.recipe.rules[biome];
  const density = fbm(x / DENSITY_SCALE, z / DENSITY_SCALE, cuts.seed + DENSITY_SEED, 3);
  const roll = hash(Math.floor(x * 8), Math.floor(z * 8), cuts.seed + 93 + k);
  if (roll > (density - rule.start) * EDGE * rule.fill) return null;
  const pick = hash(Math.floor(x * 8), Math.floor(z * 8), cuts.seed + 95 + k);
  return pick < rule.scrub ? TreeKind.SCRUB : pick < rule.scrub + rule.pine ? TreeKind.PINE : TreeKind.BROADLEAF;
}

export function ground_at(cuts: BiomeCuts, x: number, z: number, y: number): Ground {
  const rule = cuts.recipe.ground[biome_at(cuts, x, z, y)];
  const patch = fbm(x / PATCH_SCALE, z / PATCH_SCALE, cuts.seed + PATCH_SEED, 3);
  const fray = rule.soft ? (hash(x, z, cuts.seed + PATCH_SEED + 1) - 0.5) * rule.soft : 0;
  return patch + fray > rule.cut ? rule.above : rule.below;
}

/** Lays the recipe's surfaces (hardpack under its DIRT ground rows) into the surface grid, so grip and colour agree. */
export function harden(cuts: BiomeCuts, land: Terrain, grid: Grid = WHOLE) {
  const laid = cuts.recipe.surfaces;
  if (!Object.values(cuts.recipe.ground).some((rule) => laid[rule.above] !== undefined || laid[rule.below] !== undefined)) return;
  const { heights, surface } = land;
  for (let j = grid.j0; j <= grid.j1; j++)
    for (let i = grid.i0; i <= grid.i1; i++) {
      const k = at(grid, i, j);
      if (surface[k] !== SurfaceId.GRASS) continue;
      const id = laid[ground_at(cuts, ORIGIN + i * CELL, ORIGIN + j * CELL, heights[k])];
      if (id !== undefined) surface[k] = id;
    }
}

export function item_kind(cuts: BiomeCuts, x: number, z: number, y: number): ItemKind | null {
  return cuts.recipe.items[biome_at(cuts, x, z, y)];
}

export interface Planted {
  trees: Tree[];
  solids: Solid[];
}

/** What planting reads of the land: the whole grid on a compact world, a tile and its neighbours on a streamed one. */
export interface LandProbe {
  height(x: number, z: number): number;
  road_dist(x: number, z: number): number;
  up(x: number, z: number): number;
}

/** `free` rules out ground taken by lots, towns, jumps and landmarks. */
export function plant(cuts: BiomeCuts, land: Terrain, free: (x: number, z: number) => boolean): Planted {
  const { heights, road_dist } = land;
  const probe: LandProbe = { height: (x, z) => sample(heights, x, z), road_dist: (x, z) => sample(road_dist, x, z), up: (x, z) => up(heights, x, z) };
  const out: Planted = { trees: [], solids: [] };
  const limit = -ORIGIN - TREE_SPACING;
  for (let z = ORIGIN + TREE_SPACING; z < limit; z += TREE_SPACING)
    for (let x = ORIGIN + TREE_SPACING; x < limit; x += TREE_SPACING) plant_at(cuts, probe, x, z, free, out);
  return out;
}

/**
 * The trees of the lattice points inside the square from (x0, z0) of side `size`: each point hashes its own trees, so
 * a chunk plants the same whatever order chunks are built in, and no tree belongs to two chunks.
 */
export function plant_square(cuts: BiomeCuts, probe: LandProbe, x0: number, z0: number, size: number, free: (x: number, z: number) => boolean): Planted {
  const out: Planted = { trees: [], solids: [] };
  for (let m = Math.ceil((z0 - ORIGIN) / TREE_SPACING); ORIGIN + m * TREE_SPACING < z0 + size; m++)
    for (let n = Math.ceil((x0 - ORIGIN) / TREE_SPACING); ORIGIN + n * TREE_SPACING < x0 + size; n++) plant_at(cuts, probe, ORIGIN + n * TREE_SPACING, ORIGIN + m * TREE_SPACING, free, out);
  return out;
}

function plant_at(cuts: BiomeCuts, probe: LandProbe, x: number, z: number, free: (x: number, z: number) => boolean, out: Planted) {
  const seed = cuts.seed;
  const biome = biome_at(cuts, x, z, probe.height(x, z));
  const tries = tree_tries(cuts, biome);
  for (let k = 0; k < tries; k++) {
    const px = x + (hash(x, z, seed + 91 + k * 16) - 0.5) * TREE_SPACING;
    const pz = z + (hash(x, z, seed + 92 + k * 16) - 0.5) * TREE_SPACING;
    const y = probe.height(px, pz);
    if (y < cuts.recipe.limits.tree_floor || y > cuts.recipe.limits.tree_line) continue;
    const kind = tree_kind(cuts, biome, px, pz, k);
    if (kind === null) continue;
    if (probe.road_dist(px, pz) < ROAD_HALF + 7) continue;
    if (probe.up(px, pz) < 0.82 || !free(px, pz)) continue;
    const roll = hash(x, z, seed + 94 + k * 16);
    if (kind === TreeKind.SCRUB) {
      out.trees.push({
        x: px,
        y,
        z: pz,
        scale: SCRUB_SCALE[0] + roll * (SCRUB_SCALE[1] - SCRUB_SCALE[0]),
        kind,
      });
      continue;
    }
    const scale = 0.75 + roll * 0.9;
    out.trees.push({ x: px, y, z: pz, scale, kind });
    out.solids.push({
      kind: "circle",
      x: px,
      y,
      z: pz,
      radius: 0.35 * scale,
      height: 6 * scale,
    });
  }
}

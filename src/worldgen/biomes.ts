import { sample, up } from "./field";
import { fbm, hash } from "./noise";
import { ISLAND, type BiomeRecipe } from "./recipe";
import { CELL, N, ORIGIN, ROAD_HALF, type ItemKind, type Solid, type Terrain, type Tree } from "./types";

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
const COAST_TOP = 6;
const COAST_WOBBLE = 5;
const COAST_SCALE = 90;
const CUT_STEP = 8;
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
  forest: number;
  upland: number;
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

function coast_top(seed: number, x: number, z: number): number {
  return COAST_TOP + (fbm(x / COAST_SCALE, z / COAST_SCALE, seed + FIELD_SEED + 2, 2) - 0.5) * COAST_WOBBLE;
}

// Cut at the field's thirds over this island's own land, so every seed gets all three regions whatever its noise does.
export function biome_cuts(seed: number, heights: Float32Array, recipe: BiomeRecipe = ISLAND.biomes): BiomeCuts {
  const scores: number[] = [];
  for (let j = 0; j <= N; j += CUT_STEP)
    for (let i = 0; i <= N; i += CUT_STEP) {
      const y = heights[j * (N + 1) + i];
      const x = ORIGIN + i * CELL;
      const z = ORIGIN + j * CELL;
      if (y >= coast_top(seed, x, z)) scores.push(score(seed, x, z, y));
    }
  scores.sort((a, b) => a - b);
  if (!scores.length) return { seed, recipe, forest: 0, upland: 0 };
  return {
    seed,
    recipe,
    forest: scores[Math.floor(scores.length / 3)],
    upland: scores[Math.floor((scores.length * 2) / 3)],
  };
}

export function biome_at(cuts: BiomeCuts, x: number, z: number, y: number): Biome {
  if (y < COAST_TOP + COAST_WOBBLE / 2 && y < coast_top(cuts.seed, x, z)) return Biome.COAST;
  const s = score(cuts.seed, x, z, y);
  return s < cuts.forest ? Biome.MEADOW : s < cuts.upland ? Biome.FOREST : Biome.UPLAND;
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

export function item_kind(cuts: BiomeCuts, x: number, z: number, y: number): ItemKind | null {
  return cuts.recipe.items[biome_at(cuts, x, z, y)];
}

export interface Planted {
  trees: Tree[];
  solids: Solid[];
}

/** `free` rules out ground taken by lots, towns, jumps and landmarks. */
export function plant(cuts: BiomeCuts, land: Terrain, free: (x: number, z: number) => boolean): Planted {
  const { heights, road_dist } = land;
  const seed = cuts.seed;
  const out: Planted = { trees: [], solids: [] };
  const limit = -ORIGIN - TREE_SPACING;
  for (let z = ORIGIN + TREE_SPACING; z < limit; z += TREE_SPACING)
    for (let x = ORIGIN + TREE_SPACING; x < limit; x += TREE_SPACING) {
      const biome = biome_at(cuts, x, z, sample(heights, x, z));
      const tries = tree_tries(cuts, biome);
      for (let k = 0; k < tries; k++) {
        const px = x + (hash(x, z, seed + 91 + k * 16) - 0.5) * TREE_SPACING;
        const pz = z + (hash(x, z, seed + 92 + k * 16) - 0.5) * TREE_SPACING;
        const y = sample(heights, px, pz);
        if (y < 3 || y > 125) continue;
        const kind = tree_kind(cuts, biome, px, pz, k);
        if (kind === null) continue;
        if (sample(road_dist, px, pz) < ROAD_HALF + 7) continue;
        if (up(heights, px, pz) < 0.82 || !free(px, pz)) continue;
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
  return out;
}

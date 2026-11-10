import type { Biome, TreeRule } from "./biomes";
import { Ground, PropKind, type ItemKind } from "./types";

export interface TerrainRecipe {
  /** Distance from the centre where the land meets `edge`, metres. */
  mask: number;
  /** Height past the mask: the island's sea floor, the desert's dune wall. */
  edge: number;
  peak: { height: number; radius: number; reach: number };
  /** Rolling hills and ridge lines, metres at full noise. */
  hills: number;
  ridge: number;
  /** Long ridged sand waves across the whole square, `scale` metres along and `scale / 3` across. */
  dunes: { height: number; scale: number } | null;
  /** Land above `base` is cut into terraces `step` high, with risers `riser` of a step wide. */
  mesas: { base: number; step: number; riser: number } | null;
}

/** A biome's ground row: `above` where its patch noise passes `cut`, else `below`; `soft` dithers the cut that wide. */
export interface GroundRule {
  cut: number;
  above: Ground;
  below: Ground;
  soft: number;
}

/** Props strewn over open ground: one at most per `spacing` cell, on `odds` of the cells in `biomes`. */
export interface ScatterRule {
  kind: PropKind;
  spacing: number;
  odds: number;
  biomes: readonly Biome[];
}

export interface BiomeRecipe {
  rules: Record<Biome, TreeRule>;
  items: Record<Biome, ItemKind | null>;
  ground: Record<Biome, GroundRule>;
}

export interface RoadRecipe {
  /** Ring control radius: base plus noise times swing, clamped to min..max. */
  loop: { radius: number; swing: number; min: number; max: number };
  /** Hairpin counts the summit stack tries, most first. */
  stacks: readonly number[];
  /** The canyon runs down to ground under `outlet` metres; null = no canyon. */
  canyon: { outlet: number } | null;
  kickers: { road: number; total: number; big: number };
}

export interface TownRecipe {
  min: number;
  max: number;
  /** Gardens and house yards get trees; false gives them a water tank and boulders instead. */
  trees: boolean;
  /** Street block size: min plus up to span, metres. */
  block: { min: number; span: number };
}

export const Landmark = { MAST: "mast", LIGHTHOUSE: "lighthouse", TURBINES: "turbines", ARCH: "arch" } as const;
export type Landmark = (typeof Landmark)[keyof typeof Landmark];

/** A land kind's tuning. Part of the kind's version: changing a value bumps it. */
export interface Recipe {
  terrain: TerrainRecipe;
  biomes: BiomeRecipe;
  road: RoadRecipe;
  towns: TownRecipe;
  landmarks: readonly Landmark[];
  scatter: readonly ScatterRule[];
}

export const ISLAND: Recipe = {
  terrain: { mask: 960, edge: -9, peak: { height: 150, radius: 430, reach: 220 }, hills: 95, ridge: 22, dunes: null, mesas: null },
  biomes: {
    rules: {
      coast: { start: 0.5, fill: 0.12, pine: 0.2, scrub: 0.6, extra: 0 },
      meadow: { start: 0.52, fill: 0.3, pine: 0.15, scrub: 0.1, extra: 0 },
      forest: { start: 0.45, fill: 1, pine: 0.88, scrub: 0, extra: 1 },
      upland: { start: 0.3, fill: 0.22, pine: 0.05, scrub: 0.75, extra: 0 },
    },
    items: { coast: "log", meadow: "hay", forest: "log", upland: "rock" },
    ground: {
      coast: { cut: 0.55, above: Ground.SAND, below: Ground.DUNE, soft: 0 },
      meadow: { cut: 0.55, above: Ground.DRY, below: Ground.GRASS, soft: 0 },
      forest: { cut: 0.6, above: Ground.GRASS, below: Ground.FOREST, soft: 0 },
      upland: { cut: 0.5, above: Ground.DRY, below: Ground.UPLAND, soft: 0 },
    },
  },
  road: { loop: { radius: 620, swing: 640, min: 380, max: 860 }, stacks: [4, 2], canyon: { outlet: 2 }, kickers: { road: 4, total: 12, big: 3 } },
  towns: { min: 3, max: 6, trees: true, block: { min: 45, span: 25 } },
  landmarks: [Landmark.MAST, Landmark.LIGHTHOUSE, Landmark.TURBINES, Landmark.ARCH],
  scatter: [],
};

const BARE = { start: 1, fill: 0, pine: 0, scrub: 0, extra: 0 };
/** Dither width of the desert's patch edges, so hardpack frays into sand instead of a hard camouflage line. */
const SOFT = 0.3;

/** Sand, hardpack and terraced mesas inside a dune wall: low hills, no trees, a few outposts. */
export const DESERT: Recipe = {
  terrain: {
    mask: 960,
    edge: 42,
    peak: { height: 40, radius: 380, reach: 260 },
    hills: 62,
    ridge: 10,
    dunes: { height: 6, scale: 260 },
    mesas: { base: 28, step: 16, riser: 0.3 },
  },
  biomes: {
    rules: { coast: BARE, meadow: BARE, forest: BARE, upland: BARE },
    items: { coast: "rock", meadow: "rock", forest: null, upland: "rock" },
    ground: {
      coast: { cut: 0.55, above: Ground.SAND, below: Ground.SAND, soft: 0 },
      meadow: { cut: 0.55, above: Ground.DIRT, below: Ground.SAND, soft: SOFT },
      forest: { cut: 0.6, above: Ground.DUNE, below: Ground.SAND, soft: SOFT },
      upland: { cut: 0.5, above: Ground.UPLAND, below: Ground.DUNE, soft: SOFT },
    },
  },
  road: { loop: { radius: 650, swing: 500, min: 420, max: 850 }, stacks: [], canyon: { outlet: 24 }, kickers: { road: 4, total: 16, big: 4 } },
  towns: { min: 1, max: 3, trees: false, block: { min: 35, span: 15 } },
  landmarks: [Landmark.ARCH, Landmark.MAST, Landmark.TURBINES],
  scatter: [
    { kind: PropKind.CACTUS, spacing: 30, odds: 0.08, biomes: ["meadow", "upland"] },
    { kind: PropKind.BOULDER, spacing: 44, odds: 0.1, biomes: ["meadow", "forest", "upland"] },
    { kind: PropKind.SPIRE, spacing: 130, odds: 0.18, biomes: ["upland"] },
  ],
};

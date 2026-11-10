import type { Biome, TreeRule } from "./biomes";
import { Ground, PropKind, type ItemKind } from "./types";

/** Exact shaping powers: integer powers and nested square roots, never a float exponent, so every engine agrees. */
export type Power = 1 | 1.75 | 2 | 3;

/** Adds `height` metres everywhere. */
export interface LiftLayer {
  kind: "lift";
  height: number;
}

/** Adds fbm noise `scale` metres across, raised to `power`, times `amp` metres. `seed` offsets the world seed. */
export interface FbmLayer {
  kind: "fbm";
  scale: number;
  seed: number;
  octaves: number;
  power: Power;
  amp: number;
}

/** Adds ridged fbm (crests where the noise crosses its middle), `scale` metres along x and `scale / stretch` along z. */
export interface RidgedLayer {
  kind: "ridged";
  scale: number;
  stretch: number;
  seed: number;
  octaves: number;
  power: Power;
  amp: number;
}

/** Adds one seeded mountain `height` metres tall, `radius` wide, its top within `reach` of the centre. */
export interface PeakLayer {
  kind: "peak";
  height: number;
  radius: number;
  reach: number;
}

/** Cuts land above `base` into terraces `step` high, with risers `riser` of a step wide. */
export interface TerraceLayer {
  kind: "terrace";
  base: number;
  step: number;
  riser: number;
}

/** Fades the land to `edge` metres past `radius` from the centre; the shore wobbles `wobble` of the radius over `scale` metre noise. */
export interface MaskLayer {
  kind: "mask";
  radius: number;
  edge: number;
  scale: number;
  seed: number;
  wobble: number;
}

/** A point layer: a pure function of position, seed and the height so far, so any tile can rebuild it alone. */
export type TerrainLayer = LiftLayer | FbmLayer | RidgedLayer | PeakLayer | TerraceLayer | MaskLayer;

/** Point layers folded in order over a height starting at 0. */
export type TerrainRecipe = readonly TerrainLayer[];

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

/** Where each biome sits: coast under a wobbling shore height, then inland bands cut from the biome score field. */
export interface ZoneRecipe {
  /** Land under `top` metres, wobbled `wobble` metres over `scale` metre noise, is coast. */
  coast: { top: number; wobble: number; scale: number };
  /** Inland biomes from low score to high, each given an equal share of the land. */
  bands: readonly Biome[];
}

/** Heights and slopes (the up component of the ground normal) where the ground gives way to sand, rock and snow. */
export interface GroundLimits {
  /** Sand under this height, whatever the biome. */
  beach: number;
  /** Ground half-way to rock below `up` or above `height`. */
  scree: { up: number; height: number };
  rock: { up: number; height: number };
  snow_line: number;
  /** Trees grow between these heights. */
  tree_floor: number;
  tree_line: number;
}

export interface BiomeRecipe {
  zones: ZoneRecipe;
  limits: GroundLimits;
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

const LIFT: LiftLayer = { kind: "lift", height: 5 };

function hills(amp: number): FbmLayer {
  return { kind: "fbm", scale: 520, seed: 7, octaves: 5, power: 1.75, amp };
}

function ridges(amp: number): RidgedLayer {
  return { kind: "ridged", scale: 300, stretch: 1, seed: 11, octaves: 5, power: 3, amp };
}

function shore(radius: number, edge: number): MaskLayer {
  return { kind: "mask", radius, edge, scale: 380, seed: 3, wobble: 0.3 };
}

const ZONES: ZoneRecipe = { coast: { top: 6, wobble: 5, scale: 90 }, bands: ["meadow", "forest", "upland"] };
const LIMITS: GroundLimits = { beach: 2.2, scree: { up: 0.8, height: 120 }, rock: { up: 0.7, height: 135 }, snow_line: 165, tree_floor: 3, tree_line: 125 };

export const ISLAND: Recipe = {
  terrain: [LIFT, hills(95), ridges(22), { kind: "peak", height: 150, radius: 430, reach: 220 }, shore(960, -9)],
  biomes: {
    zones: ZONES,
    limits: LIMITS,
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
  terrain: [
    LIFT,
    hills(62),
    ridges(10),
    { kind: "peak", height: 40, radius: 380, reach: 260 },
    { kind: "terrace", base: 28, step: 16, riser: 0.3 },
    // Past the mask the land rises to a dune wall instead of falling to a sea floor.
    shore(960, 42),
    { kind: "ridged", scale: 260, stretch: 3, seed: 17, octaves: 3, power: 2, amp: 6 },
  ],
  biomes: {
    zones: ZONES,
    limits: LIMITS,
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

/** The island's ground at three times the span: one wide landmass in the sea, its towns joined by a road network. */
export const MAINLAND: Recipe = {
  ...ISLAND,
  terrain: [LIFT, hills(110), ridges(26), { kind: "peak", height: 240, radius: 1100, reach: 1400 }, shore(2900, -9)],
  towns: { min: 10, max: 16, trees: true, block: { min: 45, span: 25 } },
};

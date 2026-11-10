import type { Biome, TreeRule } from "./biomes";
import { Ground, PropKind, SurfaceId, type ItemKind } from "./types";

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

/** One wavelength of dunes: crests `wave` metres apart, `height` tall, the steep lee face taking `lee` of each wave. */
export interface DuneBand {
  wave: number;
  height: number;
  lee: number;
}

/** Dune crests across a seeded wind, one of 16 headings: gentle windward slopes, steep lee faces, broken into fields by noise. */
export interface DunesLayer {
  kind: "dunes";
  seed: number;
  bands: readonly DuneBand[];
}

/**
 * Fills the lowest `share` of the map flat, eased over `blend` metres: pans in the low ground between the dunes. The level
 * is that share's height on a coarse sample of the layers before it, so every seed gets about the same pan area.
 */
export interface PanLayer {
  kind: "pan";
  share: number;
  blend: number;
}

/** A point layer: a pure function of position, seed and the height so far, so any tile can rebuild it alone. */
export type TerrainLayer = LiftLayer | FbmLayer | RidgedLayer | PeakLayer | TerraceLayer | MaskLayer | DunesLayer | PanLayer;

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
  /** Only this close to a road, metres; Infinity strews them anywhere. */
  road_within: number;
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
  /** The ground row a pan layer's floor lays, whatever the biome. */
  pan: Ground | null;
}

export interface BiomeRecipe {
  /** Ground rows that lay a surface of their own under the wheels. */
  surfaces: Partial<Record<Ground, SurfaceId>>;
  zones: ZoneRecipe;
  limits: GroundLimits;
  rules: Record<Biome, TreeRule>;
  items: Record<Biome, ItemKind | null>;
  ground: Record<Biome, GroundRule>;
}

export interface RoadRecipe {
  /** Ring control radius: base plus noise times swing, clamped to min..max. */
  loop: { radius: number; swing: number; min: number; max: number };
  /** Every this-many ring controls is a corner and the road runs straight between them; null keeps the round ring. */
  straights: number | null;
  /** Hairpin counts the summit stack tries, most first. */
  stacks: readonly number[];
  /** With no stack built, the ring bends a tongue toward the summit; false keeps the ring as it is. */
  tongue: boolean;
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
  /** Every building gets a flat roof: adobe outposts. */
  flat_roofs: boolean;
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

const HARDPACK: BiomeRecipe["surfaces"] = { [Ground.DIRT]: SurfaceId.DIRT };
const ZONES: ZoneRecipe = { coast: { top: 6, wobble: 5, scale: 90 }, bands: ["meadow", "forest", "upland"] };
const LIMITS: GroundLimits = { beach: 2.2, scree: { up: 0.8, height: 120 }, rock: { up: 0.7, height: 135 }, snow_line: 165, tree_floor: 3, tree_line: 125, pan: null };

export const ISLAND: Recipe = {
  terrain: [LIFT, hills(95), ridges(22), { kind: "peak", height: 150, radius: 430, reach: 220 }, shore(960, -9)],
  biomes: {
    surfaces: HARDPACK,
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
  road: { loop: { radius: 620, swing: 640, min: 380, max: 860 }, straights: null, stacks: [4, 2], tongue: true, canyon: { outlet: 2 }, kickers: { road: 4, total: 12, big: 3 } },
  towns: { min: 3, max: 6, trees: true, block: { min: 45, span: 25 }, flat_roofs: false },
  landmarks: [Landmark.MAST, Landmark.LIGHTHOUSE, Landmark.TURBINES, Landmark.ARCH],
  scatter: [],
};

const BARE = { start: 1, fill: 0, pine: 0, scrub: 0, extra: 0 };
/** Dither width of the dune sea's patch edges, so the two sand tones fray into each other instead of a hard camouflage line. */
const SOFT = 0.3;
/** Share of the map the pans fill and their ease; the floor is the pale PAN row, laid as hardpack. */
const PAN: PanLayer = { kind: "pan", share: 0.2, blend: 3 };

/** Wind-aligned dune crests to the horizon, pale hardpack pans between them, a few adobe outposts inside a dune wall. */
export const DESERT: Recipe = {
  terrain: [
    LIFT,
    { kind: "fbm", scale: 700, seed: 7, octaves: 4, power: 2, amp: 44 },
    // Past the mask the land rises to a dune wall instead of falling to a sea floor.
    shore(960, 42),
    {
      kind: "dunes",
      seed: 17,
      bands: [
        { wave: 280, height: 16, lee: 0.18 },
        { wave: 70, height: 3, lee: 0.2 },
      ],
    },
    PAN,
  ],
  biomes: {
    surfaces: { [Ground.PAN]: SurfaceId.HARDPACK },
    zones: ZONES,
    limits: { ...LIMITS, pan: Ground.PAN },
    rules: { coast: BARE, meadow: BARE, forest: BARE, upland: BARE },
    items: { coast: "rock", meadow: "rock", forest: null, upland: "rock" },
    ground: {
      coast: { cut: 0.55, above: Ground.DUNE, below: Ground.DUNE, soft: 0 },
      meadow: { cut: 0.55, above: Ground.UPLAND, below: Ground.DUNE, soft: SOFT },
      forest: { cut: 0.6, above: Ground.DUNE, below: Ground.UPLAND, soft: SOFT },
      upland: { cut: 0.5, above: Ground.UPLAND, below: Ground.DUNE, soft: SOFT },
    },
  },
  road: { loop: { radius: 650, swing: 500, min: 420, max: 850 }, straights: 4, stacks: [], tongue: false, canyon: { outlet: 24 }, kickers: { road: 4, total: 16, big: 4 } },
  towns: { min: 1, max: 3, trees: false, block: { min: 35, span: 15 }, flat_roofs: true },
  landmarks: [Landmark.MAST, Landmark.TURBINES],
  scatter: [
    { kind: PropKind.CACTUS, spacing: 46, odds: 0.05, biomes: ["meadow", "upland"], road_within: Infinity },
    { kind: PropKind.BOULDER, spacing: 70, odds: 0.06, biomes: ["meadow", "forest", "upland"], road_within: Infinity },
    { kind: PropKind.WIND_PUMP, spacing: 120, odds: 0.15, biomes: ["coast", "meadow", "forest", "upland"], road_within: 40 },
  ],
};

/** The island's ground at three times the span: one wide landmass in the sea, its towns joined by a road network. */
export const MAINLAND: Recipe = {
  ...ISLAND,
  terrain: [LIFT, hills(110), ridges(26), { kind: "peak", height: 240, radius: 1100, reach: 1400 }, shore(2900, -9)],
  towns: { min: 10, max: 16, trees: true, block: { min: 45, span: 25 }, flat_roofs: false },
};

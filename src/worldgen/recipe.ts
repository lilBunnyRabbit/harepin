import type { Biome, TreeRule } from "./biomes";
import type { ItemKind } from "./types";

export interface TerrainRecipe {
  /** Distance from the centre where the land falls into the sea, metres. */
  mask: number;
  peak: { height: number; radius: number; reach: number };
}

export interface BiomeRecipe {
  rules: Record<Biome, TreeRule>;
  items: Record<Biome, ItemKind | null>;
}

export interface RoadRecipe {
  /** Ring control radius: base plus noise times swing, clamped to min..max. */
  loop: { radius: number; swing: number; min: number; max: number };
  /** Hairpin counts the summit stack tries, most first. */
  stacks: readonly number[];
  canyon: boolean;
  kickers: { road: number; total: number; big: number };
}

export interface TownRecipe {
  min: number;
  max: number;
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
}

export const ISLAND: Recipe = {
  terrain: { mask: 960, peak: { height: 150, radius: 430, reach: 220 } },
  biomes: {
    rules: {
      coast: { start: 0.5, fill: 0.12, pine: 0.2, scrub: 0.6, extra: 0 },
      meadow: { start: 0.52, fill: 0.3, pine: 0.15, scrub: 0.1, extra: 0 },
      forest: { start: 0.45, fill: 1, pine: 0.88, scrub: 0, extra: 1 },
      upland: { start: 0.3, fill: 0.22, pine: 0.05, scrub: 0.75, extra: 0 },
    },
    items: { coast: "log", meadow: "hay", forest: "log", upland: "rock" },
  },
  road: { loop: { radius: 620, swing: 640, min: 380, max: 860 }, stacks: [4, 2], canyon: true, kickers: { road: 4, total: 12, big: 3 } },
  towns: { min: 3, max: 6, block: { min: 45, span: 25 } },
  landmarks: [Landmark.MAST, Landmark.LIGHTHOUSE, Landmark.TURBINES, Landmark.ARCH],
};

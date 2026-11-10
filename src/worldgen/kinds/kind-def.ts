import type { Recipe } from "../recipe";
import type { WorldData, WorldKind } from "../types";

export interface GripTable {
  road: number;
  dirt: number;
  /** The strip just past a road edge. */
  shoulder: number;
  ground: number;
  /** Rolling drag on `ground`, as a multiple of the road's. */
  roll: number;
}

export interface KindSpec {
  kind: WorldKind;
  /** id = base + version; each kind sits in its own thousand so versions never collide. */
  base: number;
  /** key = `${seed}:${tag}${version}`. */
  tag: string;
  /** Bump whenever `generate` makes a different world for the same seed: peers and saved records are matched on it. */
  version: number;
  generate(seed: number): WorldData;
  /** A land kind's tuning, which meshing and the map read too; null for a deck-only kind. */
  recipe: Recipe | null;
  /** Gymkhana, parking and gate hunts need it. */
  open_ground: boolean;
  /** Box solids redirect the car along them instead of bouncing it off. */
  rails: boolean;
  /** Terrain mesh and terrain map raster; false = deck only. */
  ground: boolean;
  /** Falling under the deck resets the car; false = it lands on the ground below. */
  fall_reset: boolean;
  grip: GripTable;
}

/** Worker-safe half of a world kind: no DOM, no THREE, so `generate` runs in worldgen/worker.ts. */
export interface KindDef extends KindSpec {
  /** Map identity peers and the directory compare. */
  id: number;
  /** Storage key part for records set on `seed`'s world. Never changes for an existing kind and version. */
  key(seed: number): string;
}

export function kind_def(spec: KindSpec): KindDef {
  return { ...spec, id: spec.base + spec.version, key: (seed) => `${seed}:${spec.tag}${spec.version}` };
}

/** Trail dirt sits between asphalt and grass: a car's `offroad` share decides how much of the loss it keeps. */
export const LAND_GRIP: GripTable = { road: 1, dirt: 0.88, shoulder: 0.85, ground: 0.72, roll: 12 };

/**
 * Hardpack (`dirt`) runs like the island's trails. Loose sand (`ground`) slides a touch more than grass and drags twice as
 * hard (stock coupe: 0.63 g, 0-50 in 4.4 s against grass's 0.65 g, 4.1 s); off-road tyres still run it near hardpack.
 */
export const SAND_GRIP: GripTable = { road: 1, dirt: 0.9, shoulder: 0.86, ground: 0.74, roll: 24 };

import type { Recipe } from "../recipe";
import { SurfaceId, type WorldData, type WorldKind } from "../types";
import type { OptionDef } from "./options";

export interface Footing {
  grip: number;
  /** Rolling drag, as a multiple of the road's. */
  roll: number;
}

export interface GripTable {
  road: Footing;
  /** The strip just past a road edge, where no laid surface covers the kind's own ground. */
  shoulder: Footing;
  surfaces: Record<SurfaceId, Footing>;
  /** In water at WADE_FULL depth and over; shallower water eases toward the footing under it. */
  wade: Footing;
}

export interface KindSpec {
  kind: WorldKind;
  /** id = base + version; each kind sits in its own thousand so versions never collide. */
  base: number;
  /** key = `${seed}:${tag}${version}`. */
  tag: string;
  /** Bump whenever `generate` makes a different world for the same seed: peers and saved records are matched on it. */
  version: number;
  /** Side of the square world, metres; a whole number of chunk pairs. */
  size: number;
  generate(seed: number, levels: readonly number[]): WorldData;
  /** Map options, in map code order; each one's normal level builds the kind as it was before options. */
  options: readonly OptionDef[];
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
  key(seed: number, opts?: string): string;
}

export function kind_def(spec: KindSpec): KindDef {
  // The option code joins the key only off the defaults, so records saved before options keep theirs.
  return { ...spec, id: spec.base + spec.version, key: (seed, opts = "") => `${seed}:${spec.tag}${spec.version}${opts ? `:${opts}` : ""}` };
}

/** Loose rock over the scree height: firmer than grass, short of trail dirt, and it drags a little. */
const SCREE: Footing = { grip: 0.8, roll: 4 };

/** Mud at the water's edge: soft enough to feel, firm enough to drive out of. */
const WET: Footing = { grip: 0.78, roll: 3 };
/** Water to the sills: grip goes and drag climbs with speed, so a ford is a choice, not a shortcut. */
const WADE: Footing = { grip: 0.45, roll: 40 };

/** Trail dirt sits between asphalt and grass: a car's `offroad` share decides how much of the loss it keeps. */
export const LAND_GRIP: GripTable = {
  road: { grip: 1, roll: 1 },
  shoulder: { grip: 0.85, roll: 1 },
  surfaces: { [SurfaceId.GRASS]: { grip: 0.72, roll: 12 }, [SurfaceId.DIRT]: { grip: 0.88, roll: 1 }, [SurfaceId.HARDPACK]: { grip: 0.88, roll: 1 }, [SurfaceId.SCREE]: SCREE, [SurfaceId.WET]: WET },
  wade: WADE,
};

/**
 * Dune sea: loose sand (GRASS, its own ground) slides and drags hard, so the pans' hardpack and the roads are where speed lives;
 * trail dirt sits just under the pans.
 */
export const SAND_GRIP: GripTable = {
  road: { grip: 1, roll: 1 },
  shoulder: { grip: 0.86, roll: 1 },
  surfaces: { [SurfaceId.GRASS]: { grip: 0.7, roll: 28 }, [SurfaceId.DIRT]: { grip: 0.9, roll: 1 }, [SurfaceId.HARDPACK]: { grip: 0.92, roll: 1 }, [SurfaceId.SCREE]: SCREE, [SurfaceId.WET]: WET },
  wade: WADE,
};

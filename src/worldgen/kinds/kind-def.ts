import type { Recipe } from "../recipe";
import { SurfaceId, type WorldData, type WorldKind } from "../types";
import type { OptionDef } from "./options";

export interface Footing {
  grip: number;
  /** Rolling drag, as a multiple of the road's. */
  roll: number;
  /** How loose the ground is, 0 sealed road .. 1 sand: the tyre curve on it peaks at wider slip and falls slower past the peak. */
  loose: number;
  /** Dirt or gravel, where a tyre's `grip_dirt` applies; elsewhere off asphalt its `grip_grass` does. */
  firm: boolean;
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
  /** `relief` scales the relief layers down when a custom map's first build failed its drivability check. */
  generate(seed: number, levels: readonly number[], relief?: number): WorldData;
  /** Levels brought inside the coupled limits the generator holds; absent = every combination builds. */
  clamp?(levels: readonly number[]): number[];
  /** Whether a custom map's build is one to drive; absent = always. */
  drivable?(data: WorldData, levels: readonly number[]): boolean;
  /** Map options, in map code order; each one's normal level builds the kind as it was before options. */
  options: readonly OptionDef[];
  /** A land kind's tuning, which meshing and the map read too; null for a deck-only kind. */
  recipe: Recipe | null;
  /** The recipe a set of levels builds from; absent = `recipe` whatever the levels. */
  tuned?(levels: readonly number[]): Recipe;
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
const SCREE: Footing = { grip: 0.8, roll: 4, loose: 0.9, firm: true };

/** Mud at the water's edge: soft enough to feel, firm enough to drive out of. */
const WET: Footing = { grip: 0.78, roll: 3, loose: 0.8, firm: false };
/** Water to the sills: grip goes and drag climbs with speed, so a ford is a choice, not a shortcut. */
const WADE: Footing = { grip: 0.45, roll: 40, loose: 1, firm: false };

/** Deep snow: little grip, and it drags at the wheels like grass. */
const SNOW: Footing = { grip: 0.55, roll: 8, loose: 0.8, firm: false };
/** Snow packed by traffic, on winter roads and trails: as grippy and as firm as loose gravel. */
const PACKED_SNOW: Footing = { grip: 0.8, roll: 1, loose: 0.5, firm: true };
/** Frozen lakes: the least grip anywhere, with nothing loose to dig into. */
const ICE: Footing = { grip: 0.35, roll: 1, loose: 0.2, firm: false };
/** Wet snow on the beach: a step over deep snow's grip, and it drags harder. */
const SLUSH: Footing = { grip: 0.6, roll: 10, loose: 0.9, firm: false };
/** The snow kit's rows: in every table, so a surface reads the same whatever kind lays it. */
const SNOW_ROWS = { [SurfaceId.SNOW]: SNOW, [SurfaceId.PACKED_SNOW]: PACKED_SNOW, [SurfaceId.ICE]: ICE, [SurfaceId.SLUSH]: SLUSH };
/** Lava resets the car the moment it touches, so this row only reads for the frame before. */
const LAVA: Footing = { grip: 0.45, roll: 40, loose: 1, firm: false };

/** Trail dirt sits between asphalt and grass: a car's `offroad` share decides how much of the loss it keeps. */
export const LAND_GRIP: GripTable = {
  road: { grip: 1, roll: 1, loose: 0, firm: false },
  shoulder: { grip: 0.85, roll: 1, loose: 0.3, firm: false },
  surfaces: { [SurfaceId.GRASS]: { grip: 0.72, roll: 12, loose: 0.7, firm: false }, [SurfaceId.DIRT]: { grip: 0.82, roll: 1, loose: 0.8, firm: true }, [SurfaceId.HARDPACK]: { grip: 0.86, roll: 1, loose: 0.5, firm: true }, [SurfaceId.SCREE]: SCREE, [SurfaceId.WET]: WET, [SurfaceId.LAVA]: LAVA, ...SNOW_ROWS },
  wade: WADE,
};

/**
 * Dune sea: loose sand (GRASS, its own ground) slides and drags hard, so the pans' hardpack and the roads are where speed lives;
 * trail dirt sits just under the pans.
 */
export const SAND_GRIP: GripTable = {
  road: { grip: 1, roll: 1, loose: 0, firm: false },
  shoulder: { grip: 0.86, roll: 1, loose: 0.4, firm: false },
  surfaces: { [SurfaceId.GRASS]: { grip: 0.7, roll: 28, loose: 1, firm: false }, [SurfaceId.DIRT]: { grip: 0.84, roll: 1, loose: 0.8, firm: true }, [SurfaceId.HARDPACK]: { grip: 0.92, roll: 1, loose: 0.5, firm: true }, [SurfaceId.SCREE]: SCREE, [SurfaceId.WET]: WET, [SurfaceId.LAVA]: LAVA, ...SNOW_ROWS },
  wade: WADE,
};

/** Winter: the snow kit lays its own surfaces over everything else, and roads drive as packed snow. */
export const WINTER_GRIP: GripTable = {
  road: PACKED_SNOW,
  shoulder: PACKED_SNOW,
  surfaces: { [SurfaceId.GRASS]: SNOW, [SurfaceId.DIRT]: PACKED_SNOW, [SurfaceId.HARDPACK]: PACKED_SNOW, [SurfaceId.SCREE]: SNOW, [SurfaceId.WET]: SLUSH, [SurfaceId.LAVA]: LAVA, ...SNOW_ROWS },
  wade: WADE,
};

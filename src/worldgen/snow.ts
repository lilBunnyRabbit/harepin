import { WINTER_GRIP, type GripTable } from "./kinds/kind-def";
import { smoothstep } from "./noise";
import { ROAD_HALF, SurfaceId } from "./types";

/** Snow the plough piles past a road's side: `height` metres at `crest`, rising from `from` and gone by `to`, all read on `road_dist`. */
export interface Snowbank {
  height: number;
  from: number;
  crest: number;
  to: number;
}

export interface SnowKit {
  cover: Record<SurfaceId, SurfaceId>;
  /** What open ground under the recipe's beach height turns to instead. */
  shore: SurfaceId;
  bank: Snowbank;
  grip: GripTable;
}

export const SNOW_KIT: SnowKit = {
  cover: {
    [SurfaceId.GRASS]: SurfaceId.SNOW,
    [SurfaceId.DIRT]: SurfaceId.PACKED_SNOW,
    [SurfaceId.HARDPACK]: SurfaceId.PACKED_SNOW,
    [SurfaceId.SCREE]: SurfaceId.SNOW,
    [SurfaceId.WET]: SurfaceId.SLUSH,
    [SurfaceId.SNOW]: SurfaceId.SNOW,
    [SurfaceId.PACKED_SNOW]: SurfaceId.PACKED_SNOW,
    [SurfaceId.ICE]: SurfaceId.ICE,
    [SurfaceId.SLUSH]: SurfaceId.SLUSH,
  },
  shore: SurfaceId.SLUSH,
  // Clear of the checkpoint posts at the asphalt's edge, and gone where trees may stand.
  bank: { height: 0.8, from: ROAD_HALF + 2.5, crest: ROAD_HALF + 4.5, to: ROAD_HALF + 7 },
  grip: WINTER_GRIP,
};

function bank_rise(bank: Snowbank, d: number): number {
  if (d <= bank.from || d >= bank.to) return 0;
  return bank.height * (d < bank.crest ? smoothstep(bank.from, bank.crest, d) : 1 - smoothstep(bank.crest, bank.to, d));
}

// No bank on a street, whose plateau is the town's, nor on a laid surface such as a trail's mouth.
export function snow_vertex(kit: SnowKit, beach: number, heights: Float32Array, road_dist: Float32Array, surface: Uint8Array, street: boolean, k: number) {
  const open = surface[k] === SurfaceId.GRASS;
  if (open && !street) heights[k] += bank_rise(kit.bank, road_dist[k]);
  surface[k] = open && heights[k] < beach ? kit.shore : kit.cover[surface[k] as SurfaceId];
}

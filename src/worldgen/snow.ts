import { WINTER_GRIP, type GripTable } from "./kinds/kind-def";
import { SurfaceId } from "./types";

export interface SnowKit {
  cover: Record<SurfaceId, SurfaceId>;
  /** What open ground under the recipe's beach height turns to instead. */
  shore: SurfaceId;
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
  grip: WINTER_GRIP,
};

export function snow_vertex(kit: SnowKit, beach: number, heights: Float32Array, surface: Uint8Array, k: number) {
  const open = surface[k] === SurfaceId.GRASS;
  surface[k] = open && heights[k] < beach ? kit.shore : kit.cover[surface[k] as SurfaceId];
}

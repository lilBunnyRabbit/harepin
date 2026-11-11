import { SurfaceId } from "./types";

/** A crater's lava: everything under `level` within `radius` of the centre is lava. */
export interface LavaPool {
  x: number;
  z: number;
  radius: number;
  level: number;
}

export function in_lava(pools: readonly LavaPool[], x: number, z: number, y: number): boolean {
  return pools.some((p) => y < p.level && (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < p.radius * p.radius);
}

export function lava_vertex(pools: readonly LavaPool[], heights: Float32Array, surface: Uint8Array, k: number, x: number, z: number) {
  if (in_lava(pools, x, z, heights[k])) surface[k] = SurfaceId.LAVA;
}

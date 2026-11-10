import type { ChunkBuffers } from "../../src/worldgen/chunks";
import { map_data } from "../../src/worldgen/map";
import type { Route, WorldData } from "../../src/worldgen/types";
import { MAP_TONES } from "./tones";

export type Digest = [string, string][];

const hex = (h: number | bigint) => h.toString(16).padStart(16, "0");

// Typed arrays hash by their bytes, so a float change in the last bit still shows; everything else by its JSON.
function hash(value: unknown): string {
  return hex(Bun.hash(JSON.stringify(value, (_key, v: unknown) => (ArrayBuffer.isView(v) ? hex(Bun.hash(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))) : v))));
}

export function route_digest(route: Route): string {
  return hash(route);
}

/** Every part of the generated data, split so a diff names what moved. `timings` is wall time, not output. */
export function world_digest(data: WorldData, chunks: ChunkBuffers[]): Digest {
  const parts: Digest = [];
  const { heights, road_dist, surface, ...terrain } = data.terrain;
  parts.push(["heights", hash(heights)], ["road_dist", hash(road_dist)], ["surface", hash(surface)], ["terrain", hash(terrain)]);
  for (const [key, value] of Object.entries(data)) {
    if (key === "terrain" || key === "timings" || key === "routes") continue;
    parts.push([key, hash(value)]);
  }
  for (const route of data.routes) parts.push([`route:${route.id}`, route_digest(route)]);
  parts.push(["mesh_road", hash(chunks.map((c) => c.road))]);
  parts.push(["mesh_rest", hash(chunks.map(({ road: _, ...rest }) => rest))]);
  const { pixels, ...map } = map_data(data, MAP_TONES);
  parts.push(["map_pixels", hash(pixels)], ["map", hash(map)]);
  return parts;
}

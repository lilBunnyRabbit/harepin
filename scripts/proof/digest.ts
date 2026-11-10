import type { Extent } from "../../src/worldgen/chunk-grid";
import type { ChunkBuffers } from "../../src/worldgen/chunks";
import { map_data } from "../../src/worldgen/map";
import { TileMesher } from "../../src/worldgen/tile-mesher";
import type { Route, WorldData } from "../../src/worldgen/types";
import { MAP_TONES, MESH_TONES } from "./tones";

export type Digest = [string, string][];

const hex = (h: number | bigint) => h.toString(16).padStart(16, "0");

// Typed arrays hash by their bytes, so a float change in the last bit still shows; everything else by its JSON.
function hash(value: unknown): string {
  return hex(Bun.hash(JSON.stringify(value, (_key, v: unknown) => (ArrayBuffer.isView(v) ? hex(Bun.hash(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))) : v))));
}

export function route_digest(route: Route): string {
  return hash(route);
}

/** Every part of the generated data, split so a diff names what moved. `timings` is wall time and `ground` the recipe for the grids already hashed, not output. */
export function world_digest(data: WorldData, chunks: ChunkBuffers[]): Digest {
  const parts: Digest = [];
  const { heights, road_dist, surface, ...terrain } = data.terrain;
  parts.push(["heights", hash(heights)], ["road_dist", hash(road_dist)], ["surface", hash(surface)], ["terrain", hash(terrain)]);
  for (const [key, value] of Object.entries(data)) {
    if (key === "terrain" || key === "ground" || key === "timings" || key === "routes") continue;
    parts.push([key, hash(value)]);
  }
  for (const route of data.routes) parts.push([`route:${route.id}`, route_digest(route)]);
  parts.push(["mesh_road", hash(chunks.map((c) => c.road))]);
  parts.push(["mesh_rest", hash(chunks.map(({ road: _, ...rest }) => rest))]);
  return [...parts, ...map_digest(data)];
}

function map_digest(data: WorldData): Digest {
  const { pixels, ...map } = map_data(data, MAP_TONES);
  return [["map_pixels", hash(pixels)], ["map", hash(map)]];
}

/** A streamed world holds no grids: every chunk is built alone from its plan and hashed as it comes, so only one is held. */
export function streamed_digest(data: WorldData, ext: Extent): Digest {
  const parts: Digest = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "ground" || key === "timings" || key === "routes") continue;
    parts.push([key, hash(value)]);
  }
  for (const route of data.routes) parts.push([`route:${route.id}`, route_digest(route)]);
  const mesher = new TileMesher(data, ext, MESH_TONES);
  const tiles: string[] = [];
  const roads: string[] = [];
  const rest: string[] = [];
  const planted: string[] = [];
  for (let index = 0; index < ext.side * ext.side; index++) {
    const built = mesher.build(index);
    const { road, ...others } = built.chunk;
    tiles.push(hash(built.tile));
    roads.push(hash(road));
    rest.push(hash(others));
    planted.push(hash(built.planted));
  }
  parts.push(["tiles", hash(tiles)], ["mesh_road", hash(roads)], ["mesh_rest", hash(rest)], ["planted", hash(planted)]);
  return [...parts, ...map_digest(data)];
}

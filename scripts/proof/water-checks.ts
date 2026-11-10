import { World, DEEP_WATER } from "../../src/world/world";
import { chunk_of, extent } from "../../src/worldgen/chunk-grid";
import { build_tile } from "../../src/worldgen/ground";
import { KINDS } from "../../src/worldgen/kinds/kinds";
import type { WorldData } from "../../src/worldgen/types";
import { FORD_DEPTH } from "../../src/worldgen/water";

/** Water over a road past a ford's own depth, with float slack. */
const ROAD_WATER = FORD_DEPTH + 0.05;

/** Roads never run into water deeper than a ford, and the start line is dry. Builds only the tiles the roads touch. */
export function check_water(data: WorldData, fail: (what: string) => void) {
  const ext = extent(KINDS[data.kind].size);
  const world = new World(data.terrain.seed, data, []);
  const streamed = !data.terrain.heights.length;
  const depth = (x: number, z: number) => {
    const index = chunk_of(x, z, ext);
    if (streamed && !world.tiles.get(index)) world.tiles.add(index, build_tile(data.ground, index, ext));
    return world.depth(x, z);
  };
  if (!streamed) return;
  for (const edge of data.graph.edges) {
    let worst = -Infinity;
    let at = edge.points[0];
    for (const p of edge.points) {
      const d = depth(p.x, p.z);
      if (d > worst) {
        worst = d;
        at = p;
      }
    }
    if (worst > ROAD_WATER) fail(`edge ${edge.id} runs ${worst.toFixed(2)} m under water at ${at.x.toFixed(0)},${at.z.toFixed(0)}${worst > DEEP_WATER ? " (deep)" : ""}`);
  }
  const start = data.road[0];
  if (start && depth(start.x, start.z) > 0) fail(`start line in water at ${start.x.toFixed(0)},${start.z.toFixed(0)}`);
}

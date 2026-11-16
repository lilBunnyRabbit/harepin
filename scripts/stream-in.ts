import type { World } from "../src/world/world";
import { chunk_of } from "../src/worldgen/chunk-grid";
import { build_tile } from "../src/worldgen/ground";
import type { GroundPlan } from "../src/worldgen/stamp";

// A streamed world holds no tiles until they are built: the chunks round the route come in before it is driven.
export function stream_in(world: World, ground: GroundPlan, line: readonly { x: number; z: number }[]) {
  if (!world.tiles.streamed) return;
  const { ext } = world.tiles;
  for (const p of line) {
    const at = chunk_of(p.x, p.z, ext);
    const ci = at % ext.side;
    const cj = Math.floor(at / ext.side);
    for (let j = Math.max(0, cj - 1); j <= Math.min(ext.side - 1, cj + 1); j++)
      for (let i = Math.max(0, ci - 1); i <= Math.min(ext.side - 1, ci + 1); i++) if (!world.tiles.get(j * ext.side + i)) world.tiles.add(j * ext.side + i, build_tile(ground, j * ext.side + i, ext));
  }
}

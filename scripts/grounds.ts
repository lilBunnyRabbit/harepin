import type { Ground } from "../src/car/car";
import { LAND_GRIP, SAND_GRIP, type Footing } from "../src/worldgen/kinds/kind-def";
import { SurfaceId } from "../src/worldgen/types";

/** Flat ground with one grip row everywhere; `dirt` marks a trail, where a tyre's `grip_dirt` applies. */
export function footing_ground({ grip, roll, loose }: Footing, dirt = false): Ground {
  return { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => grip, roll: () => roll, loose: () => loose, dirt: () => dirt };
}

/** The flat grounds the handling scripts drive on with `--ground <name>`, straight from the kinds' grip rows. */
export const GROUNDS = {
  asphalt: footing_ground(LAND_GRIP.road),
  shoulder: footing_ground(LAND_GRIP.shoulder),
  dirt: footing_ground(LAND_GRIP.surfaces[SurfaceId.DIRT], true),
  hardpack: footing_ground(LAND_GRIP.surfaces[SurfaceId.HARDPACK]),
  grass: footing_ground(LAND_GRIP.surfaces[SurfaceId.GRASS]),
  scree: footing_ground(LAND_GRIP.surfaces[SurfaceId.SCREE]),
  sand: footing_ground(SAND_GRIP.surfaces[SurfaceId.GRASS]),
} satisfies Record<string, Ground>;
export type GroundName = keyof typeof GROUNDS;

/** The ground named after `--ground` on the command line, or `fallback`. */
export function ground_arg(fallback: Ground): Ground {
  const at = process.argv.indexOf("--ground");
  if (at < 0) return fallback;
  const name = process.argv[at + 1];
  if (!(name in GROUNDS)) throw new Error(`unknown ground ${name}: ${Object.keys(GROUNDS).join(", ")}`);
  return GROUNDS[name as GroundName];
}

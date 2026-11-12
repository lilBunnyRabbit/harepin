import type { Ground } from "../src/car/car";
import { LAND_GRIP, SAND_GRIP, type Footing } from "../src/worldgen/kinds/kind-def";
import { SurfaceId } from "../src/worldgen/types";

/** Flat ground with one grip row everywhere. */
export function footing_ground({ grip, roll, loose, firm }: Footing): Ground {
  return { height: () => 0, normal: (_x, _z, out) => out.set(0, 1, 0), grip: () => grip, roll: () => roll, loose: () => loose, dirt: () => firm };
}

/** The flat grounds the handling scripts drive on with `--ground <name>`, straight from the kinds' grip rows. */
export const GROUNDS = {
  asphalt: footing_ground(LAND_GRIP.road),
  shoulder: footing_ground(LAND_GRIP.shoulder),
  dirt: footing_ground(LAND_GRIP.surfaces[SurfaceId.DIRT]),
  hardpack: footing_ground(LAND_GRIP.surfaces[SurfaceId.HARDPACK]),
  grass: footing_ground(LAND_GRIP.surfaces[SurfaceId.GRASS]),
  scree: footing_ground(LAND_GRIP.surfaces[SurfaceId.SCREE]),
  wet: footing_ground(LAND_GRIP.surfaces[SurfaceId.WET]),
  sand: footing_ground(SAND_GRIP.surfaces[SurfaceId.GRASS]),
} satisfies Record<string, Ground>;
export type GroundName = keyof typeof GROUNDS;

/** `ground` tilted to climb `grade` along +z. */
export const slope = (grade: number, ground: Ground = GROUNDS.asphalt): Ground => ({
  ...ground,
  height: (_x, z) => z * grade,
  normal: (_x, _z, out) => out.set(0, 1, -grade).normalize(),
});

/** The ground named after `--ground` on the command line, or `fallback`. */
export function ground_arg(fallback: Ground): Ground {
  const at = process.argv.indexOf("--ground");
  if (at < 0) return fallback;
  const name = process.argv[at + 1];
  if (!(name in GROUNDS)) throw new Error(`unknown ground ${name}: ${Object.keys(GROUNDS).join(", ")}`);
  return GROUNDS[name as GroundName];
}

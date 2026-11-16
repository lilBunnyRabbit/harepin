import { generate_sky, type SkyRecipe } from "../sky";
import { SIZE, WALL_RIDE_VERSION, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";
import { VELODROME } from "./velodrome";

const DEG = Math.PI / 180;

// docs/plan/wall-ride.md: the velodrome's bowls plus two pieces. Pipes swing to 35° on a straight, where nothing but the tyres
// holds the car on the slope (tan 35° is well inside every car's grip). The wall holds 60-64° for 40-60 m of one bowl with its
// high rail off: carried over the top, the car falls and resets. At 68-72° held 50-80 m the autopilot's muscle, rally and
// Sajin slid down to the low rail below the wall's neutral speed and crashed there.
const WALL_RIDE: SkyRecipe = {
  ...VELODROME,
  kind: WorldKind.WALL_RIDE,
  length: [2400, 5200],
  pipes: { most: 2, bank: [28 * DEG, 35 * DEG], length: [140, 180] },
  wall: { bank: [60 * DEG, 64 * DEG], hold: [40, 60] },
};

export const wall_ride = kind_def({
  kind: WorldKind.WALL_RIDE,
  base: 12000,
  tag: "wall",
  version: WALL_RIDE_VERSION,
  size: SIZE,
  generate: (seed) => generate_sky(seed, WALL_RIDE, WALL_RIDE),
  options: [],
  recipe: null,
  open_ground: false,
  rails: true,
  ground: false,
  fall_reset: true,
  grip: LAND_GRIP,
});

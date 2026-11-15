import { generate_sky, type SkyRecipe } from "../sky";
import { SIZE, WALL_RIDE_VERSION, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";
import { VELODROME } from "./velodrome";

const DEG = Math.PI / 180;

// docs/plan/wall-ride.md: the velodrome's bowls plus two pieces. Pipes swing to 35° on a straight, where nothing but the tyres
// holds the car on the slope (tan 35° is well inside every car's grip). The wall holds 68-72° for most of one bowl, under the
// 75° past which a soft car falls through the deck, with its high rail off: carried over the top, the car falls and resets.
const WALL_RIDE: SkyRecipe = {
  ...VELODROME,
  kind: WorldKind.WALL_RIDE,
  length: [2400, 5200],
  pipes: { most: 2, bank: [28 * DEG, 35 * DEG], length: [160, 220] },
  wall: { bank: [68 * DEG, 72 * DEG], hold: [50, 80] },
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

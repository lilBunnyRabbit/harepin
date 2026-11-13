import { generate_sky, SKY, type SkyRecipe } from "../sky";
import { SIZE, VELODROME_VERSION, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

const DEG = Math.PI / 180;

// docs/plan/wall-ride.md: 45-55° on the racing line, a 60-70° kick at each bowl's middle, under the 75° past which a soft car
// can fall through the deck. The bus scrapes from 40° and is out; the Raijin scrapes its floor in a bowl but holds its line.
const VELODROME: SkyRecipe = {
  ...SKY,
  kind: WorldKind.VELODROME,
  odds: { eight: 1, helix: 0, hairpin: 0.35 },
  gaps: 1,
  pads: 2,
  open: [0.1, 0.2],
  length: [2400, 4400],
  bowls: { angle: [Math.PI, 1.2 * Math.PI], radius: [40, 60], bank: [45 * DEG, 55 * DEG], kick: [60 * DEG, 70 * DEG] },
  excludes: ["bus"],
};

export const velodrome = kind_def({
  kind: WorldKind.VELODROME,
  base: 10000,
  tag: "velo",
  version: VELODROME_VERSION,
  size: SIZE,
  generate: (seed) => generate_sky(seed, VELODROME, VELODROME),
  options: [],
  recipe: null,
  open_ground: false,
  rails: true,
  ground: false,
  fall_reset: true,
  grip: LAND_GRIP,
});

import { generate_sky, type SkyRecipe } from "../sky";
import { SIZE, VELODROME_VERSION, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";
import { knob, tune, type Knob } from "./options";
import { gaps_knob, length_knob, pads_knob } from "./sky-knobs";
import { PIPES, WALL, WALLED as VELODROME } from "./sky";

const VELODROME_KNOBS: readonly Knob<SkyRecipe>[] = [
  length_knob(VELODROME, [2400, 4400], [3800, 6400]),
  gaps_knob(VELODROME, 2),
  pads_knob(VELODROME, 5),
  knob<SkyRecipe, SkyRecipe["pipes"]>({ field: "P", name: "Half-pipes", help: "Straights that swing up one side, then the other.", labels: ["None", "Normal", "More"], normal: 1, values: [null, PIPES, { ...PIPES, most: 4 }], set: (r, pipes) => ({ ...r, pipes }) }),
  knob<SkyRecipe, SkyRecipe["wall"]>({ field: "R", name: "Wall ride", help: "One bowl held steep with its high rail off.", labels: ["Off", "On"], switch: true, normal: 1, values: [null, WALL], set: (r, wall) => ({ ...r, wall }) }),
];

export const velodrome = kind_def({
  kind: WorldKind.VELODROME,
  base: 10000,
  tag: "velo",
  version: VELODROME_VERSION,
  size: SIZE,
  generate: (seed, levels) => generate_sky(seed, tune(VELODROME, VELODROME_KNOBS, levels), VELODROME),
  options: VELODROME_KNOBS,
  recipe: null,
  open_ground: false,
  rails: true,
  ground: false,
  fall_reset: true,
  grip: LAND_GRIP,
});

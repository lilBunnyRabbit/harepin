import { generate_sky, SKY, type SkyRecipe } from "../sky";
import { ROOFTOPS_VERSION, SIZE, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

// Parapets all round: off an open edge the car would drop through the roof margin it looks to stand on.
const ROOFTOPS: SkyRecipe = { ...SKY, kind: WorldKind.ROOFTOPS, profile: "terraced", roofs: true, open: [0, 0], length: [2400, 4400] };

export const rooftops = kind_def({
  kind: WorldKind.ROOFTOPS,
  base: 8000,
  tag: "roof",
  version: ROOFTOPS_VERSION,
  size: SIZE,
  generate: (seed) => generate_sky(seed, ROOFTOPS, ROOFTOPS),
  options: [],
  recipe: null,
  open_ground: false,
  rails: true,
  ground: false,
  fall_reset: true,
  grip: LAND_GRIP,
});

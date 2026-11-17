import { generate_raceway } from "../raceway";
import { SIZE, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

export const RACEWAY_VERSION = 1;

export const raceway = kind_def({
  kind: WorldKind.RACEWAY,
  base: 13000,
  tag: "rw",
  version: RACEWAY_VERSION,
  size: SIZE,
  generate: (seed) => generate_raceway(seed),
  options: [],
  recipe: null,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: LAND_GRIP,
});

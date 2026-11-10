import { generate_sky } from "../sky";
import { SKY_VERSION, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

/** Base 1000 keeps it off the island's ids, so old builds see a sky peer as on a foreign map. */
export const sky = kind_def({
  kind: WorldKind.SKY,
  base: 1000,
  tag: "sky",
  version: SKY_VERSION,
  generate: generate_sky,
  recipe: null,
  open_ground: false,
  rails: true,
  ground: false,
  fall_reset: true,
  grip: LAND_GRIP,
});

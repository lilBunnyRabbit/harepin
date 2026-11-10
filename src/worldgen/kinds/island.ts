import { generate } from "../index";
import { WORLD_VERSION, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

export const island = kind_def({
  kind: WorldKind.ISLAND,
  base: 0,
  tag: "w",
  version: WORLD_VERSION,
  generate,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: LAND_GRIP,
});

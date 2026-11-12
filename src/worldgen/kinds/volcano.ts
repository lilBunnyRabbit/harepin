import { VOLCANO } from "../recipe";
import { land_kind } from "./land-kind";
import { SIZE, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

/** Base 6000, its own thousand after the tundra's. */
export const volcano = kind_def({
  kind: WorldKind.VOLCANO,
  base: 6000,
  tag: "v",
  version: 2,
  size: SIZE,
  ...land_kind(VOLCANO, [], WorldKind.VOLCANO),
  options: [],
  recipe: VOLCANO,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: LAND_GRIP,
});

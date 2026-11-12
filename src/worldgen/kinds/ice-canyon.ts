import { ICE_CANYON } from "../recipe";
import { land_kind } from "./land-kind";
import { SIZE, WorldKind } from "../types";
import { kind_def, WINTER_GRIP } from "./kind-def";

/** Base 7000, its own thousand after the volcano's. */
export const ice_canyon = kind_def({
  kind: WorldKind.ICE_CANYON,
  base: 7000,
  tag: "ic",
  version: 1,
  size: SIZE,
  ...land_kind(ICE_CANYON, [], WorldKind.ICE_CANYON),
  options: [],
  recipe: ICE_CANYON,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: WINTER_GRIP,
});

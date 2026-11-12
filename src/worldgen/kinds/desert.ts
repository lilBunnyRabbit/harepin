import { DESERT } from "../recipe";
import { DESERT_KNOBS } from "./land-knobs";
import { land_kind } from "./land-kind";
import { SIZE, WorldKind } from "../types";
import { kind_def, SAND_GRIP } from "./kind-def";

/** Base 2000, its own thousand after the sky's. */
export const desert = kind_def({
  kind: WorldKind.DESERT,
  base: 2000,
  tag: "d",
  version: 3,
  size: SIZE,
  ...land_kind(DESERT, DESERT_KNOBS, WorldKind.DESERT),
  options: DESERT_KNOBS,
  recipe: DESERT,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: SAND_GRIP,
});

import { TUNDRA } from "../recipe";
import { TUNDRA_KNOBS } from "./land-knobs";
import { land_kind } from "./land-kind";
import { SIZE, WorldKind } from "../types";
import { kind_def, WINTER_GRIP } from "./kind-def";

/** Base 5000, its own thousand after the alpine's. */
export const tundra = kind_def({
  kind: WorldKind.TUNDRA,
  base: 5000,
  tag: "t",
  version: 1,
  size: SIZE,
  ...land_kind(TUNDRA, TUNDRA_KNOBS, WorldKind.TUNDRA),
  options: TUNDRA_KNOBS,
  recipe: TUNDRA,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: WINTER_GRIP,
});

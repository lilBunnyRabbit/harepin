import { ALPINE } from "../recipe";
import { ALPINE_KNOBS } from "./land-knobs";
import { land_kind } from "./land-kind";
import { SIZE, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

/** Base 4000, its own thousand after the mainland's. */
export const alpine = kind_def({
  kind: WorldKind.ALPINE,
  base: 4000,
  tag: "a",
  version: 3,
  size: SIZE,
  ...land_kind(ALPINE, ALPINE_KNOBS, WorldKind.ALPINE),
  options: ALPINE_KNOBS,
  recipe: ALPINE,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: LAND_GRIP,
});

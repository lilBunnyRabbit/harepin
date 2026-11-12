import { generate_mainland, MAINLAND_SIZE } from "../mainland";
import { MAINLAND } from "../recipe";
import { WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

/** Base 3000, its own thousand after the desert's. */
export const mainland = kind_def({
  kind: WorldKind.MAINLAND,
  base: 3000,
  tag: "m",
  version: 5,
  size: MAINLAND_SIZE,
  generate: generate_mainland,
  options: [],
  recipe: MAINLAND,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: LAND_GRIP,
});

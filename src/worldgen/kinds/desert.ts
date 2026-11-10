import { generate } from "../index";
import { DESERT } from "../recipe";
import { WorldKind } from "../types";
import { kind_def, SAND_GRIP } from "./kind-def";

/** Base 2000, its own thousand after the sky's. */
export const desert = kind_def({
  kind: WorldKind.DESERT,
  base: 2000,
  tag: "d",
  version: 1,
  generate: (seed) => generate(seed, DESERT, WorldKind.DESERT),
  recipe: DESERT,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: SAND_GRIP,
});

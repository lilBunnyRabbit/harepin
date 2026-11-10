import { generate } from "../index";
import { DESERT } from "../recipe";
import { DESERT_KNOBS } from "./land-knobs";
import { tune } from "./options";
import { SIZE, WorldKind } from "../types";
import { kind_def, SAND_GRIP } from "./kind-def";

/** Base 2000, its own thousand after the sky's. */
export const desert = kind_def({
  kind: WorldKind.DESERT,
  base: 2000,
  tag: "d",
  version: 2,
  size: SIZE,
  generate: (seed, levels) => generate(seed, tune(DESERT, DESERT_KNOBS, levels), WorldKind.DESERT),
  options: DESERT_KNOBS,
  recipe: DESERT,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: SAND_GRIP,
});

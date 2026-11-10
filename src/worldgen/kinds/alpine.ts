import { generate } from "../index";
import { ALPINE } from "../recipe";
import { ALPINE_KNOBS } from "./land-knobs";
import { tune } from "./options";
import { SIZE, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

/** Base 4000, its own thousand after the mainland's. */
export const alpine = kind_def({
  kind: WorldKind.ALPINE,
  base: 4000,
  tag: "a",
  version: 1,
  size: SIZE,
  generate: (seed, levels) => generate(seed, tune(ALPINE, ALPINE_KNOBS, levels), WorldKind.ALPINE),
  options: ALPINE_KNOBS,
  recipe: ALPINE,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: LAND_GRIP,
});

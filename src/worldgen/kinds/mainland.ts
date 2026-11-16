import { generate_mainland, MAINLAND_SIZE } from "../mainland";
import { MAINLAND } from "../recipe";
import { WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";
import { MAINLAND_KNOBS } from "./land-knobs";
import { tune } from "./options";

const tuned = (levels: readonly number[]) => tune(MAINLAND, MAINLAND_KNOBS, levels);

/** Base 3000, its own thousand after the desert's. */
export const mainland = kind_def({
  kind: WorldKind.MAINLAND,
  base: 3000,
  tag: "m",
  version: 11,
  size: MAINLAND_SIZE,
  generate: (seed, levels) => generate_mainland(seed, tuned(levels)),
  options: MAINLAND_KNOBS,
  recipe: MAINLAND,
  tuned,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: LAND_GRIP,
});

import { generate_lab } from "../lab";
import { SIZE, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

/** The lab keys no records, so a bump is free: bump it whenever the layout moves, so a stale worker cache never serves the old one. */
export const LAB_VERSION = 1;

export const lab = kind_def({
  kind: WorldKind.LAB,
  base: 11000,
  tag: "lab",
  version: LAB_VERSION,
  size: SIZE,
  generate: (seed) => generate_lab(seed, WorldKind.LAB),
  options: [],
  recipe: null,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  reset_in_place: true,
  grip: LAND_GRIP,
});

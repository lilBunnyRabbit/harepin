import { generate } from "../index";
import { ISLAND } from "../recipe";
import { ISLAND_KNOBS } from "./land-knobs";
import { tune } from "./options";
import { SIZE, WORLD_VERSION, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

export const island = kind_def({
  kind: WorldKind.ISLAND,
  base: 0,
  tag: "w",
  version: WORLD_VERSION,
  size: SIZE,
  generate: (seed, levels) => generate(seed, tune(ISLAND, ISLAND_KNOBS, levels), WorldKind.ISLAND),
  options: ISLAND_KNOBS,
  recipe: ISLAND,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: LAND_GRIP,
});

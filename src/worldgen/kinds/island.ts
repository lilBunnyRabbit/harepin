import { ISLAND } from "../recipe";
import { ISLAND_KNOBS } from "./land-knobs";
import { land_kind } from "./land-kind";
import { SIZE, WORLD_VERSION, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

export const island = kind_def({
  kind: WorldKind.ISLAND,
  base: 0,
  tag: "w",
  version: WORLD_VERSION,
  size: SIZE,
  ...land_kind(ISLAND, ISLAND_KNOBS, WorldKind.ISLAND),
  options: ISLAND_KNOBS,
  recipe: ISLAND,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: LAND_GRIP,
});

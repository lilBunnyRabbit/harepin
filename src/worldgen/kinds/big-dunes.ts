import { BIG_DUNES } from "../recipe";
import { land_kind } from "./land-kind";
import { SIZE, WorldKind } from "../types";
import { kind_def, SAND_GRIP } from "./kind-def";

/** Base 9000, past the rooftops' thousand; 7000 is held for the ice canyon. */
export const big_dunes = kind_def({
  kind: WorldKind.BIG_DUNES,
  base: 9000,
  tag: "bd",
  version: 9,
  size: SIZE,
  ...land_kind(BIG_DUNES, [], WorldKind.BIG_DUNES),
  options: [],
  recipe: BIG_DUNES,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: SAND_GRIP,
});

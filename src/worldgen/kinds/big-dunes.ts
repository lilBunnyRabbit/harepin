import { DUNE_SEA_SIZE, generate_dune_sea } from "../dune-sea";
import { BIG_DUNES } from "../recipe";
import { WorldKind } from "../types";
import { kind_def, SAND_GRIP } from "./kind-def";

/** Base 9000, past the rooftops' thousand; 7000 is held for the ice canyon. Streamed, like the mainland. */
export const big_dunes = kind_def({
  kind: WorldKind.BIG_DUNES,
  base: 9000,
  tag: "bd",
  version: 14,
  size: DUNE_SEA_SIZE,
  generate: generate_dune_sea,
  options: [],
  recipe: BIG_DUNES,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  reset_in_place: true,
  grip: SAND_GRIP,
});

import { generate } from "../index";
import { WORLD_VERSION, WorldKind } from "../types";
import type { KindDef } from "./kinds";

export const island: KindDef = {
  kind: WorldKind.ISLAND,
  id: WORLD_VERSION,
  key: (seed) => `${seed}:w${WORLD_VERSION}`,
  generate,
  open_ground: true,
  rails: false,
};

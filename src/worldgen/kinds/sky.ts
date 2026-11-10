import { generate_sky } from "../sky";
import { SKY_VERSION, WorldKind } from "../types";
import type { KindDef } from "./kinds";

/** The island keeps WORLD_VERSION as its id, so old builds see a sky peer as on a foreign map. */
export const sky: KindDef = {
  kind: WorldKind.SKY,
  id: 1000 + SKY_VERSION,
  key: (seed) => `${seed}:sky${SKY_VERSION}`,
  generate: generate_sky,
  open_ground: false,
  rails: true,
};

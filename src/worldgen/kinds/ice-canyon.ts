import { ICE_CANYON } from "../recipe";
import { land_kind } from "./land-kind";
import { RouteKind, SIZE, WorldKind, type WorldData } from "../types";
import { kind_def, WINTER_GRIP } from "./kind-def";

/** Drawn for a seed none of whose descent attempts finds room for a frozen fall; descent.test.ts proves it has falls. */
export const FALLBACK_SEED = 0;

const land = land_kind(ICE_CANYON, [], WorldKind.ICE_CANYON);
// The descent comes only with a fall on its bed, so a world without one is a seed the planner could not build.
const has_descent = (data: WorldData) => data.routes.some((r) => r.kind === RouteKind.SPRINT);

/** Base 7000, its own thousand after the volcano's. */
export const ice_canyon = kind_def({
  kind: WorldKind.ICE_CANYON,
  base: 7000,
  tag: "ic",
  version: 5,
  size: SIZE,
  ...land,
  generate: (seed, levels, relief) => {
    const data = land.generate(seed, levels, relief);
    if (has_descent(data)) return data;
    if (seed === FALLBACK_SEED) throw new Error(`ice canyon: fallback seed ${seed} found no descent`);
    return land.generate(FALLBACK_SEED, levels, relief);
  },
  options: [],
  recipe: ICE_CANYON,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: WINTER_GRIP,
});

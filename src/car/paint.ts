import { MAX_PAINT } from "./build";
import { car_paints, tier_metals } from "../theme/palette";
import type { Lab } from "../theme/theme";

export interface Finish {
  metalness: number;
  roughness: number;
  /** Reflection strength of the studio strip (`models.ts`); each flat facet catches it at its own angle. */
  reflect: number;
}

const METAL: Finish = { metalness: 0.55, roughness: 0.15, reflect: 2 };

// Career reward paints, Rookie bronze to Pro gold, in the tier metals. Kept out of `car_paints`: builds wrap their paint
// by that list's length, so growing it would recolour saved cars.
export const reward_paints: readonly Lab[] = tier_metals;

export function paint_lab(paint: number): Lab {
  return reward_paints[paint - MAX_PAINT - 1] ?? car_paints[paint % car_paints.length];
}

export function paint_finish(paint: number): Finish | null {
  return reward_paints[paint - MAX_PAINT - 1] ? METAL : null;
}

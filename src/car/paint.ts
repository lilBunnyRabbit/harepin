import { MAX_PAINT } from "./build";
import { car_paints, carbon, tier_metals } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { WeavePattern, type Weave } from "./carbon";

export interface Finish {
  metalness: number;
  roughness: number;
  /** Reflection strength of the studio strip (`models.ts`); each flat facet catches it at its own angle. */
  reflect: number;
  weave: Weave | null;
}

// Mostly metal with a little blur: the paint's own colour tints what the strip reflects, so it reads as metal from the
// chase camera, where a sharp mirror only showed the dark floor.
const METAL: Finish = { metalness: 0.85, roughness: 0.28, reflect: 2.6, weave: null };
// A 2x2 twill in tows far wider than real ones: at chase distance a real tow is under a pixel and the weave fades to grey.
const CARBON: Finish = { metalness: 0.1, roughness: 0.45, reflect: 0.9, weave: { pattern: WeavePattern.TWILL, tow: 0.09, sheen: 0.55, ...carbon } };
const LEGEND = 4;

// Career reward paints, Rookie bronze to Legend carbon, in the tier metals. Kept out of `car_paints`: builds wrap their paint
// by that list's length, so growing it would recolour saved cars.
export const reward_paints: readonly Lab[] = tier_metals;

export function paint_lab(paint: number): Lab {
  return reward_paints[paint - MAX_PAINT - 1] ?? car_paints[paint % car_paints.length];
}

export function paint_finish(paint: number): Finish | null {
  const reward = paint - MAX_PAINT - 1;
  if (!reward_paints[reward]) return null;
  return reward === LEGEND ? CARBON : METAL;
}

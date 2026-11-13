import { MAX_PAINT } from "./build";
import { car_paints, carbon, tier_metals } from "../theme/palette";
import type { Lab } from "../theme/theme";
import type { Weave } from "./carbon";

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
const CARBON: Finish = { metalness: 0.1, roughness: 0.45, reflect: 0.9, weave: { tow: 0.07, sheen: 0.55, ...carbon } };
interface RewardPaint {
  lab: Lab;
  finish: Finish;
}

// Career reward paints, Rookie bronze to Legend carbon, one per tier in the tier metals. Kept out of `car_paints`: builds
// wrap their paint by that list's length, so growing it would recolour saved cars.
export const reward_paints: readonly RewardPaint[] = [
  { lab: tier_metals[0], finish: METAL },
  { lab: tier_metals[1], finish: METAL },
  { lab: tier_metals[2], finish: METAL },
  { lab: tier_metals[3], finish: METAL },
  { lab: tier_metals[4], finish: CARBON },
];

export function paint_lab(paint: number): Lab {
  return reward_paints[paint - MAX_PAINT - 1]?.lab ?? car_paints[paint % car_paints.length];
}

export function paint_finish(paint: number): Finish | null {
  return reward_paints[paint - MAX_PAINT - 1]?.finish ?? null;
}

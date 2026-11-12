import { MAX_PAINT } from "./build";
import { brand, car_paints, mix } from "../theme/palette";
import type { Lab } from "../theme/theme";

// Placeholder flat metals, Rookie bronze to Pro gold, until the reward paint art lands. Kept out of `car_paints`: builds
// wrap their paint by that list's length, so growing it would recolour saved cars.
export const reward_paints: readonly Lab[] = [mix(brand.warning, brand.error, 0.55), mix(brand.foreground, brand.background_lightest, 0.6), brand.warning];

export function paint_lab(paint: number): Lab {
  return reward_paints[paint - MAX_PAINT - 1] ?? car_paints[paint % car_paints.length];
}

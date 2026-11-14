import { DEFAULT_BUILD, DEFAULT_PARTS, type Build } from "../car/build";
import { CARS, type CarId } from "../car/cars";

export const StillView = {
  /** Front three-quarter, on its shadow. */
  QUARTER: "quarter",
  /** Side on, no shadow: the alpha is the car's outline, for a mask. */
  PROFILE: "profile",
} as const;
export type StillView = (typeof StillView)[keyof typeof StillView];

/** One paint per car, the same wherever a still of it shows. */
export const still_paint = (car: CarId) => Object.keys(CARS).indexOf(car);

export const still_build = (car: CarId, aero = 0): Build => ({ ...DEFAULT_BUILD, car, paint: still_paint(car), parts: { ...DEFAULT_PARTS, aero } });

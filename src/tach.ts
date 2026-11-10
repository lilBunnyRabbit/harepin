import type { CarSpec } from "./cars";

// The coupe's tuned look (hot from 6600 of 7300, shift light from 6700 with a 6900 upshift), kept as ratios so every
// engine lights at the same point in its own rev range.
const HOT_RATIO = 6600 / 7300;
const SHIFT_RATIO = 6700 / 6900;

export interface Tach {
  /** Bar fill, 0-100 percent of redline. */
  fill: number;
  hot: boolean;
  shift: boolean;
}

export function tach(rpm: number, spec: Pick<CarSpec, "redline" | "upshift">): Tach {
  return {
    fill: Math.min(100, (rpm / spec.redline) * 100),
    hot: rpm > spec.redline * HOT_RATIO,
    shift: rpm > spec.upshift * SHIFT_RATIO,
  };
}

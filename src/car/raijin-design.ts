import { mirror, tail_end } from "./design-parts";
import type { Cabin, Design, Section, Slab, Wing } from "./designs";
import type { Triple } from "./cars";
import type { Point } from "./geometry";

const OUTLINE: Point[] = [[1.96, 0.22], [2.04, 0.4], [2.14, 0.76], [2.08, 0.84], [0.82, 1.0], [-1.95, 1.12], [-2.38, 1.13], [-2.43, 1.06], [-2.42, 0.4], [-2.34, 0.24]];
const SECTION: Section = { belt: [1.16, 1.16], shoulder: 0, tuck: 0.03, nose: [0.12, 0.4], tail: [0.1, 0.35] };
const CABIN: Cabin = {
  points: [[0.82, 1.0], [0.05, 1.44], [-0.5, 1.48], [-1.25, 1.46], [-1.95, 1.12]],
  width: 1.5,
  tumble: 0.14,
  frame: [0.06, 0.04, 0.04, 0.12, 0.04],
  screens: [[0, 0.08], [3, 0.13]],
  split: [-0.55, 0.09],
};
// One slim band across the boot lid, a lamp at each end of it; the plate sits lower on the bumper, between the tailpipes.
const TAIL = tail_end(OUTLINE, 0.99, 0.12, 0.9, [{ size: [0.42, 0.09, 0.05], at: [0.67, 0.99, 0] }], null, 0.6);
const PIPE: Triple = [0.5, 0.33, -2.4];
const DECK = 1.105;
const leg = (front: number, y: number, top: number, from: number, to: number): Slab => ({ points: [[front, DECK], [top, y], [top - 0.18, y + 0.01], [-2.39, DECK]], from, to });
// The saloon's own boot wing in paint on a leg near each end, then a trim plane on plate uprights with painted endplates.
const WINGS: Wing[] = [
  { paint: [{ size: [0.8, 0.045, 0.24], at: [0.4, 1.3, -2.26], tilt: [0.06, 0, 0] }], trim: [], lips: [leg(-2.06, 1.3, -2.17, 0.64, 0.73)] },
  { paint: [{ size: [0.82, 0.045, 0.28], at: [0.41, 1.35, -2.27], tilt: [0.08, 0, 0] }], trim: [], lips: [leg(-2.04, 1.35, -2.17, 0.64, 0.73)] },
  {
    paint: [{ size: [0.025, 0.18, 0.38], at: [0.86, 1.45, -2.28], tilt: [0.1, 0, 0] }],
    trim: [{ size: [0.86, 0.04, 0.32], at: [0.43, 1.44, -2.27], tilt: [0.1, 0, 0] }],
    stands: [leg(-2.0, 1.43, -2.18, 0.4, 0.435)],
  },
  {
    paint: [{ size: [0.025, 0.24, 0.46], at: [0.89, 1.61, -2.33], tilt: [0.12, 0, 0] }],
    trim: [{ size: [0.89, 0.045, 0.38], at: [0.445, 1.6, -2.32], tilt: [0.12, 0, 0] }],
    stands: [leg(-1.98, 1.59, -2.22, 0.4, 0.435)],
  },
];
const NOSE_LEAN = 0.27;
const HOOD_FALL = 0.126;

export const RAIJIN_DESIGN: Design = {
  outline: OUTLINE,
  width: 1.78,
  sill: 0.26,
  cabin: CABIN,
  section: SECTION,
  arches: { gap: 0.055, steps: 8, flare: 0.06, out: 0.07, reach: 0.04, tone: "paint" },
  heads: [{ size: [0.36, 0.09, 0.05], at: [0.62, 0.72, 2.13], tilt: [NOSE_LEAN, 0, 0] }],
  tails: TAIL.tails,
  paint: [mirror(CABIN, 0.62, [0.18, 0.12, 0.16], SECTION.shoulder)],
  trim: [
    { size: [0.46, 0.3, 0.05], at: [0.23, 0.55, 2.085], tilt: [NOSE_LEAN, 0, 0] },
    { size: [0.28, 0.02, 0.3], at: [0.14, 0.915, 1.5], tilt: [HOOD_FALL, 0, 0] },
    { size: [0.3, 0.17, 0.05], at: [PIPE[0], PIPE[1], -2.39], tilt: [-0.46, 0, 0] },
    ...TAIL.trim,
  ],
  markers: [],
  chrome: [...TAIL.chrome, { size: [0.12, 0.12, 0.1], at: [PIPE[0], PIPE[1] + 0.01, -2.4], round: true }],
  tyre: [0.28, 0.28],
  rim: { size: 0.72, spokes: 5, tone: "metal", spoke: 0.09 },
  round: 12,
  deck: [-2.2, 1.12],
  hood: [1.45, 0.92],
  exhaust: PIPE,
  wings: WINGS,
  kit: {
    arches: { gap: 0.055, steps: 8, flare: 0.08, out: 0.1, reach: 0.04, tone: "paint" },
    tyre: [0.34, 0.34],
    rim: { size: 0.8, spokes: 5, tone: "bronze", spoke: 0.1 },
    caliper: "warning",
  },
};

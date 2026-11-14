import { mirror, tail_end } from "./design-parts";
import type { Arches, Cabin, Design, Section, Slab, Wing } from "./designs";
import type { Part, Point } from "./geometry";

const OUTLINE: Point[] = [[1.96, 0.28], [2.0, 0.56], [1.94, 0.65], [0.57, 0.93], [-1.9, 0.95], [-2.0, 0.94], [-2.12, 0.91], [-2.14, 0.6], [-2.08, 0.28]];
const SECTION: Section = { belt: [0.79, 0.82], shoulder: 0.11, tuck: 0.05, nose: [0.2, 0.3], tail: [0.1, 0.22] };
const CABIN: Cabin = { points: [[0.57, 0.93], [-0.05, 1.26], [-0.35, 1.3], [-0.78, 1.28], [-1.9, 0.95]], width: 1.66, tumble: 0.34, frame: [0.05, 0.035, 0.035, 0.05, 0.035], screens: [[0, 0.07], [3, 0.2]] };
const TAIL = tail_end(OUTLINE, 0.79, 0.22, 0.92, [{ size: [0.46, 0.14, 0.05], at: [0.63, 0.79, 0] }], { half: 0.36, y: 0.79 }, 0.58);

const STOCK_ARCHES: Arches = { gap: 0.06, steps: 8, flare: 0.06, out: 0.04, reach: 0.04, tone: "paint" };
// The kit's bolt-on arches stand out past the stock sill line and take the wide tyres.
const WIDE_ARCHES: Arches = { gap: 0.07, steps: 8, flare: 0.08, out: 0.1, reach: 0.04, tone: "paint" };

// A ducktail grown out of the hatch, then a trim plane on two short painted legs standing in it.
const LIP: Slab = { points: [[-1.9, 0.93], [-2.15, 1.0], [-2.17, 0.97], [-2.12, 0.88]], from: 0, to: 0.9 };
const DUCKTAIL: Slab = { points: [[-1.88, 0.93], [-2.18, 1.06], [-2.2, 1.03], [-2.12, 0.88]], from: 0, to: 0.9 };
const WINGS: Wing[] = [
  { paint: [], trim: [], lips: [LIP] },
  { paint: [], trim: [], lips: [DUCKTAIL] },
  {
    paint: [],
    trim: [{ size: [0.88, 0.045, 0.26], at: [0.44, 1.16, -2.08], tilt: [0.1, 0, 0] }],
    lips: [LIP, { points: [[-1.92, 0.93], [-2.0, 1.15], [-2.16, 1.165], [-2.13, 0.95]], from: 0.5, to: 0.62 }],
  },
  {
    paint: [{ size: [0.03, 0.15, 0.38], at: [0.955, 1.28, -2.13], tilt: [0.12, 0, 0] }],
    trim: [{ size: [0.94, 0.05, 0.32], at: [0.47, 1.27, -2.12], tilt: [0.12, 0, 0] }],
    lips: [DUCKTAIL, { points: [[-1.9, 0.93], [-2.03, 1.255], [-2.22, 1.28], [-2.15, 1.0]], from: 0.5, to: 0.62 }],
  },
];

const PAINT: Part[] = [mirror(CABIN, 0.4, [0.18, 0.12, 0.18], SECTION.shoulder)];
const REAR_VALANCE: Part = { size: [0.9, 0.14, 0.04], at: [0.45, 0.37, -2.11] };

export const KAZE_DESIGN: Design = {
  outline: OUTLINE,
  width: 1.96,
  sill: 0.28,
  cabin: CABIN,
  section: SECTION,
  arches: STOCK_ARCHES,
  heads: [{ size: [0.36, 0.05, 0.3], at: [0.62, 0.685, 1.8], tilt: [0.2, 0, 0] }],
  tails: TAIL.tails,
  paint: PAINT,
  trim: [{ size: [0.52, 0.12, 0.04], at: [0.25, 0.4, 1.985] }, REAR_VALANCE, ...TAIL.trim],
  markers: [],
  chrome: TAIL.chrome,
  tyre: [0.28, 0.3],
  rim: { size: 0.62, spokes: 6, tone: "metal", spoke: 0.07 },
  round: 12,
  deck: [-2.0, 0.97],
  wings: WINGS,
  hood: [1.2, 0.8],
  exhaust: [0.55, 0.3, -2.08],
  kit: {
    arches: WIDE_ARCHES,
    paint: [...PAINT, { size: [1.02, 0.2, 0.14], at: [0.51, 0.4, 1.96] }],
    trim: [{ size: [0.6, 0.15, 0.04], at: [0.3, 0.4, 2.015] }, REAR_VALANCE, ...TAIL.trim],
    tyre: [0.34, 0.38],
    rim: { size: 0.66, spokes: 5, tone: "metal", lip: 0.2, spoke: 0.08 },
  },
};

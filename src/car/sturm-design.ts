import { MIRROR, mirror, tail_end } from "./design-parts";
import type { Arches, Cabin, Design, Slab, Wing } from "./designs";
import type { Point } from "./geometry";

const OUTLINE: Point[] = [[2.2, 0.14], [2.28, 0.22], [2.28, 0.42], [2.1, 0.52], [0.76, 0.78], [-1.0, 0.84], [-1.5, 0.8], [-1.82, 0.66], [-1.96, 0.44], [-1.94, 0.24], [-1.86, 0.16]];
const CABIN: Cabin = {
  points: [[0.76, 0.78], [0.18, 1.22], [-0.2, 1.29], [-0.62, 1.26], [-1.36, 0.94], [-1.86, 0.66]],
  width: 1.38,
  tumble: 0.22,
  frame: [0.05, 0.035, 0.035, 0.05, 0.035, 0.035],
  screens: [[0, 0.07], [3, 0.17]],
  split: [-0.42, 0.08],
  glass_to: -1.36,
};
// The lamp band runs the full width of the hips, so each hip ends on it and the tail reads as one surface.
const HIP = 0.9;
const WIDE_HIP = 0.96;
const tail = (half: number) => tail_end(OUTLINE, 0.57, 0.14, half, [{ size: [half, 0.1, 0.04], at: [half / 2, 0.57, 0] }], null, 0.42);
const TAIL = tail(HIP);
const WIDE_TAIL = tail(WIDE_HIP);

const STOCK_ARCHES: Arches = { gap: 0.06, steps: 8, flare: 0.05, out: 0.07, reach: 0.04, tone: "paint" };
const WIDE_ARCHES: Arches = { gap: 0.08, steps: 8, flare: 0.07, out: 0.15, reach: 0.04, tone: "paint" };

const FENDER: Point[] = [[2.12, 0.48], [2.16, 0.6], [2.08, 0.74], [1.92, 0.82], [1.3, 0.84], [0.6, 0.8], [0.6, 0.5]];
const HAUNCH: Point[] = [[-0.1, 0.72], [-0.3, 0.87], [-0.6, 0.94], [-1.15, 0.94], [-1.55, 0.84], [-1.83, 0.69], [-1.875, 0.62], [-1.84, 0.56]];
const fenders = (rear: number): Slab[] => [
  { points: FENDER, from: 0.48, to: 0.86 },
  { points: HAUNCH, from: 0.55, to: rear },
];

// The engine lid's ducktail, growing to a flat tray, then the big wing on plate uprights standing in the ducktail.
const DUCKTAIL: Slab = { points: [[-1.42, 0.9], [-1.9, 0.8], [-1.93, 0.76], [-1.84, 0.66]], from: 0, to: 0.64 };
const WHALETAIL: Slab = { points: [[-1.38, 0.92], [-1.94, 0.86], [-1.97, 0.82], [-1.84, 0.66]], from: 0, to: 0.66 };
const TRAY: Slab = { points: [[-1.34, 0.95], [-1.98, 0.93], [-2.0, 0.89], [-1.84, 0.66]], from: 0, to: 0.7 };
const WINGS: Wing[] = [
  { paint: [], trim: [], lips: [DUCKTAIL] },
  { paint: [], trim: [], lips: [WHALETAIL] },
  { paint: [], trim: [], lips: [TRAY] },
  {
    paint: [{ size: [0.03, 0.26, 0.5], at: [0.93, 1.3, -1.9], tilt: [0.1, 0, 0] }],
    trim: [{ size: [0.93, 0.045, 0.42], at: [0.465, 1.29, -1.89], tilt: [0.1, 0, 0] }],
    lips: [WHALETAIL],
    stands: [{ points: [[-1.46, 0.88], [-1.76, 1.275], [-1.96, 1.295], [-1.9, 0.84]], from: 0.4, to: 0.44 }],
  },
];

export const STURM_DESIGN: Design = {
  outline: OUTLINE,
  width: 1.7,
  sill: 0.16,
  cabin: CABIN,
  arches: STOCK_ARCHES,
  slabs: fenders(HIP),
  heads: [{ size: [0.24, 0.24, 0.06], at: [0.67, 0.65, 2.14], tilt: [-0.35, 0, 0], round: true }],
  tails: TAIL.tails,
  paint: [mirror(CABIN, 0.5, MIRROR, 0)],
  trim: [{ size: [0.86, 0.14, 0.04], at: [0.43, 0.3, 2.275] }, { size: [0.86, 0.1, 0.05], at: [0.43, 0.3, -1.95] }, ...TAIL.trim],
  markers: [],
  chrome: TAIL.chrome,
  tyre: [0.28, 0.32],
  rim: { size: 0.7, spokes: 5, tone: "metal", spoke: 0.09 },
  round: 12,
  deck: [-1.7, 0.75],
  hood: [-1.42, 0.86],
  exhaust: [0.3, 0.25, -1.94],
  wings: WINGS,
  fronts: [
    { paint: [], trim: [] },
    { paint: [], trim: [{ size: [0.96, 0.035, 0.22], at: [0.48, 0.15, 2.22] }] },
    { paint: [], trim: [{ size: [1.0, 0.035, 0.3], at: [0.5, 0.15, 2.24] }] },
  ],
  kit: {
    arches: WIDE_ARCHES,
    slabs: fenders(WIDE_HIP),
    tails: WIDE_TAIL.tails,
    trim: [{ size: [0.86, 0.14, 0.04], at: [0.43, 0.3, 2.275] }, { size: [0.86, 0.1, 0.05], at: [0.43, 0.3, -1.95] }, ...WIDE_TAIL.trim],
    tyre: [0.36, 0.42],
    rim: { size: 0.8, spokes: 5, tone: "metal", lip: 0.3, spoke: 0.09 },
  },
};

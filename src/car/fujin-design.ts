import type { Design, Wing } from "./designs";
import { arc, type Part, type Point } from "./geometry";

const SILL = 0.16;
const WHEEL = 0.34;
// The steered tyre's corner sweeps 0.37 m from the hub at full lock; the arch stands clear of it.
const ARCH = 0.4;
const FRONT_AXLE = 1.45;
const REAR_AXLE = -1.35;

// The tub is lower than the wheels, so the arches are cut in the pontoons beside it, not in the body outline.
const PONTOON: Point[] = [
  [2.3, SILL], [2.36, 0.24], [2.33, 0.38], [2.1, 0.6], [1.8, 0.77], [1.45, 0.81], [1.1, 0.78], [0.8, 0.62], [0.6, 0.54],
  [-0.5, 0.54], [-0.8, 0.66], [-1.1, 0.8], [-1.45, 0.84], [-2.0, 0.8], [-2.3, 0.74], [-2.34, 0.66], [-2.34, 0.3], [-2.26, SILL],
  ...arc(REAR_AXLE, WHEEL, ARCH, SILL, 7),
  ...arc(FRONT_AXLE, WHEEL, ARCH, SILL, 7),
];
const FIN: Point[] = [[-0.45, 0.98], [-2.3, 0.9], [-2.3, 0.6], [-0.45, 0.6]];
const ENDPLATE: Point[] = [[-1.8, 0.8], [-1.98, 1.16], [-2.46, 1.16], [-2.46, 0.72], [-2.3, 0.7]];

const plane = (chord: number, tilt: number): Part => ({ size: [0.985, 0.04, chord], at: [0.4925, 1.1, -2.2], tilt: [tilt, 0, 0] });
const flap = (chord: number, y: number, z: number, tilt: number): Part => ({ size: [0.985, 0.03, chord], at: [0.4925, y, z], tilt: [tilt, 0, 0] });

const WINGS: Wing[] = [
  { paint: [], trim: [plane(0.38, 0.1)] },
  { paint: [], trim: [plane(0.38, 0.12), flap(0.14, 1.16, -2.4, 0.5)] },
  { paint: [], trim: [plane(0.42, 0.16), flap(0.2, 1.18, -2.41, 0.7)] },
  { paint: [], trim: [plane(0.44, 0.2), flap(0.22, 1.19, -2.42, 0.8), flap(0.16, 1.27, -2.5, 1.05)] },
];

const SPLITTER: Part = { size: [1.0, 0.03, 0.34], at: [0.5, 0.15, 2.28] };
const FRONTS: Wing[] = [
  { paint: [], trim: [SPLITTER] },
  { paint: [], trim: [{ size: [1.0, 0.03, 0.44], at: [0.5, 0.15, 2.33] }] },
  {
    paint: [],
    trim: [
      { size: [1.0, 0.03, 0.5], at: [0.5, 0.15, 2.36] },
      { size: [0.03, 0.14, 0.4], at: [1.015, 0.21, 2.36] },
      { size: [0.2, 0.02, 0.2], at: [1.08, 0.44, 2.12], tilt: [-0.5, 0, 0] },
      { size: [0.16, 0.02, 0.18], at: [1.06, 0.3, 2.2], tilt: [-0.5, 0, 0] },
    ],
  },
];

export const FUJIN_DESIGN: Design = {
  outline: [[2.3, SILL], [2.36, 0.22], [2.32, 0.3], [1.7, 0.44], [1.0, 0.58], [-1.9, 0.62], [-2.26, 0.6], [-2.3, 0.52], [-2.3, 0.3], [-2.24, SILL]],
  width: 1.04,
  sill: SILL,
  cabin: {
    points: [[1.0, 0.58], [0.6, 0.86], [0.25, 0.99], [-0.15, 1.03], [-0.55, 0.99], [-1.0, 0.86], [-1.95, 0.62]],
    width: 1.02,
    tumble: 0.42,
    frame: [0.05, 0.04, 0.035, 0.035, 0.05, 0.04, 0.04],
    screens: [[0, 0.06], [1, 0.06]],
    glass_to: -0.5,
  },
  arches: { gap: 0, steps: 0, flare: 0, out: 0, reach: 0, tone: "paint" },
  slabs: [
    { points: PONTOON, from: 0.5, to: 1.0 },
    { points: FIN, from: 0, to: 0.016 },
    { points: ENDPLATE, from: 0.97, to: 1.0 },
  ],
  heads: [{ size: [0.1, 0.27, 0.04], at: [0.78, 0.5, 2.225], tilt: [-0.8, 0, 0] }],
  tails: [{ size: [0.07, 0.3, 0.04], at: [0.9, 0.48, -2.345] }],
  paint: [{ size: [0.14, 0.08, 0.14], at: [0.72, 0.8, 0.95] }],
  trim: [
    { size: [0.26, 0.012, 0.07], at: [0.75, 0.813, 1.57] },
    { size: [0.26, 0.012, 0.07], at: [0.75, 0.816, 1.45] },
    { size: [0.26, 0.012, 0.07], at: [0.75, 0.813, 1.33] },
    { size: [0.02, 0.2, 0.36], at: [0.995, 0.38, 0.74] },
    { size: [0.3, 0.012, 0.5], at: [0.75, 0.545, 0.0] },
    { size: [0.5, 0.2, 0.04], at: [0.25, 0.3, -2.3] },
    { size: [0.1, 0.1, 0.3], at: [0.05, 1.05, -0.35] },
  ],
  markers: [{ size: [0.05, 0.05, 0.04], at: [0.38, 0.33, 2.3] }],
  chrome: [],
  tyre: [0.3, 0.36],
  rim: { size: 0.74, spokes: 5, tone: "light", lip: 0.14, spoke: 0.07 },
  deck: [-2.2, 1.1],
  hood: [-1.2, 0.8],
  exhaust: [0.3, 0.3, -2.3],
  bottles: "inside",
  caliper: "warning",
  panel: { rear: -0.86, front: 0.96, low: 0.2, high: 0.5, side: 1.0 },
  wings: WINGS,
  fronts: FRONTS,
};

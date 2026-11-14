import { endplate, gurney, leg, mirror, plane, tail_end, widen_wing } from "./design-parts";
import type { Arches, Cabin, Design, Kit, Section, Slab, Wing } from "./designs";
import type { Part, Point } from "./geometry";

const OUTLINE: Point[] = [[1.96, 0.28], [2.0, 0.36], [2.0, 0.56], [1.94, 0.65], [0.57, 0.93], [-1.9, 0.95], [-2.0, 0.94], [-2.12, 0.91], [-2.14, 0.6], [-2.08, 0.28]];
const SECTION: Section = { belt: [0.79, 0.82], shoulder: 0.11, tuck: 0.05, nose: [0.14, 0.34], tail: [0.1, 0.22] };
const CABIN: Cabin = { points: [[0.57, 0.93], [-0.05, 1.26], [-0.35, 1.3], [-0.78, 1.28], [-1.9, 0.95]], width: 1.66, tumble: 0.34, frame: [0.05, 0.035, 0.035, 0.05, 0.035], screens: [[0, 0.07], [3, 0.2]] };
const TAIL = tail_end(OUTLINE, 0.79, 0.22, 0.92, [{ size: [0.46, 0.14, 0.05], at: [0.63, 0.79, 0] }], { half: 0.36, y: 0.79 }, 0.58);

const STOCK_ARCHES: Arches = { gap: 0.06, steps: 7, flare: 0.06, out: 0.04, reach: 0.04, tone: "paint" };
const HALF = 0.984;
const SPAN = 0.86;
// A lip grown out of the hatch across the whole tail, then a ducktail, then a trim plane on two painted legs standing in it.
const LIP: Slab = { points: [[-1.9, 0.93], [-2.15, 1.0], [-2.17, 0.97], [-2.12, 0.88]], from: 0, to: HALF };
const DUCKTAIL: Slab = { points: [[-1.88, 0.93], [-2.18, 1.06], [-2.2, 1.03], [-2.12, 0.88]], from: 0, to: HALF };
const STREET = plane([-2.06, 1.19], 0.3, 0.045, 0.1);
const RACE = plane([-2.1, 1.31], 0.36, 0.055, 0.12);
const legs = (profile: Point[], rear: Point): Slab => ({ points: leg(profile, [-1.94, 0.925], rear), from: 0.5, to: 0.58 });
const WINGS: Wing[] = [
  { paint: [], trim: [], lips: [LIP] },
  { paint: [], trim: [], lips: [DUCKTAIL] },
  { paint: [], trim: [], lips: [LIP, legs(STREET, [-2.12, 0.97])], stands: [{ points: STREET, from: 0, to: SPAN }] },
  {
    paint: [],
    trim: [],
    lips: [DUCKTAIL, legs(RACE, [-2.15, 1.02]), { points: endplate(RACE, 0.03, 0.06), from: SPAN, to: SPAN + 0.03 }],
    stands: [{ points: RACE, from: 0, to: SPAN }, { points: gurney(RACE, 0.03), from: 0, to: SPAN }],
  },
];

const PAINT: Part[] = mirror(CABIN, SECTION.shoulder);
const REAR_VALANCE: Part = { size: [0.9, 0.14, 0.04], at: [0.45, 0.37, -2.11] };

// The kit is the shell: 7 cm wider a side over deeper sills, with a deep upright bumper and a tail valance drawn in the outline.
// The shoulder grows by what the body widens, so the body top, and the cabin and wings on it, stay where they were.
const WIDE = 2.1;
const WIDE_SHOULDER = 1 - (1.96 * (1 - SECTION.shoulder)) / WIDE;
const WIDE_HALF = WIDE / 2 + 0.004;
const CHIN: Point = [1.99, 0.18];
const KIT_OUTLINE: Point[] = [CHIN, [2.05, 0.24], [2.05, 0.54], ...OUTLINE.slice(3, -1), [-2.15, 0.24], [-2.09, 0.18]];
// A painted lip run on from the chin, then a trim splitter under it.
const FRONT_LIP: Slab = { points: [[2.05, 0.24], [2.1, 0.205], [2.1, 0.175], [1.9, 0.175], [1.9, 0.2]], from: 0, to: WIDE_HALF };
const SPLITTER: Slab = { points: [[2.2, 0.2], [2.2, 0.17], [1.86, 0.17], [1.86, 0.2]], from: 0, to: WIDE_HALF };
const FRONTS: Wing[] = [
  { paint: [], trim: [] },
  { paint: [], trim: [], lips: [FRONT_LIP] },
  { paint: [], trim: [], stands: [SPLITTER] },
];
const KIT: Kit = {
  outline: KIT_OUTLINE,
  width: WIDE,
  sill: 0.18,
  section: { ...SECTION, shoulder: WIDE_SHOULDER, tuck: 0 },
  // As big as fits under the bonnet, in one more facet: the deeper sill would otherwise stretch each one into the wide tyre at full lock.
  arches: { ...STOCK_ARCHES, gap: 0.08, steps: 8, flare: 0.05, out: 0.03 },
  paint: mirror(CABIN, WIDE_SHOULDER),
  trim: [{ size: [0.62, 0.14, 0.04], at: [0.3, 0.4, 2.042] }, { ...REAR_VALANCE, at: [0.45, 0.37, -2.14] }, ...TAIL.trim],
  tyre: [0.34, 0.38],
  rim: { size: 0.66, spokes: 5, tone: "metal", lip: 0.2, spoke: 0.08 },
  wings: WINGS.map((wing) => widen_wing(wing, (1 - SECTION.shoulder) / (1 - WIDE_SHOULDER))),
};

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
  trim: [{ size: [0.52, 0.11, 0.04], at: [0.25, 0.45, 1.992] }, REAR_VALANCE, ...TAIL.trim],
  markers: [],
  chrome: TAIL.chrome,
  tyre: [0.28, 0.3],
  rim: { size: 0.62, spokes: 6, tone: "metal", spoke: 0.07 },
  deck: [-2.0, 0.97],
  wings: WINGS,
  hood: [1.2, 0.8],
  exhaust: [0.55, 0.3, -2.08],
  fronts: FRONTS,
  kit: KIT,
};

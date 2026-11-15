import { cabin_mirror, gurney, hoop, kit_shoulder, leg, plane, tail_end, widen_wing } from "./design-parts";
import type { Arches, Cabin, Design, Kit, Section, Slab, Wing } from "./designs";
import type { Part, Point } from "./geometry";

const OUTLINE: Point[] = [[1.96, 0.28], [2.0, 0.34], [2.0, 0.6], [1.93, 0.675], [1.3, 0.83], [0.57, 0.93], [-1.9, 0.95], [-2.12, 0.95], [-2.13, 0.68], [-2.17, 0.64], [-2.17, 0.36], [-2.08, 0.28]];
// The body side stands over the tyres' outer faces, so the wheel openings are bare cuts in the one shell; the shoulder takes
// back what the body gained, so the body top stays as wide as the cabin on it. The tail is square in plan: pinched, it left
// the hoop's front feet inboard of the deck edge its rear feet stand on.
const WIDTH = 2.03;
const SHOULDER = kit_shoulder(1.96, 0.11, WIDTH);
const SECTION: Section = { belt: [0.77, 0.82], shoulder: SHOULDER, tuck: 0, nose: [0.1, 0.16], tail: [0, 0] };
const CABIN: Cabin = { points: [[0.57, 0.93], [-0.05, 1.26], [-0.35, 1.3], [-0.78, 1.28], [-1.9, 0.95]], width: 1.66, tumble: 0.34, frame: [0.05, 0.035, 0.035, 0.05, 0.035], screens: [[0, 0.07], [3, 0.2]] };
const TAIL = tail_end(OUTLINE, 0.79, 0.22, 0.94, [{ size: [0.46, 0.14, 0.05], at: [0.63, 0.79, 0] }], { half: 0.36, y: 0.79 }, 0.58);

const STOCK_ARCHES: Arches = { gap: 0.065, steps: 11, flare: 0, out: 0, reach: 0, tone: "paint" };
const HALF = WIDTH / 2 - 0.004;
const SPAN = HALF - 0.086;
// A lip grown out of the hatch across the whole tail, then a ducktail, then a hoop (a trim plane between two painted side
// plates swept up from the deck to the lip's end), then a trim plane on two painted legs standing in the ducktail.
// The hoop is as wide as the tail it stands on, front feet and rear on the deck's edge.
const LIP: Slab = { points: [[-1.9, 0.93], [-2.15, 1.0], [-2.17, 0.975], [-2.115, 0.88]], from: 0, to: HALF };
const DUCKTAIL: Slab = { points: [[-1.88, 0.93], [-2.15, 1.06], [-2.17, 1.035], [-2.115, 0.88]], from: 0, to: HALF };
const STREET = plane([-2.01, 1.19], 0.3, 0.045, 0.1);
const RACE = plane([-2.0, 1.31], 0.34, 0.055, 0.12);
// The race plane's endplate: a wedge along the plane, shallow at its raked leading edge and deep at the tail.
const FIN: Point[] = [[RACE[3][0] + 0.015, RACE[3][1] - 0.02], [RACE[0][0] - 0.015, RACE[0][1] + 0.03], [RACE[1][0] - 0.02, RACE[1][1] + 0.035], [RACE[2][0] - 0.005, RACE[2][1] - 0.09]];
const legs = (profile: Point[], rear: Point): Slab => ({ points: leg(profile, [-1.88, 0.925], rear), from: 0.52, to: 0.6 });
const WINGS: Wing[] = [
  { paint: [], trim: [], lips: [LIP] },
  { paint: [], trim: [], lips: [DUCKTAIL] },
  { paint: [], trim: [], lips: [LIP, { points: hoop(STREET, [-1.68, 0.93], LIP.points[2]), from: SPAN, to: HALF }], stands: [{ points: STREET, from: 0, to: SPAN }] },
  {
    paint: [],
    trim: [],
    lips: [DUCKTAIL, legs(RACE, [-2.1, 1.02])],
    stands: [{ points: RACE, from: 0, to: SPAN }, { points: gurney(RACE, 0.03), from: 0, to: SPAN }, { points: FIN, from: SPAN, to: SPAN + 0.03 }],
  },
];

const REAR_VALANCE: Part = { size: [0.9, 0.14, 0.04], at: [0.45, 0.4, -2.165] };

// The kit is the shell: 7 cm wider a side over deeper sills, with a deep upright bumper and a tail valance drawn in the outline.
// The shoulder grows by what the body widens, so the body top, and the cabin and wings on it, stay where they were.
const WIDE = 2.1;
const WIDE_SHOULDER = kit_shoulder(WIDTH, SHOULDER, WIDE);
const WIDE_HALF = WIDE / 2 + 0.004;
const CHIN: Point = [1.99, 0.18];
const KIT_OUTLINE: Point[] = [CHIN, [2.05, 0.24], [2.05, 0.54], ...OUTLINE.slice(3, -2), [-2.17, 0.24], [-2.11, 0.18]];
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
  section: { ...SECTION, shoulder: WIDE_SHOULDER },
  // As big as fit under the bonnet.
  arches: { ...STOCK_ARCHES, gap: 0.08 },
  mirror: cabin_mirror(CABIN, WIDE_SHOULDER),
  trim: [{ size: [0.62, 0.14, 0.04], at: [0.3, 0.4, 2.042] }, { ...REAR_VALANCE, at: [0.45, 0.33, -2.165] }, ...TAIL.trim],
  tyre: [0.34, 0.35],
  rim: { size: 0.66, spokes: 5, tone: "metal", lip: 0.2, spoke: 0.08 },
  wings: WINGS.map((wing) => widen_wing(wing, (1 - SECTION.shoulder) / (1 - WIDE_SHOULDER))),
};

export const KAZE_DESIGN: Design = {
  outline: OUTLINE,
  width: WIDTH,
  sill: 0.28,
  cabin: CABIN,
  section: SECTION,
  arches: STOCK_ARCHES,
  heads: [{ size: [0.36, 0.05, 0.3], at: [0.62, 0.723, 1.75], tilt: [0.24, 0, 0] }],
  tails: TAIL.tails,
  mirror: cabin_mirror(CABIN, SHOULDER),
  paint: [],
  trim: [{ size: [0.52, 0.11, 0.04], at: [0.25, 0.45, 1.992] }, REAR_VALANCE, ...TAIL.trim],
  markers: [],
  chrome: TAIL.chrome,
  tyre: [0.27, 0.28],
  rim: { size: 0.62, spokes: 6, tone: "metal", spoke: 0.07 },
  deck: [-2.0, 0.97],
  wings: WINGS,
  hood: [1.2, 0.844],
  exhaust: [0.55, 0.3, -2.1],
  fronts: FRONTS,
  kit: KIT,
};

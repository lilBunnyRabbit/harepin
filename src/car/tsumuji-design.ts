import { sculpt_factor } from "./body-shell";
import { endplate, gurney, leg, mirror, plane, tail_end, widen_wing } from "./design-parts";
import type { Arches, Cabin, Design, Kit, Section, Slab, Wing } from "./designs";
import { top_at, type Part, type Point } from "./geometry";

const OUTLINE: Point[] = [[1.93, 0.26], [1.97, 0.36], [1.96, 0.5], [1.84, 0.6], [0.62, 0.82], [-1.18, 0.825], [-1.72, 0.77], [-1.92, 0.67], [-1.97, 0.5], [-1.9, 0.27]];
const SECTION: Section = { belt: [0.7, 0.72], shoulder: 0.1, tuck: 0.04, nose: [0.2, 0.4], tail: [0.16, 0.4] };
// The hardtop: a short bubble set back on the body, its rear screen dropping steeply onto a long flat deck.
const CABIN: Cabin = { points: [[0.62, 0.82], [0.22, 1.17], [-0.2, 1.22], [-0.66, 1.2], [-1.18, 0.825]], width: 1.4, tumble: 0.22, frame: [0.05, 0.035, 0.035, 0.09, 0.035], screens: [[0, 0.07], [3, 0.12]] };
const TAIL = tail_end(OUTLINE, 0.57, 0.14, 0.72, [{ size: [0.3, 0.1, 0.05], at: [0.5, 0.57, 0] }], null, 0.57);

const STOCK_ARCHES: Arches = { gap: 0.05, steps: 7, flare: 0.05, out: 0.04, reach: 0.04, tone: "paint" };

// Pop-up lamps, drawn shut: a wedge whose top is the lid lying in the bonnet and whose face hangs inside the body, cut so
// it stands upright on the bonnet once the wedge has swung up by LIFT about the lid's rear edge.
const HINGE_Z = 1.36;
const POD_LENGTH = 0.36;
const POD_X = 0.5;
const POD_WIDTH = 0.4;
const LIFT = 0.7;
const LENS = 0.19;
const LID_PROUD = 0.016;
const hinge: Point = [HINGE_Z, top_at(OUTLINE, HINGE_Z) + LID_PROUD];
const slope = Math.atan2(top_at(OUTLINE, HINGE_Z) - top_at(OUTLINE, HINGE_Z + POD_LENGTH), POD_LENGTH);
const lid_front: Point = [hinge[0] + POD_LENGTH * Math.cos(slope), hinge[1] - POD_LENGTH * Math.sin(slope)];
const face = POD_LENGTH * (Math.sin(LIFT - slope) + Math.cos(LIFT - slope) * Math.tan(slope)) + LID_PROUD;
const face_foot: Point = [lid_front[0] - face * Math.sin(LIFT), lid_front[1] - face * Math.cos(LIFT)];
const POD: Slab = { points: [lid_front, hinge, face_foot], from: POD_X - POD_WIDTH / 2, to: POD_X + POD_WIDTH / 2 };

const HALF = 0.844;
const SPAN = 0.74;
// A lip grown out of the boot lid across the whole tail, then a ducktail, then a trim plane on two painted legs swept up out of the ducktail.
const LIP: Slab = { points: [[-1.66, 0.776], [-1.97, 0.77], [-1.99, 0.74], [-1.93, 0.65]], from: 0, to: HALF };
const DUCKTAIL: Slab = { points: [[-1.56, 0.787], [-2.01, 0.85], [-2.03, 0.82], [-1.93, 0.65]], from: 0, to: HALF };
const RACE = plane([-1.86, 1.07], 0.3, 0.05, 0.1);
const WINGS: Wing[] = [
  { paint: [], trim: [] },
  { paint: [], trim: [], lips: [LIP] },
  { paint: [], trim: [], lips: [DUCKTAIL] },
  {
    paint: [],
    trim: [],
    lips: [DUCKTAIL, { points: leg(RACE, [-1.62, 0.785], [-1.86, 0.82]), from: 0.42, to: 0.5 }, { points: endplate(RACE, 0.03, 0.06), from: SPAN, to: SPAN + 0.03 }],
    stands: [{ points: RACE, from: 0, to: SPAN }, { points: gurney(RACE, 0.025), from: 0, to: SPAN }],
  },
];

const PAINT: Part[] = mirror(CABIN, SECTION.shoulder);
const MOUTH: Part = { size: [0.34, 0.1, 0.04], at: [0.17, 0.36, 1.956] };
const TRIM: Part[] = [MOUTH, ...TAIL.trim];

// The kit is the shell: 6 cm wider a side over deeper sills, with a deep bumper and a tail valance drawn in the outline.
// The shoulder grows by what the body widens, so the body top, and the cabin and wings on it, stay where they were; the
// belt rises at the nose so the front wings cover the wide tyres.
const WIDE = 1.8;
const WIDE_SHOULDER = 1 - (1.68 * (1 - SECTION.shoulder)) / WIDE;
const WIDE_HALF = WIDE / 2 + 0.004;
const KIT_OUTLINE: Point[] = [[1.93, 0.17], [1.99, 0.23], [1.99, 0.5], ...OUTLINE.slice(3, -2), [-1.97, 0.5], [-1.97, 0.23], [-1.9, 0.17]];
// A painted lip run on from the chin, then a trim splitter under it.
const FRONT_LIP: Slab = { points: [[1.99, 0.23], [2.04, 0.195], [2.04, 0.165], [1.84, 0.165], [1.84, 0.19]], from: 0, to: WIDE_HALF };
const SPLITTER: Slab = { points: [[2.13, 0.19], [2.13, 0.16], [1.8, 0.16], [1.8, 0.19]], from: 0, to: WIDE_HALF };
const FRONTS: Wing[] = [
  { paint: [], trim: [] },
  { paint: [], trim: [], lips: [FRONT_LIP] },
  { paint: [], trim: [], stands: [SPLITTER] },
];

const BODY = {
  outline: OUTLINE,
  width: 1.68,
  sill: 0.26,
  cabin: CABIN,
  section: SECTION,
  arches: STOCK_ARCHES,
  heads: [],
  tails: TAIL.tails,
  paint: PAINT,
  trim: TRIM,
  markers: [{ size: [0.17, 0.05, 0.04], at: [0.56, 0.48, 1.946] }],
  chrome: TAIL.chrome,
  tyre: [0.2, 0.2],
  rim: { size: 0.62, spokes: 7, tone: "metal", spoke: 0.06 },
  deck: [-1.8, 0.75],
  wings: WINGS,
  hood: [1.05, 0.742],
  exhaust: [0.42, 0.3, -1.93],
  fronts: FRONTS,
} satisfies Design;

const on_face = (out: number): Point => [(lid_front[0] + face_foot[0]) / 2 + out * Math.cos(LIFT), (lid_front[1] + face_foot[1]) / 2 - out * Math.sin(LIFT)];
const bezel_at = on_face(0.004);
const lens_at = on_face(0.02);
const lens = (body: Design): Part[] => {
  const keep = sculpt_factor(body, lens_at[1], lens_at[0]);
  return [{ size: [LENS / keep, LENS, 0.04], at: [POD_X / keep, lens_at[1], lens_at[0]], tilt: [LIFT, 0, 0], round: true }];
};
const SHELL = {
  outline: KIT_OUTLINE,
  width: WIDE,
  sill: 0.17,
  section: { ...SECTION, belt: [0.76, 0.72], shoulder: WIDE_SHOULDER, tuck: 0 },
  arches: { ...STOCK_ARCHES, gap: 0.06, flare: 0.045, out: 0.03 },
  paint: mirror(CABIN, WIDE_SHOULDER),
  trim: [{ size: [0.44, 0.11, 0.04], at: [0.22, 0.36, 1.982] }, ...TAIL.trim],
  markers: [{ size: [0.17, 0.05, 0.04], at: [0.56, 0.44, 1.978] }],
  tyre: [0.25, 0.27],
  rim: { size: 0.66, spokes: 5, tone: "metal", lip: 0.22, spoke: 0.08 },
  wings: WINGS.map((wing) => widen_wing(wing, (1 - SECTION.shoulder) / (1 - WIDE_SHOULDER))),
} satisfies Kit;

export const TSUMUJI_DESIGN: Design = {
  ...BODY,
  heads: lens(BODY),
  popups: { pods: [], shells: [POD], bezels: [{ size: [POD_WIDTH - 0.05, face - 0.05, 0.012], at: [POD_X, bezel_at[1], bezel_at[0]], tilt: [LIFT, 0, 0] }], hinge, lift: LIFT },
  kit: { ...SHELL, heads: lens({ ...BODY, ...SHELL }) },
};

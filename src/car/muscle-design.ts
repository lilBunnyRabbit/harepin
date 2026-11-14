import { cabin_mirror, endplate, gurney, kit_shoulder, leg, plane, tail_end, widen_wing } from "./design-parts";
import type { Arches, Cabin, Design, Kit, Section, Slab, Wing } from "./designs";
import type { Part, Point } from "./geometry";

// The hood is level and the deck kicks up behind the door, so the cabin base sinks into the haunch at its tail.
// The hood's leading edge and the bumper reach the collision length (2.5 m); the face under the edge rakes back to a valance
// 0.6 m ahead of the front tyres, so the overhang reads short. The screen stands 0.4 m ahead of the car's middle.
const MUSCLE_RAKE = 0.36;
const MUSCLE_TOP: Point[] = [[2.5, 0.72], [2.44, 0.796], [0.4, 0.88], [-1.1, 0.88], [-1.7, 0.96], [-2.42, 0.97], [-2.52, 0.92], [-2.5, 0.5]];
const MUSCLE_OUTLINE: Point[] = [[2.28, 0.28], [2.38, 0.4], ...MUSCLE_TOP, [-2.44, 0.28]];
const MUSCLE_SECTION: Section = { belt: [0.76, 0.78], shoulder: 0.14, tuck: 0.04, nose: [0.06, 0.4], tail: [0.1, 0.5] };
const MUSCLE_CABIN: Cabin = { points: [[0.4, 0.88], [-0.3, 1.23], [-1.25, 1.25], [-1.7, 0.88]], width: 1.5, tumble: 0.22, frame: [0.08, 0.05, 0.2, 0.05], screens: [[0, 0.08], [2, 0.16]], split: [-0.85, 0.06] };
const MUSCLE_ARCHES: Arches = { gap: 0.07, steps: 7, flare: 0.06, out: 0.08, reach: 0.04, tone: "paint" };
const MUSCLE_TAIL = tail_end(MUSCLE_OUTLINE, 0.76, 0.19, 0.9, [{ size: [0.82, 0.13, 0.04], at: [0.44, 0.76, 0] }], null, 0.54);
const HOOD_FALL = 0.041;
const MUSCLE_MIRROR = cabin_mirror(MUSCLE_CABIN, MUSCLE_SECTION.shoulder);
const MUSCLE_HALF = 0.994;
const MUSCLE_PLANE = 0.9;
// A lip grown out of the boot lid across the whole tail, then a pedestal wing on two legs, the last with endplates.
const MUSCLE_LIP: Slab = { points: [[-2.2, 0.962], [-2.56, 1.04], [-2.575, 1.01], [-2.5, 0.9]], from: 0, to: MUSCLE_HALF };
const MUSCLE_DUCKTAIL: Slab = { points: [[-2.14, 0.962], [-2.6, 1.1], [-2.615, 1.07], [-2.5, 0.9]], from: 0, to: MUSCLE_HALF };
const MUSCLE_PEDESTAL = plane([-2.33, 1.14], 0.34, 0.05, 0.12);
const MUSCLE_RACE = plane([-2.35, 1.22], 0.4, 0.055, 0.14);
const muscle_legs = (profile: Point[]): Slab => ({ points: leg(profile, [-2.16, 0.95], [-2.46, 0.95]), from: 0.54, to: 0.62 });
const MUSCLE_FACE: Part = { size: [0.9, 0.26, 0.04], at: [0.45, 0.59, 2.44], tilt: [MUSCLE_RAKE, 0, 0] };
const MUSCLE_WINGS: Wing[] = [
  { paint: [], trim: [], lips: [MUSCLE_LIP] },
  { paint: [], trim: [], lips: [MUSCLE_DUCKTAIL] },
  { paint: [], trim: [], lips: [{ points: MUSCLE_PEDESTAL, from: 0, to: MUSCLE_PLANE }, muscle_legs(MUSCLE_PEDESTAL)] },
  {
    paint: [],
    trim: [],
    lips: [{ points: MUSCLE_RACE, from: 0, to: MUSCLE_PLANE }, muscle_legs(MUSCLE_RACE), { points: endplate(MUSCLE_RACE, 0.04, 0.09), from: MUSCLE_PLANE, to: MUSCLE_PLANE + 0.03 }],
    stands: [{ points: gurney(MUSCLE_RACE, 0.035), from: 0, to: MUSCLE_PLANE }],
  },
];

// The kit is the shell: 11 cm wider a side to cover the fat rear tyres, deeper sills, chin and tail valance in the outline.
const MUSCLE_WIDE = 2.2;
const MUSCLE_WIDE_SHOULDER = kit_shoulder(1.98, MUSCLE_SECTION.shoulder, MUSCLE_WIDE);
const MUSCLE_WIDE_MIRROR = cabin_mirror(MUSCLE_CABIN, MUSCLE_WIDE_SHOULDER);
const MUSCLE_KIT: Kit = {
  outline: [[2.3, 0.19], [2.36, 0.25], [2.38, 0.4], ...MUSCLE_TOP, [-2.5, 0.25], [-2.45, 0.19]],
  width: MUSCLE_WIDE,
  sill: 0.19,
  section: { ...MUSCLE_SECTION, shoulder: MUSCLE_WIDE_SHOULDER, tuck: 0 },
  arches: { ...MUSCLE_ARCHES, gap: 0.08, flare: 0.05, out: 0.03 },
  tyre: [0.34, 0.5],
  mirror: MUSCLE_WIDE_MIRROR,
  wings: MUSCLE_WINGS.map((wing) => widen_wing(wing, (1 - MUSCLE_SECTION.shoulder) / (1 - MUSCLE_WIDE_SHOULDER))),
};

export const MUSCLE_DESIGN: Design = {
  outline: MUSCLE_OUTLINE,
  width: 1.98,
  sill: 0.28,
  cabin: MUSCLE_CABIN,
  section: MUSCLE_SECTION,
  arches: MUSCLE_ARCHES,
  heads: [
    { size: [0.17, 0.15, 0.04], at: [0.74, 0.59, 2.452], tilt: [MUSCLE_RAKE, 0, 0] },
    { size: [0.17, 0.15, 0.04], at: [0.52, 0.59, 2.452], tilt: [MUSCLE_RAKE, 0, 0] },
  ],
  tails: MUSCLE_TAIL.tails,
  mirror: MUSCLE_MIRROR,
  paint: [],
  trim: [MUSCLE_FACE, ...MUSCLE_TAIL.trim],
  stripes: [
    { size: [0.12, 0.012, 0.88], at: [0.12, 0.8215, 1.94], tilt: [HOOD_FALL, 0, 0] },
    { size: [0.12, 0.012, 0.38], at: [0.12, 0.873, 0.69], tilt: [HOOD_FALL, 0, 0] },
    { size: [0.12, 0.012, 0.8], at: [0.12, 1.247, -0.825], tilt: [0.024, 0, 0] },
    { size: [0.12, 0.012, 0.6], at: [0.12, 0.972, -2.08], tilt: [0.014, 0, 0] },
  ],
  markers: [],
  chrome: [{ size: [1.0, 0.13, 0.16], at: [0.5, 0.36, 2.42] }, { size: [1.0, 0.12, 0.12], at: [0.5, 0.36, -2.5] }, ...MUSCLE_TAIL.chrome],
  tyre: [0.3, 0.42],
  rim: { size: 0.64, spokes: 5, tone: "metal", lip: 0.22, spoke: 0.08 },
  deck: [-2.2, 0.965],
  wings: MUSCLE_WINGS,
  hood: [1.85, 0.822],
  exhaust: [0.5, 0.26, -2.44],
  kit: MUSCLE_KIT,
};

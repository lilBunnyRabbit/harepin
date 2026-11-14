import { cabin_mirror, gurney, hoop, kit_shoulder, plane, tail_end, widen_wing } from "./design-parts";
import type { Arches, Cabin, Design, Kit, Section, Slab, Wing } from "./designs";
import type { Part, Point } from "./geometry";

// The wing line stands over the front tyre, so the arch lip closes under it instead of being cut off by a low bonnet.
const COUPE_TOP: Point[] = [[2.33, 0.54], [2.1, 0.65], [1.7, 0.77], [0.95, 0.84], [-2.1, 0.93], [-2.3, 0.9], [-2.34, 0.8]];
const COUPE_OUTLINE: Point[] = [[2.27, 0.3], [2.35, 0.42], ...COUPE_TOP, [-2.34, 0.42], [-2.3, 0.3]];
const COUPE_SECTION: Section = { belt: [0.62, 0.8], shoulder: 0.15, tuck: 0.04, nose: [0.2, 0.55], tail: [0.05, 0.25] };
// The fastback's edge runs within 6 degrees of the roof's: a much wider frame on it would pull the glass corner past the roof's peak.
const COUPE_CABIN: Cabin = { points: [[0.95, 0.84], [0.2, 1.17], [-0.4, 1.2], [-0.8, 1.16], [-2.0, 0.927]], width: 1.56, tumble: 0.2, frame: [0.06, 0.04, 0.04, 0.05, 0.04], screens: [[0, 0.08], [3, 0.14]], split: [-0.42, 0.08] };
const COUPE_ARCHES: Arches = { gap: 0.065, steps: 7, flare: 0.05, out: 0.04, reach: 0.04, tone: "paint" };
const COUPE_HALF = 0.944;
const COUPE_PLANE = 0.86;
// A lip grown out of the hatch across the whole tail, then a hoop: side plates swept up from the deck corners round the plane's ends.
const COUPE_LIP: Slab = { points: [[-2.02, 0.922], [-2.36, 0.985], [-2.37, 0.955], [-2.3, 0.88]], from: 0, to: COUPE_HALF };
const COUPE_DUCKTAIL: Slab = { points: [[-1.99, 0.922], [-2.4, 1.05], [-2.415, 1.02], [-2.3, 0.88]], from: 0, to: COUPE_HALF };
const COUPE_HOOP = plane([-2.25, 1.14], 0.3, 0.05, 0.1);
const COUPE_RACE = plane([-2.29, 1.31], 0.36, 0.055, 0.12);
const coupe_plates = (profile: Point[], front: number): Slab => ({ points: hoop(profile, [front, 0.915], [-2.32, 0.86]), from: COUPE_PLANE, to: COUPE_HALF });
const COUPE_WINGS: Wing[] = [
  { paint: [], trim: [], lips: [COUPE_LIP] },
  { paint: [], trim: [], lips: [COUPE_DUCKTAIL] },
  { paint: [], trim: [], lips: [{ points: COUPE_HOOP, from: 0, to: COUPE_PLANE }, coupe_plates(COUPE_HOOP, -1.98)], stands: [{ points: gurney(COUPE_HOOP, 0.03), from: 0, to: COUPE_PLANE }] },
  { paint: [], trim: [], lips: [COUPE_LIP, coupe_plates(COUPE_RACE, -1.94)], stands: [{ points: COUPE_RACE, from: 0, to: COUPE_PLANE }] },
];
// The kit is the shell: 8 cm wider a side over deeper sills, its chin and tail valance drawn in the outline. The shoulder
// grows by what the body widens, so the body top, and the cabin and wings on it, stay where they were.
const COUPE_TAIL = tail_end(COUPE_OUTLINE, 0.74, 0.2, 0.93, [{ size: [0.56, 0.12, 0.05], at: [0.58, 0.74, 0] }], { half: 0.32, y: 0.74 }, 0.55);
const COUPE_GRILLE: Part = { size: [0.34, 0.07, 0.05], at: [0.17, 0.48, 2.33] };
const COUPE_WIDE = 2.04;
const COUPE_WIDE_SHOULDER = kit_shoulder(1.88, COUPE_SECTION.shoulder, COUPE_WIDE);
const COUPE_MIRROR = cabin_mirror(COUPE_CABIN, COUPE_SECTION.shoulder);
const COUPE_WIDE_MIRROR = cabin_mirror(COUPE_CABIN, COUPE_WIDE_SHOULDER);
const COUPE_KIT: Kit = {
  outline: [[2.3, 0.19], [2.37, 0.25], [2.35, 0.42], ...COUPE_TOP, [-2.34, 0.25], [-2.28, 0.19]],
  width: COUPE_WIDE,
  sill: 0.19,
  section: { ...COUPE_SECTION, belt: [0.69, 0.8], shoulder: COUPE_WIDE_SHOULDER, tuck: 0 },
  arches: { ...COUPE_ARCHES, gap: 0.075, flare: 0.05, out: 0.03 },
  tyre: [0.32, 0.36],
  mirror: COUPE_WIDE_MIRROR,
  // The bumper bars sit on the kit's upright valances: the rear one stands proud of the tail face.
  trim: [COUPE_GRILLE, { size: [1.0, 0.12, 0.08], at: [0.5, 0.356, 2.31] }, { size: [1.0, 0.12, 0.08], at: [0.5, 0.356, -2.312] }, ...COUPE_TAIL.trim],
  wings: COUPE_WINGS.map((wing) => widen_wing(wing, (1 - COUPE_SECTION.shoulder) / (1 - COUPE_WIDE_SHOULDER))),
};

export const COUPE_DESIGN: Design = {
  outline: COUPE_OUTLINE,
  width: 1.88,
  sill: 0.3,
  cabin: COUPE_CABIN,
  section: COUPE_SECTION,
  arches: COUPE_ARCHES,
  heads: [{ size: [0.42, 0.07, 0.05], at: [0.6, 0.48, 2.335] }],
  tails: COUPE_TAIL.tails,
  mirror: COUPE_MIRROR,
  paint: [],
  trim: [
    COUPE_GRILLE,
    { size: [0.93, 0.12, 0.08], at: [0.465, 0.356, 2.3] },
    { size: [0.93, 0.12, 0.08], at: [0.465, 0.356, -2.3] },
    ...COUPE_TAIL.trim,
  ],
  markers: [],
  chrome: COUPE_TAIL.chrome,
  tyre: [0.28, 0.3],
  rim: { size: 0.68, spokes: 6, tone: "metal", lip: 0.18 },
  deck: [-2.14, 0.93],
  wings: COUPE_WINGS,
  hood: [1.5, 0.79],
  exhaust: [0.55, 0.3, -2.3],
  kit: COUPE_KIT,
};

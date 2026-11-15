import { cabin_mirror, hoop, kit_shoulder, plane, tail_end, widen_wing } from "./design-parts";
import { type Arches, type Cabin, type Design, type Kit, type Section, type Slab, type Wing } from "./designs";
import type { Part, Point } from "./geometry";

// The wing line stands over the front tyre, so the wheel opening closes under it instead of being cut off by a low bonnet.
const COUPE_TOP: Point[] = [[2.33, 0.54], [2.1, 0.65], [1.7, 0.77], [0.95, 0.84], [-2.1, 0.93], [-2.3, 0.9], [-2.34, 0.8]];
const COUPE_OUTLINE: Point[] = [[2.27, 0.3], [2.35, 0.42], ...COUPE_TOP, [-2.34, 0.42], [-2.3, 0.3]];
// The body side stands over the tyres' outer faces, so the wheel openings are bare cuts in the one shell. The shoulder takes
// back what the body gained, so the body top stays as wide as the cabin on it. The tail is square in plan: a pinch there
// folded every face that crossed it.
const COUPE_WIDTH = 1.98;
const COUPE_SHOULDER = kit_shoulder(1.88, 0.15, COUPE_WIDTH);
const COUPE_SECTION: Section = { belt: [0.76, 0.8], shoulder: COUPE_SHOULDER, tuck: 0, nose: [0.2, 0.55], tail: [0, 0] };
// The fastback's edge runs within 6 degrees of the roof's: a much wider frame on it would pull the glass corner past the roof's peak.
const COUPE_CABIN: Cabin = { points: [[0.95, 0.84], [0.2, 1.17], [-0.4, 1.2], [-0.8, 1.16], [-2.0, 0.927]], width: 1.56, tumble: 0.2, frame: [0.06, 0.04, 0.04, 0.05, 0.04], screens: [[0, 0.08], [3, 0.14]], split: [-0.42, 0.08] };
const COUPE_ARCHES: Arches = { gap: 0.065, steps: 7, flare: 0, out: 0, reach: 0, tone: "paint" };
const COUPE_HALF = COUPE_WIDTH / 2 + 0.004;
const COUPE_PLATE = 0.045;
// What a lip stands on, just under the deck and the tail's chamfer, and where its rear face runs into the tail face.
const COUPE_SEAT: Point[] = [[-2.336, 0.8], [-2.296, 0.895], [-2.1, 0.925]];
// A lip is the tail kicked up: it leaves the deck's own line and its rear face runs down into the tail face, with no underside.
const coupe_lip = (from: number, tip: Point): Slab => ({
  points: [[from, 0.84 + (0.09 * (0.95 - from)) / 3.05], tip, [tip[0] - 0.006, tip[1] - 0.03], ...COUPE_SEAT],
  from: 0,
  to: COUPE_HALF,
});
const COUPE_LIP = coupe_lip(-2.02, [-2.36, 0.99]);
const COUPE_DUCKTAIL = coupe_lip(-1.96, [-2.4, 1.05]);
const COUPE_HOOP = plane([-2.25, 1.14], 0.3, 0.045, 0.1);
const COUPE_RACE = plane([-2.25, 1.29], 0.36, 0.05, 0.12);
// A hoop: the plane between two thin plates that stand on the deck's outer edges, flush with the body top's sides.
const coupe_hoop = (profile: Point[], front: number): Slab[] => [
  { points: profile, from: 0, to: COUPE_HALF - COUPE_PLATE },
  { points: hoop(profile, [front, 0.915], [-2.325, 0.86]), from: COUPE_HALF - COUPE_PLATE, to: COUPE_HALF },
];
const coupe_strip = ([, [z, y]]: Point[], tall: number): Slab => ({ points: [[z + 0.04, y - 0.004], [z + 0.04, y + tall], [z, y + tall], [z, y]], from: 0, to: COUPE_HALF - COUPE_PLATE });
const COUPE_WINGS: Wing[] = [
  { paint: [], trim: [], lips: [COUPE_LIP] },
  { paint: [], trim: [], lips: [COUPE_DUCKTAIL] },
  { paint: [], trim: [], lips: [COUPE_LIP, ...coupe_hoop(COUPE_HOOP, -2.12)] },
  { paint: [], trim: [], lips: [COUPE_LIP, ...coupe_hoop(COUPE_RACE, -2.13)], stands: [coupe_strip(COUPE_RACE, 0.03)] },
];
// The panel ends under the belt: one that crossed it leaned in with the shoulder, its ends slanted against the upright corner.
const COUPE_TAIL = tail_end(COUPE_OUTLINE, 0.7, 0.18, 0.93, [{ size: [0.56, 0.12, 0.05], at: [0.58, 0.7, 0] }], { half: 0.32, y: 0.7 }, 0.52);
const COUPE_GRILLE: Part = { size: [0.34, 0.07, 0.05], at: [0.17, 0.48, 2.33] };
const COUPE_REACH = 0.34 + COUPE_ARCHES.gap;
const COUPE_AXLE = 1.3;
const LINE_DEEP = 0.09;
const LINE_PROUD = 0.02;
/**
 * The dark line the body stands on: a bar under the nose and one under the tail, joined along each side to the sill strip
 * between the wheel openings, so chin, sills and valance read as one band at the sill's height.
 */
function coupe_line(half: number, sill: number, nose: number, tail: number): Part[] {
  const side = (from: number, to: number): Part => ({ size: [0.03, LINE_DEEP, from - to], at: [half + LINE_PROUD - 0.015, sill, (from + to) / 2] });
  return [
    { size: [half + LINE_PROUD, LINE_DEEP, 0.08], at: [(half + LINE_PROUD) / 2, sill, nose] },
    side(nose - 0.04, COUPE_AXLE + COUPE_REACH),
    side(-COUPE_AXLE - COUPE_REACH, tail + 0.04),
    { size: [half + LINE_PROUD, LINE_DEEP, 0.08], at: [(half + LINE_PROUD) / 2, sill, tail] },
  ];
}
// The kit is the shell: 4 cm wider a side over deeper sills, its chin and tail valance drawn in the outline. The shoulder
// grows by what the body widens, so the body top, and the cabin and wings on it, stay where they were.
const COUPE_WIDE = 2.06;
const COUPE_WIDE_SHOULDER = kit_shoulder(COUPE_WIDTH, COUPE_SHOULDER, COUPE_WIDE);
const COUPE_KIT_SILL = 0.19;
const COUPE_KIT: Kit = {
  outline: [[2.3, COUPE_KIT_SILL], [2.37, 0.25], [2.35, 0.42], ...COUPE_TOP, [-2.34, 0.25], [-2.28, COUPE_KIT_SILL]],
  width: COUPE_WIDE,
  sill: COUPE_KIT_SILL,
  section: { ...COUPE_SECTION, shoulder: COUPE_WIDE_SHOULDER },
  arches: { ...COUPE_ARCHES, gap: 0.075 },
  tyre: [0.32, 0.38],
  mirror: cabin_mirror(COUPE_CABIN, COUPE_WIDE_SHOULDER),
  trim: [COUPE_GRILLE, ...coupe_line(COUPE_WIDE / 2, COUPE_KIT_SILL, 2.325, -2.305), ...COUPE_TAIL.trim],
  wings: COUPE_WINGS.map((wing) => widen_wing(wing, (1 - COUPE_SHOULDER) / (1 - COUPE_WIDE_SHOULDER))),
};
// The race splitter is a blade under the chin's dark bar, as wide as the body and bent with its nose.
const COUPE_SPLITTER: Slab = { points: [[2.2, 0.145], [2.2, 0.17], [2.5, 0.17], [2.5, 0.145]], from: 0, to: COUPE_WIDE / 2 + LINE_PROUD };

export const COUPE_DESIGN: Design = {
  outline: COUPE_OUTLINE,
  width: COUPE_WIDTH,
  sill: 0.3,
  cabin: COUPE_CABIN,
  section: COUPE_SECTION,
  arches: COUPE_ARCHES,
  heads: [{ size: [0.42, 0.07, 0.05], at: [0.6, 0.48, 2.335] }],
  tails: COUPE_TAIL.tails,
  mirror: cabin_mirror(COUPE_CABIN, COUPE_SHOULDER),
  paint: [],
  trim: [COUPE_GRILLE, ...coupe_line(COUPE_WIDTH / 2, 0.3, 2.295, -2.31), ...COUPE_TAIL.trim],
  markers: [],
  chrome: COUPE_TAIL.chrome,
  tyre: [0.28, 0.3],
  rim: { size: 0.68, spokes: 6, tone: "metal", lip: 0.18 },
  deck: [-2.14, 0.93],
  wings: COUPE_WINGS,
  fronts: [{ paint: [], trim: [] }, { paint: [], trim: [] }, { paint: [], trim: [], stands: [COUPE_SPLITTER] }],
  hood: [1.5, 0.79],
  exhaust: [0.55, 0.3, -2.3],
  kit: COUPE_KIT,
};

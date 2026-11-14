import { cabin_mirror, kit_shoulder, plane, roof_lip, tail_end } from "./design-parts";
import { roof_wing } from "./roof-ears";
import type { Cabin, Design, Kit, Section, Wing } from "./designs";
import type { Part, Point } from "./geometry";

// A supermini: the short bonnet runs into a raked screen, and the belt climbs to a steep tailgate close behind the wheels.
const RALLY_OUTLINE: Point[] = [[2.02, 0.38], [2.1, 0.5], [2.1, 0.68], [2.0, 0.76], [1.2, 0.92], [-1.6, 1.05], [-1.82, 0.92], [-1.88, 0.6], [-1.82, 0.38]];
const RALLY_SECTION: Section = { belt: [0.7, 0.94], shoulder: 0.1, tuck: 0.04, nose: [0.14, 0.35], tail: [0.08, 0.3] };
const RALLY_CABIN: Cabin = {
  points: [[1.2, 0.92], [0.4, 1.39], [-0.3, 1.43], [-1.22, 1.36], [-1.6, 1.05]],
  width: 1.5,
  tumble: 0.12,
  frame: [0.07, 0.05, 0.05, 0.08, 0.05],
  screens: [[0, 0.08], [3, 0.1]],
  split: [-0.3, 0.1],
};
const RALLY_TAIL = tail_end(RALLY_OUTLINE, 0.8, 0.26, 0.88, [{ size: [0.15, 0.26, 0.05], at: [0.78, 0.8, 0] }], null, 0.8);
const RALLY_HEAD: Part = { size: [0.3, 0.14, 0.05], at: [0.62, 0.6, 2.105] };
const RALLY_MIRROR = cabin_mirror(RALLY_CABIN, RALLY_SECTION.shoulder);
const RALLY_BUMPERS: Part[] = [
  { size: [0.52, 0.14, 0.05], at: [0.26, 0.47, 2.08] },
  { size: [0.9, 0.12, 0.06], at: [0.45, 0.45, -1.855] },
];
// The roof runs on into a spoiler whose ends run down into the screen pillars from the third level; on the last they
// also stand up as endplates and carry a second plane, so the whole wing is one painted piece with the roof.
function rally_wings(shoulder: number): Wing[] {
  const lip = (reach: number, kick: number) => roof_lip(RALLY_CABIN, shoulder, 2, 0.3, reach, kick, 0.04);
  const eared = roof_wing(RALLY_CABIN, shoulder, 2, lip(0.28, 0.04), 0.16, 0.07);
  const top = lip(0.4, 0.05);
  const race = roof_wing(RALLY_CABIN, shoulder, 2, top, 0.24, 0.07, 0.24);
  const upper = plane([top.tip[0] + 0.14, top.tip[1] + 0.2], 0.3, 0.045, 0.12);
  return [
    { paint: [], trim: [], lips: [lip(0.12, 0).lip] },
    { paint: [], trim: [], lips: [lip(0.2, 0.02).lip] },
    { paint: [], trim: [], lips: [eared.lip, eared.ear] },
    { paint: [], trim: [], lips: [race.lip, race.ear, { points: upper, from: 0, to: race.inner }] },
  ];
}
// The kit is the shell: 7 cm wider a side over deeper sills, chin and tail valance in the outline, the black arch trims kept thin.
const RALLY_WIDE = 1.94;
const RALLY_WIDE_SHOULDER = kit_shoulder(1.8, RALLY_SECTION.shoulder, RALLY_WIDE);
const RALLY_WIDE_MIRROR = cabin_mirror(RALLY_CABIN, RALLY_WIDE_SHOULDER);
const RALLY_KIT: Kit = {
  outline: [[2.04, 0.3], [2.1, 0.36], [2.1, 0.5], [2.1, 0.68], [2.0, 0.76], [1.2, 0.92], [-1.6, 1.05], [-1.82, 0.92], [-1.88, 0.6], [-1.88, 0.36], [-1.83, 0.3]],
  width: RALLY_WIDE,
  sill: 0.3,
  section: { ...RALLY_SECTION, shoulder: RALLY_WIDE_SHOULDER, tuck: 0 },
  arches: { gap: 0.09, steps: 11, flare: 0.07, out: 0.03, reach: 0.04, tone: "trim" },
  tyre: [0.3, 0.3],
  rim: { size: 0.62, spokes: 6, tone: "light", spoke: 0.07 },
  mirror: RALLY_WIDE_MIRROR,
  wings: rally_wings(RALLY_WIDE_SHOULDER),
};

export const RALLY_DESIGN: Design = {
  outline: RALLY_OUTLINE,
  width: 1.8,
  sill: 0.38,
  cabin: RALLY_CABIN,
  section: RALLY_SECTION,
  arches: { gap: 0.07, steps: 11, flare: 0.07, out: 0.05, reach: 0.04, tone: "trim" },
  heads: [RALLY_HEAD],
  tails: RALLY_TAIL.tails,
  mirror: RALLY_MIRROR,
  paint: [],
  trim: [...RALLY_BUMPERS, ...RALLY_TAIL.trim],
  markers: [],
  chrome: RALLY_TAIL.chrome,
  tyre: [0.24, 0.24],
  rim: { size: 0.58, spokes: 5, tone: "metal", spoke: 0.07 },
  deck: [-1.22, 1.36],
  hood: [1.6, 0.84],
  exhaust: [0.55, 0.4, -1.85],
  wings: rally_wings(RALLY_SECTION.shoulder),
  kit: RALLY_KIT,
};

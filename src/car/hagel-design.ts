import { cabin_mirror, kit_shoulder, roof_lip, tail_end } from "./design-parts";
import { roof_wing } from "./roof-ears";
import type { Arches, Cabin, Design, Kit, Section, Wing } from "./designs";
import type { Part, Point } from "./geometry";

// An 80s rally hatch drawn with a ruler: an upright nose close ahead of the wheels, a level belt, a long flat roof and a squared tail.
const HAGEL_OUTLINE: Point[] = [[1.92, 0.38], [1.99, 0.48], [1.99, 0.74], [1.93, 0.8], [0.98, 0.9], [-1.74, 0.94], [-1.9, 0.9], [-1.94, 0.56], [-1.88, 0.38]];
const HAGEL_SECTION: Section = { belt: [0.72, 0.8], shoulder: 0.06, tuck: 0.03, nose: [0.08, 0.25], tail: [0.05, 0.2] };
const HAGEL_CABIN: Cabin = {
  points: [[0.98, 0.9], [0.42, 1.4], [-1.42, 1.42], [-1.74, 0.94]],
  width: 1.52,
  tumble: 0.09,
  frame: [0.07, 0.05, 0.1, 0.05],
  screens: [[0, 0.08], [2, 0.1]],
  split: [-0.3, 0.1],
};
// Body-colour box flares, wider than the Rally's thin black lips.
const HAGEL_ARCHES: Arches = { gap: 0.07, steps: 11, flare: 0.1, out: 0.085, reach: 0.04, tone: "paint" };
// One lamp band across the tail: a block each side and a reflector strip between them, the plate down on the bumper.
const HAGEL_TAIL = tail_end(HAGEL_OUTLINE, 0.74, 0.22, 0.86, [{ size: [0.26, 0.16, 0.05], at: [0.72, 0.74, 0] }], { half: 0.58, y: 0.74, h: 0.05 }, 0.56);
const HAGEL_HEAD: Part = { size: [0.38, 0.15, 0.05], at: [0.61, 0.63, 1.985] };
const HAGEL_MIRROR = cabin_mirror(HAGEL_CABIN, HAGEL_SECTION.shoulder);
const HAGEL_BARS: Part[] = [
  { size: [0.42, 0.13, 0.04], at: [0.21, 0.63, 1.985] },
  { size: [0.86, 0.14, 0.07], at: [0.43, 0.47, 1.975] },
  { size: [0.88, 0.14, 0.07], at: [0.44, 0.47, -1.915] },
];
// The roof runs on into a square spoiler; from the third level its ends run down the screen pillars, and on the last they stand a little proud as endplates.
function hagel_wings(shoulder: number): Wing[] {
  const lip = (reach: number, kick: number) => roof_lip(HAGEL_CABIN, shoulder, 1, 0.3, reach, kick, 0.04);
  const eared = (reach: number, kick: number, drop: number, rise: number): Wing => {
    const { lip: mid, ear } = roof_wing(HAGEL_CABIN, shoulder, 1, lip(reach, kick), drop, 0.07, rise);
    return { paint: [], trim: [], lips: [mid, ear] };
  };
  return [
    { paint: [], trim: [], lips: [lip(0.1, 0).lip] },
    { paint: [], trim: [], lips: [lip(0.18, 0.02).lip] },
    eared(0.26, 0.04, 0.16, 0),
    eared(0.36, 0.06, 0.26, 0.08),
  ];
}
// The kit is the shell: 7 cm wider a side over deeper sills, chin and tail valance in the outline.
const HAGEL_WIDE = 1.94;
const HAGEL_WIDE_SHOULDER = kit_shoulder(1.8, HAGEL_SECTION.shoulder, HAGEL_WIDE);
const HAGEL_KIT: Kit = {
  outline: [[1.94, 0.3], [2.0, 0.36], [1.99, 0.48], [1.99, 0.74], [1.93, 0.8], [0.98, 0.9], [-1.74, 0.94], [-1.9, 0.9], [-1.94, 0.56], [-1.94, 0.36], [-1.89, 0.3]],
  width: HAGEL_WIDE,
  sill: 0.3,
  section: { ...HAGEL_SECTION, shoulder: HAGEL_WIDE_SHOULDER, tuck: 0 },
  arches: { ...HAGEL_ARCHES, gap: 0.09, out: 0.03 },
  tyre: [0.3, 0.3],
  rim: { size: 0.62, spokes: 6, tone: "light", spoke: 0.06 },
  mirror: cabin_mirror(HAGEL_CABIN, HAGEL_WIDE_SHOULDER),
  wings: hagel_wings(HAGEL_WIDE_SHOULDER),
};

export const HAGEL_DESIGN: Design = {
  outline: HAGEL_OUTLINE,
  width: 1.8,
  sill: 0.38,
  cabin: HAGEL_CABIN,
  section: HAGEL_SECTION,
  arches: HAGEL_ARCHES,
  heads: [HAGEL_HEAD],
  tails: HAGEL_TAIL.tails,
  mirror: HAGEL_MIRROR,
  paint: [],
  trim: [...HAGEL_BARS, ...HAGEL_TAIL.trim],
  markers: [],
  chrome: HAGEL_TAIL.chrome,
  tyre: [0.24, 0.24],
  rim: { size: 0.58, spokes: 4, tone: "metal", spoke: 0.1 },
  deck: [-1.44, 1.45],
  hood: [1.45, 0.85],
  exhaust: [0.55, 0.4, -1.9],
  wings: hagel_wings(HAGEL_SECTION.shoulder),
  kit: HAGEL_KIT,
};

import { cabin_mirror, roof_lip, tail_end } from "./design-parts";
import { kit_shoulder, type Arches, type Cabin, type Design, type Kit, type Section, type Wing } from "./designs";
import type { Part, Point } from "./geometry";

const HATCH_OUTLINE: Point[] = [[1.9, 0.3], [1.96, 0.46], [1.95, 0.68], [1.86, 0.77], [1.0, 0.88], [-1.82, 0.93], [-1.95, 0.93], [-1.98, 0.62], [-1.93, 0.3]];
const HATCH_SECTION: Section = { belt: [0.7, 0.76], shoulder: 0.1, tuck: 0.04, nose: [0.14, 0.31], tail: [0.07, 0.13] };
const HATCH_CABIN: Cabin = { points: [[1.0, 0.88], [0.3, 1.3], [-1.28, 1.33], [-1.84, 0.93]], width: 1.5, tumble: 0.14, frame: [0.06, 0.05, 0.14, 0.04], screens: [[0, 0.08], [2, 0.12]], split: [-0.25, 0.1] };
const HATCH_ARCHES: Arches = { gap: 0.055, steps: 7, flare: 0.07, out: 0.06, reach: 0.04, tone: "trim" };
const HATCH_TAIL = tail_end(HATCH_OUTLINE, 0.72, 0.34, 0.84, [{ size: [0.18, 0.3, 0.05], at: [0.72, 0.72, 0] }], { half: 0.54, y: 0.84 }, 0.68);
// The roof runs on into a spoiler that grows with each level, the last two fenced at the ends.
function hatch_wings(shoulder: number): Wing[] {
  const lip = (reach: number, kick: number) => roof_lip(HATCH_CABIN, shoulder, 1, 0.3, reach, kick, 0.04);
  const [fenced, race] = [lip(0.32, 0.05), lip(0.42, 0.08)];
  return [
    { paint: [], trim: [], lips: [lip(0.14, 0.01).lip] },
    { paint: [], trim: [], lips: [lip(0.24, 0.03).lip] },
    { paint: [], trim: [], lips: [fenced.lip, fenced.fence(0.12)] },
    { paint: [], trim: [], lips: [race.lip, race.fence(0.2)] },
  ];
}
const HATCH_MIRROR = cabin_mirror(HATCH_CABIN, HATCH_SECTION.shoulder);
const HATCH_BARS = (front: number, rear: number): Part[] => [
  { size: [0.25, 0.12, 0.05], at: [0.125, 0.6, 1.95] },
  { size: [0.88, 0.14, 0.1], at: [0.44, 0.38, front] },
  { size: [0.88, 0.14, 0.1], at: [0.44, 0.38, rear] },
  ...HATCH_TAIL.trim,
];
// The kit is the shell: 7 cm wider a side over deeper sills, chin and tail valance in the outline, the black arch trims kept thin.
const HATCH_WIDE = 1.84;
const HATCH_WIDE_SHOULDER = kit_shoulder(1.7, HATCH_SECTION.shoulder, HATCH_WIDE);
const HATCH_WIDE_MIRROR = cabin_mirror(HATCH_CABIN, HATCH_WIDE_SHOULDER);
const HATCH_KIT: Kit = {
  outline: [[1.92, 0.2], [1.98, 0.26], [1.96, 0.46], [1.95, 0.68], [1.86, 0.77], [1.0, 0.88], [-1.82, 0.93], [-1.95, 0.93], [-1.98, 0.62], [-1.98, 0.26], [-1.93, 0.2]],
  width: HATCH_WIDE,
  sill: 0.2,
  section: { ...HATCH_SECTION, shoulder: HATCH_WIDE_SHOULDER, tuck: 0 },
  arches: { ...HATCH_ARCHES, gap: 0.065, flare: 0.06, out: 0.03 },
  tyre: [0.28, 0.28],
  mirror: HATCH_WIDE_MIRROR,
  trim: HATCH_BARS(1.94, -1.96),
  wings: hatch_wings(HATCH_WIDE_SHOULDER),
};

export const HATCH_DESIGN: Design = {
  outline: HATCH_OUTLINE,
  width: 1.7,
  sill: 0.3,
  cabin: HATCH_CABIN,
  section: HATCH_SECTION,
  arches: HATCH_ARCHES,
  heads: [{ size: [0.34, 0.16, 0.05], at: [0.56, 0.6, 1.95] }],
  tails: HATCH_TAIL.tails,
  mirror: HATCH_MIRROR,
  paint: [],
  trim: HATCH_BARS(1.93, -1.95),
  markers: [],
  chrome: HATCH_TAIL.chrome,
  tyre: [0.24, 0.24],
  rim: { size: 0.64, spokes: 5, tone: "metal", spoke: 0.07 },
  deck: [-1.3, 1.37],
  hood: [1.35, 0.8],
  exhaust: [0.5, 0.32, -1.92],
  wings: hatch_wings(HATCH_SECTION.shoulder),
  kit: HATCH_KIT,
};

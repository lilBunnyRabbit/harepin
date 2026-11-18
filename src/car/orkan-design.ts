import { cabin_mirror, gurney, tail_end, widen_wing } from "./design-parts";
import type { Cabin, Design, Kit, Slab, Wing } from "./designs";
import type { Part, Point } from "./geometry";
import { MUSCLE_ARCHES, MUSCLE_HALF, MUSCLE_SECTION, MUSCLE_SHOULDER, MUSCLE_TOP, MUSCLE_WIDE, MUSCLE_WIDE_SHOULDER, MUSCLE_WIDTH, MUSCLE_WINGS, muscle_bumpers, muscle_lip } from "./muscle-design";

const ORKAN_RAKE = 0.197;
const ORKAN_TOP: Point[] = [[2.5, 0.7], ...MUSCLE_TOP.slice(1)];
const ORKAN_OUTLINE: Point[] = [[2.36, 0.28], [2.44, 0.4], ...ORKAN_TOP, [-2.44, 0.28]];
// The Muscle's platform under a fastback: the base needs a floor, or its straight edge would hang over the deck's kick.
const ORKAN_CABIN: Cabin = {
  points: [[0.2, 0.88], [-0.45, 1.21], [-1.0, 1.2], [-2.1, 0.966]],
  width: 1.5,
  tumble: 0.22,
  frame: [0.08, 0.05, 0.06, 0.05],
  screens: [[0, 0.08], [2, 0.14]],
  glass_to: -1.25,
  floor: [[-1.7, 0.95], [-1.1, 0.87]],
};
const ORKAN_MIRROR = cabin_mirror(ORKAN_CABIN, MUSCLE_SHOULDER);
const ORKAN_TAIL = tail_end(ORKAN_OUTLINE, 0.76, 0.19, 0.9, [0.34, 0.56, 0.78].map((x): Part => ({ size: [0.18, 0.13, 0.04], at: [x, 0.76, 0] })), null, 0.54);

const HIP_PROUD = 0.045;
// It stands this far off the body side, so the walls of its wheel opening never lie on the body's own.
const HIP_SEAM = 0.004;
const LIFT = 0.005;
// Its front edge runs up inside the wheel opening, so the swell starts at the arch instead of at a step in the door.
const hip = (half: number, sill: number): Slab => ({
  points: [[-1.0, sill + LIFT], [-1.0, 0.4], [-1.22, 0.8], [-1.45, 0.9], [-1.7, 0.945], [-2.2, 0.955], [-2.36, 0.9], [-2.36, 0.45], [-2.05, sill + LIFT]],
  from: half + HIP_SEAM,
  to: half + HIP_PROUD,
  roll: { low: 0.6, high: 0.955, in: HIP_PROUD - 2 * HIP_SEAM },
});

const FACE_Y = 0.57;
const FACE_Z = 2.44 + (0.06 * (FACE_Y - 0.4)) / 0.3;
const on_face = (part: Part, proud: number): Part => ({ ...part, at: [part.at[0], FACE_Y, FACE_Z + proud - part.size[2] / 2], tilt: [ORKAN_RAKE, 0, 0] });
const ORKAN_FACE = on_face({ size: [0.96, 0.24, 0.04], at: [0.48, 0, 0] }, 0.009);
const ORKAN_BEAK = on_face({ size: [0.07, 0.27, 0.07], at: [0.035, 0, 0] }, 0.03);
const ORKAN_HEAD = on_face({ size: [0.2, 0.2, 0.04], at: [0.8, 0, 0], round: true }, 0.021);

const duck = (from: number, tip: Point, flap = 0): Wing => {
  const lip = muscle_lip(from, tip);
  return { paint: [], trim: [], lips: [lip], stands: flap ? [{ points: gurney(lip.points, flap), from: 0, to: MUSCLE_HALF - 0.02 }] : undefined };
};
const ORKAN_WINGS: Wing[] = [duck(-2.16, [-2.58, 1.07]), duck(-2.14, [-2.61, 1.11]), duck(-2.12, [-2.64, 1.15], 0.035), MUSCLE_WINGS[3]];

const ORKAN_KIT: Kit = {
  outline: [[2.33, 0.19], [2.42, 0.25], [2.44, 0.4], ...ORKAN_TOP, [-2.5, 0.25], [-2.45, 0.19]],
  width: MUSCLE_WIDE,
  sill: 0.19,
  section: { ...MUSCLE_SECTION, shoulder: MUSCLE_WIDE_SHOULDER },
  arches: { ...MUSCLE_ARCHES, gap: 0.08 },
  slabs: [hip(MUSCLE_WIDE / 2, 0.19)],
  tyre: [0.34, 0.44],
  mirror: cabin_mirror(ORKAN_CABIN, MUSCLE_WIDE_SHOULDER),
  chrome: [...muscle_bumpers(MUSCLE_WIDE / 2), ...ORKAN_TAIL.chrome],
  wings: ORKAN_WINGS.map((wing) => widen_wing(wing, (1 - MUSCLE_SHOULDER) / (1 - MUSCLE_WIDE_SHOULDER))),
};

export const ORKAN_DESIGN: Design = {
  outline: ORKAN_OUTLINE,
  width: MUSCLE_WIDTH,
  sill: 0.28,
  cabin: ORKAN_CABIN,
  section: MUSCLE_SECTION,
  arches: MUSCLE_ARCHES,
  slabs: [hip(MUSCLE_WIDTH / 2, 0.28)],
  heads: [ORKAN_HEAD],
  tails: ORKAN_TAIL.tails,
  mirror: ORKAN_MIRROR,
  paint: [ORKAN_BEAK],
  trim: [ORKAN_FACE, ...ORKAN_TAIL.trim],
  markers: [],
  chrome: [...muscle_bumpers(MUSCLE_WIDTH / 2), ...ORKAN_TAIL.chrome],
  tyre: [0.3, 0.34],
  rim: { size: 0.64, spokes: 5, tone: "light", lip: 0.16, spoke: 0.07 },
  deck: [-2.2, 0.965],
  wings: ORKAN_WINGS,
  hood: [1.85, 0.822],
  exhaust: [0.5, 0.26, -2.44],
  kit: ORKAN_KIT,
};

import { endplate, gurney, hoop, leg, mirror, plane, tail_end } from "./design-parts";
import type { Cabin, Design, Section, Slab, Wing } from "./designs";
import type { Triple } from "./cars";
import type { Point } from "./geometry";

const OUTLINE: Point[] = [[1.96, 0.22], [2.04, 0.4], [2.14, 0.76], [2.08, 0.84], [0.82, 1.0], [-1.95, 1.12], [-2.38, 1.13], [-2.43, 1.06], [-2.42, 0.4], [-2.34, 0.24]];
const SECTION: Section = { belt: [1.16, 1.16], shoulder: 0, tuck: 0.03, nose: [0.12, 0.4], tail: [0.1, 0.35] };
const CABIN: Cabin = {
  points: [[0.82, 1.0], [0.05, 1.44], [-0.5, 1.48], [-1.25, 1.46], [-1.95, 1.12]],
  width: 1.5,
  tumble: 0.14,
  frame: [0.06, 0.04, 0.04, 0.12, 0.04],
  screens: [[0, 0.08], [3, 0.13]],
  split: [-0.55, 0.09],
};
// One slim band across the boot lid, a lamp at each end of it; the plate sits lower on the bumper, between the tailpipes.
const TAIL = tail_end(OUTLINE, 0.99, 0.12, 0.9, [{ size: [0.42, 0.09, 0.05], at: [0.67, 0.99, 0] }], null, 0.6);
const PIPE: Triple = [0.5, 0.33, -2.4];
const DECK = 1.105;
const HALF = 0.88;
const slab_of = (points: Point[], from: number, to: number): Slab => ({ points, from, to });
// The saloon's own boot wing: a plane between two pedestals that stand on the deck's outer edges and wrap its ends.
const BOOT = plane([-2.23, 1.27], 0.26, 0.045, 0.06);
const TALL = plane([-2.24, 1.34], 0.3, 0.045, 0.08);
const pedestal = (profile: Point[], front: number): Slab => slab_of(hoop(profile, [front, DECK], [-2.39, DECK]), 0.795, HALF);
// Past that a trim plane on swept plate uprights, a painted endplate outside each end.
const GT = plane([-2.27, 1.45], 0.34, 0.05, 0.1);
const RACE = plane([-2.3, 1.6], 0.4, 0.055, 0.12);
const SPAN = 0.855;
const bolt_on = (profile: Point[], front: number, above: number, below: number): Wing => ({
  paint: [],
  trim: [],
  lips: [slab_of(endplate(profile, above, below), SPAN, HALF)],
  stands: [slab_of(profile, 0, SPAN), slab_of(gurney(profile, 0.025), 0, SPAN), slab_of(leg(profile, [front, DECK], [-2.34, DECK]), 0.43, 0.46)],
});
const WINGS: Wing[] = [
  { paint: [], trim: [], lips: [slab_of(BOOT, 0, 0.795), pedestal(BOOT, -2.0)] },
  { paint: [], trim: [], lips: [slab_of(TALL, 0, 0.795), pedestal(TALL, -1.98)], stands: [slab_of(gurney(TALL, 0.025), 0, 0.795)] },
  bolt_on(GT, -2.04, 0.05, 0.09),
  bolt_on(RACE, -2.0, 0.07, 0.13),
];
const NOSE_LEAN = 0.27;
const HOOD_FALL = 0.126;

export const RAIJIN_DESIGN: Design = {
  outline: OUTLINE,
  width: 1.78,
  sill: 0.26,
  cabin: CABIN,
  section: SECTION,
  arches: { gap: 0.07, steps: 7, flare: 0.06, out: 0.07, reach: 0.04, tone: "paint" },
  heads: [{ size: [0.36, 0.09, 0.05], at: [0.62, 0.72, 2.13], tilt: [NOSE_LEAN, 0, 0] }],
  tails: TAIL.tails,
  paint: mirror(CABIN, SECTION.shoulder),
  trim: [
    { size: [0.46, 0.3, 0.05], at: [0.23, 0.55, 2.085], tilt: [NOSE_LEAN, 0, 0] },
    { size: [0.2, 0.03, 0.34], at: [0.46, 0.929, 1.4], tilt: [HOOD_FALL, 0, 0] },
    { size: [0.3, 0.17, 0.05], at: [PIPE[0], PIPE[1], -2.39], tilt: [-0.46, 0, 0] },
    ...TAIL.trim,
  ],
  markers: [],
  chrome: [...TAIL.chrome, { size: [0.12, 0.12, 0.1], at: [PIPE[0], PIPE[1], -2.4], round: true }],
  tyre: [0.28, 0.28],
  rim: { size: 0.72, spokes: 5, tone: "metal", spoke: 0.09 },
  round: 12,
  deck: [-2.2, 1.12],
  hood: [1.45, 0.92],
  exhaust: PIPE,
  wings: WINGS,
  kit: {
    arches: { gap: 0.085, steps: 7, flare: 0.08, out: 0.1, reach: 0.04, tone: "paint" },
    tyre: [0.34, 0.34],
    rim: { size: 0.8, spokes: 5, tone: "bronze", spoke: 0.1 },
    caliper: "warning",
  },
};

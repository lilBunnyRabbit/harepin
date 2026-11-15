import { cabin_mirror, endplate, gurney, hoop, plane, tail_end, widen_wing } from "./design-parts";
import type { Cabin, Design, Kit, Section, Slab, Wing } from "./designs";
import type { Triple } from "./cars";
import type { Part, Point } from "./geometry";

const WIDTH = 1.78;
// Shared by the stock shell and the kit: the grille face up to the bonnet lip, the body top, the tail down to the bumper.
const TOP: Point[] = [[2.14, 0.76], [2.08, 0.84], [0.82, 1.0], [-1.95, 1.12], [-2.38, 1.13], [-2.43, 1.06], [-2.43, 0.5]];
const NOSE = 2.1;
const BUMPER = -2.47;
// A bumper bar stands proud at each end, the grille set back over the front one.
const OUTLINE: Point[] = [[2.02, 0.22], [NOSE, 0.27], [NOSE, 0.4], [2.05, 0.44], ...TOP, [BUMPER, 0.46], [BUMPER, 0.29], [-2.4, 0.22]];
const PINCH = { nose: [0.12, 0.4], tail: [0.1, 0.35] } satisfies Partial<Section>;
// The belt rises to the tail under a chamfered shoulder.
const BELT: Point = [0.8, 1.0];
const SECTION: Section = { belt: BELT, shoulder: 0.07, tuck: 0.03, ...PINCH };
const CABIN: Cabin = {
  points: [[0.82, 1.0], [0.05, 1.44], [-0.5, 1.48], [-1.25, 1.46], [-1.95, 1.12]],
  width: 1.5,
  tumble: 0.14,
  frame: [0.06, 0.04, 0.04, 0.12, 0.04],
  screens: [[0, 0.08], [3, 0.13]],
  split: [-0.55, 0.09],
};

// The kit is the shell: 8 cm wider a side under a shoulder that keeps the body top where it was, sills down to 0.19,
// a deeper bumper bar at each end.
const KIT_WIDTH = 1.94;
const WIDER = KIT_WIDTH / WIDTH;
const KIT_SHOULDER = 1 - (1 - SECTION.shoulder) / WIDER;
const KIT_NOSE = 2.17;
const KIT_BUMPER = -2.49;
const KIT_OUTLINE: Point[] = [[2.06, 0.19], [KIT_NOSE, 0.25], [KIT_NOSE, 0.4], [2.06, 0.44], ...TOP, [KIT_BUMPER, 0.46], [KIT_BUMPER, 0.26], [-2.42, 0.19]];

const NOSE_LEAN = 0.27;
const HOOD_FALL = 0.126;
const PIPE: Triple = [0.5, 0.345, BUMPER + 0.01];
// Bar intakes are 4 cm deep and show 3 mm of it: openings in the bar's face, not blocks standing on it.
const INSET = 0.017;

// Four round lamps on one dark panel with the plate between them, `k` wider than drawn for the stock body.
function tail_of(outline: Point[], k: number) {
  const lamp = (x: number, across: number): Part => ({ size: [across, across, 0.05], at: [x * k, 0.96, 0], round: true });
  return tail_end(outline, 0.96, 0.25, 0.9 * k, [lamp(0.71, 0.2), lamp(0.47, 0.15)], null, 0.96);
}

// Grille, a vent each side of the engine bulge, an intake row in the front bar and one strip in the rear bar that holds both pipes.
function trim_of(tail: ReturnType<typeof tail_of>, nose: number, bumper: number, k: number): Part[] {
  return [
    { size: [0.46, 0.23, 0.05], at: [0.23, 0.585, 2.072], tilt: [NOSE_LEAN, 0, 0] },
    { size: [0.2, 0.03, 0.34], at: [0.46, 0.929, 1.4], tilt: [HOOD_FALL, 0, 0] },
    { size: [0.5, 0.07, 0.04], at: [0.25, 0.335, nose - INSET] },
    { size: [0.17 * k, 0.07, 0.04], at: [0.7 * k, 0.335, nose - INSET] },
    { size: [0.76 * k, 0.12, 0.04], at: [0.38 * k, PIPE[1], bumper + INSET] },
    ...tail.trim,
  ];
}

const tip = (bumper: number): Part => ({ size: [0.12, 0.12, 0.1], at: [PIPE[0], PIPE[1], bumper - 0.01], round: true });
const heads = (k: number): Part[] => [{ size: [0.36 * k, 0.09, 0.05], at: [0.62 * k, 0.72, 2.13], tilt: [NOSE_LEAN, 0, 0] }];

const TAIL = tail_of(OUTLINE, 1);
const KIT_TAIL = tail_of(KIT_OUTLINE, WIDER);

const DECK = 1.105;
const HALF = WIDTH / 2;
// Risers fill the deck's outer 5 cm and stand square to the car, as wide as the body is at their rear foot: the tail
// pinches under them, so the front foot stands just inside the deck edge and the rear foot on it.
const INNER = HALF - 0.05;
const FOOT = -2.06;
const slab_of = (points: Point[], from: number, to: number, straight?: number): Slab => ({ points, from, to, straight });
const BOOT_HEEL = -2.39;
// The saloon's own boot wing: a plane between two pedestals grown out of the deck corners, which wrap its ends.
const BOOT = plane([-2.29, 1.26], 0.24, 0.045, 0.06);
const TALL = plane([-2.3, 1.33], 0.27, 0.045, 0.1);
const boot_wing = (profile: Point[], kick: number): Wing => ({
  paint: [],
  trim: [],
  lips: [slab_of(profile, 0, INNER, BOOT_HEEL), slab_of(hoop(profile, [FOOT, DECK], [BOOT_HEEL, DECK]), INNER, HALF, BOOT_HEEL), ...(kick > 0 ? [slab_of(gurney(profile, kick), 0, HALF, BOOT_HEEL)] : [])],
});
// Past that a trim plane between two painted risers: each a leg standing on the deck corner that widens into the
// plane's endplate, one outline.
const GT = plane([-2.33, 1.44], 0.32, 0.05, 0.1);
const RACE = plane([-2.34, 1.56], 0.38, 0.055, 0.12);
function riser(profile: Point[], above: number, below: number, foot: number): Point[] {
  const [low, top, back, under] = endplate(profile, above, below);
  const heel: Point = [FOOT - foot, DECK];
  return [[FOOT, DECK], low, top, back, under, [heel[0] - 0.07, under[1] - 0.05], heel];
}
const swept_wing = (profile: Point[], above: number, below: number, foot: number): Wing => ({
  paint: [],
  trim: [],
  lips: [slab_of(riser(profile, above, below, foot), INNER, HALF, FOOT - foot)],
  stands: [slab_of(profile, 0, INNER, FOOT - foot), slab_of(gurney(profile, 0.025), 0, INNER, FOOT - foot)],
});
const WINGS: Wing[] = [boot_wing(BOOT, 0), boot_wing(TALL, 0.03), swept_wing(GT, 0.04, 0.07, 0.14), swept_wing(RACE, 0.06, 0.1, 0.16)];

// Front pieces come only with the kit: the lip fills the undercut below its bumper bar, so the chin runs on down from the
// bar's face, and the splitter is a blade under that chin.
const CHIN = slab_of([[KIT_NOSE, 0.25], [2.2, 0.21], [2.2, 0.17], [1.9, 0.17], [1.9, 0.19], [2.06, 0.19]], 0, KIT_WIDTH / 2);
const BLADE = slab_of([[2.3, 0.15], [2.3, 0.17], [1.86, 0.17], [1.86, 0.15]], 0, KIT_WIDTH / 2 + 0.004);
const FRONTS: Wing[] = [
  { paint: [], trim: [] },
  { paint: [], trim: [], lips: [CHIN] },
  { paint: [], trim: [], lips: [CHIN], stands: [BLADE] },
];

const KIT: Kit = {
  outline: KIT_OUTLINE,
  width: KIT_WIDTH,
  sill: 0.19,
  section: { belt: BELT, shoulder: KIT_SHOULDER, tuck: 0, ...PINCH },
  arches: { gap: 0.085, steps: 7, flare: 0.05, out: 0.03, reach: 0.04, tone: "paint" },
  heads: heads(WIDER),
  tails: KIT_TAIL.tails,
  mirror: cabin_mirror(CABIN, KIT_SHOULDER),
  trim: trim_of(KIT_TAIL, KIT_NOSE, KIT_BUMPER, WIDER),
  chrome: [...KIT_TAIL.chrome, tip(KIT_BUMPER)],
  wings: WINGS.map((wing) => widen_wing(wing, (1 - SECTION.shoulder) / (1 - KIT_SHOULDER))),
  tyre: [0.34, 0.34],
  rim: { size: 0.8, spokes: 5, tone: "bronze", spoke: 0.1 },
  caliper: "warning",
};

export const RAIJIN_DESIGN: Design = {
  outline: OUTLINE,
  width: WIDTH,
  sill: 0.26,
  cabin: CABIN,
  section: SECTION,
  arches: { gap: 0.07, steps: 7, flare: 0.06, out: 0.07, reach: 0.04, tone: "paint" },
  heads: heads(1),
  tails: TAIL.tails,
  mirror: cabin_mirror(CABIN, SECTION.shoulder),
  paint: [],
  trim: trim_of(TAIL, NOSE, BUMPER, 1),
  markers: [],
  chrome: [...TAIL.chrome, tip(BUMPER)],
  tyre: [0.28, 0.28],
  rim: { size: 0.72, spokes: 5, tone: "metal", spoke: 0.09 },
  deck: [-2.2, 1.12],
  hood: [1.45, 0.92],
  exhaust: PIPE,
  wings: WINGS,
  fronts: FRONTS,
  kit: KIT,
};

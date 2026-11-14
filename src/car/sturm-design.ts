import { cabin_mirror, endplate, glass_corner, gurney, leg, plane, tail_end } from "./design-parts";
import type { Arches, Cabin, Design, Kit, Section, Slab, Wing } from "./designs";
import { split, type Part, type Point } from "./geometry";

const HALF = 0.99;
const KIT_HALF = 1.06;
// Over both arch openings, so neither cuts into the shoulder.
const BELT = 0.765;
const CREST = 0.905;
const SHOULDER = 0.16;
// The kit's wider body leans in further, so its top (wing crowns, hip crests) stays where the stock one is.
const KIT_SHOULDER = 1 - (HALF * (1 - SHOULDER)) / KIT_HALF;
const NOSE_PINCH = 0.5;
const TAIL_PINCH = 0.46;
const NOSE = 2.28;

// The hips are the outline itself: it rises behind the door to a crest over the rear axle and falls to the tail.
const TOP: Point[] = [[2.1, 0.52], [0.76, 0.8], [-0.25, 0.835], [-0.7, CREST], [-1.15, CREST], [-1.55, 0.82], [-1.82, 0.66], [-1.96, 0.44]];
const OUTLINE: Point[] = [[2.2, 0.14], [NOSE, 0.22], [NOSE, 0.42], ...TOP, [-1.94, 0.24], [-1.86, 0.16]];
const KIT_OUTLINE: Point[] = [[2.26, 0.1], [2.36, 0.13], [2.36, 0.19], [NOSE, 0.24], [NOSE, 0.42], ...TOP, [-1.94, 0.24], [-1.96, 0.2], [-1.96, 0.14], [-1.9, 0.1]];

const section = (shoulder: number, tuck: number): Section => ({ belt: [BELT, BELT], shoulder, tuck, nose: [0.12, NOSE_PINCH], tail: [0.12, TAIL_PINCH] });
const lean = (shoulder: number, y: number) => shoulder * Math.max(0, Math.min(1, (y - BELT) / (CREST - BELT)));

const CABIN: Cabin = {
  points: [[0.76, 0.8], [0.18, 1.22], [-0.2, 1.29], [-0.62, 1.26], [-1.36, 0.94], [-1.86, 0.66]],
  width: 1.5,
  tumble: 0.22,
  frame: [0.05, 0.035, 0.035, 0.05, 0.035, 0.035],
  screens: [[0, 0.07], [3, 0.17]],
  split: [-0.42, 0.08],
  glass_to: -1.36,
  // The fastback's base runs from the tail to the screen through the rear wheel openings; this keeps it over them.
  floor: [[-1.0, 0.82]],
};

// The mirror stands over the hip crest, where the body side has done leaning in: lower, the lean would shear its housing.
const MIRROR_AT = glass_corner(CABIN, 0.185, 0.26);

const STOCK_ARCHES: Arches = { gap: 0.07, steps: 7, flare: 0.05, out: 0.045, reach: 0.04, tone: "paint" };
const KIT_ARCHES: Arches = { gap: 0.08, steps: 7, flare: 0.05, out: 0.03, reach: 0.04, tone: "paint" };

/** A profile cut where the section folds the body side (belt, crest, the start of each pinched end), so each piece's end stays one flat face. */
function folded(points: Point[]): Point[][] {
  const cuts: [Point, number][] = [[[0, 1], BELT], [[0, 1], CREST], [[1, 0], OUTLINE[0][0] - NOSE_PINCH], [[1, 0], OUTLINE[OUTLINE.length - 1][0] + TAIL_PINCH]];
  return cuts.reduce((pieces, [n, at]) => pieces.flatMap((piece) => [...split(piece, n, -at), ...split(piece, [-n[0], -n[1]], at)]), [points]);
}
const grown = (points: Point[], from: number, to: number): Slab[] => folded(points).map((piece) => ({ points: piece, from, to }));

// Each front wing stands over the low bonnet from the lamp to the screen foot, its side the body side run on up.
const WING_WALL = 0.56;
const FENDER: Point[] = [[2.12, 0.49], [2.16, 0.6], [2.08, 0.74], [1.92, 0.815], [1.3, 0.835], [0.66, 0.797], [0.66, 0.6]];
// The wheel opening is cut through the wing's inner wall above the bonnet; this closes it along the bonnet, clear of the tyre
// at full lock. It stands 2 cm inside the wall, which folds at the belt where this plate cannot.
const WALL: Part = { size: [0.024, 0.112, 0.54], at: [WING_WALL + 0.032, 0.696, 1.41], tilt: [0.206, 0, 0] };

// The tail kicks up across its whole width into a ducktail, then a whale tail, then a tray with a rubber rim.
const lip = (root: Point, tip: Point): Point[] => [root, tip, [tip[0] - 0.015, tip[1] - 0.03], [-1.845, 0.62]];
const DUCKTAIL = lip([-1.58, 0.79], [-1.95, 0.86]);
const WHALETAIL = lip([-1.5, 0.825], [-2.0, 0.93]);
const TRAY = lip([-1.46, 0.835], [-2.04, 0.965]);
const PLANE = plane([-1.92, 1.3], 0.44, 0.05, 0.1);
const PLANE_HALF = 0.8;

function wings(half: number, shoulder: number): Wing[] {
  const over = (x: number) => x / (1 - shoulder);
  return [
    { paint: [], trim: [], lips: grown(DUCKTAIL, 0, half) },
    { paint: [], trim: [], lips: grown(WHALETAIL, 0, half) },
    { paint: [], trim: [], lips: grown(TRAY, 0, half), stands: [{ points: gurney(TRAY, 0.03), from: 0, to: half }] },
    {
      paint: [],
      trim: [],
      lips: [...grown(WHALETAIL, 0, half), ...grown(leg(PLANE, [-1.68, 0.85], [-1.9, 0.86]), over(0.4), over(0.44)), { points: endplate(PLANE, 0.1, 0.12), from: over(PLANE_HALF), to: over(PLANE_HALF + 0.025) }],
      stands: [{ points: PLANE, from: 0, to: over(PLANE_HALF) }, { points: gurney(PLANE, 0.03), from: 0, to: over(PLANE_HALF) }],
    },
  ];
}

/** What changes with the body's width: the tail band and the bumper bars across it, the mirrors on its shoulder, its wings. */
function shell(outline: Point[], half: number, shoulder: number, front: Part[]) {
  const tail = tail_end(outline, 0.57, 0.14, half, [{ size: [half, 0.1, 0.04], at: [half / 2, 0.57, 0] }], null, 0.42);
  return {
    slabs: grown(FENDER, WING_WALL, half),
    mirror: cabin_mirror(CABIN, shoulder, MIRROR_AT),
    paint: [WALL],
    trim: [...front, { size: [half + 0.01, 0.1, 0.05], at: [(half + 0.01) / 2, 0.3, -1.95] } satisfies Part, ...tail.trim],
    tails: tail.tails,
    chrome: tail.chrome,
    wings: wings(half, shoulder),
  };
}

const bumper = (half: number): Part => ({ size: [half + 0.01, 0.14, 0.04], at: [(half + 0.01) / 2, 0.3, NOSE - 0.005] });
const STOCK = shell(OUTLINE, HALF, SHOULDER, [bumper(HALF)]);
const KIT: Kit = {
  ...shell(KIT_OUTLINE, KIT_HALF, KIT_SHOULDER, [bumper(KIT_HALF), { size: [0.5, 0.05, 0.04], at: [0.25, 0.16, 2.365] }]),
  outline: KIT_OUTLINE,
  width: 2 * KIT_HALF,
  sill: 0.1,
  section: section(KIT_SHOULDER, 0),
  arches: KIT_ARCHES,
  tyre: [0.32, 0.4],
  rim: { size: 0.8, spokes: 5, tone: "metal", lip: 0.3, spoke: 0.09 },
};

export const STURM_DESIGN: Design = {
  ...STOCK,
  outline: OUTLINE,
  width: 2 * HALF,
  sill: 0.16,
  section: section(SHOULDER, 0.03),
  cabin: CABIN,
  arches: STOCK_ARCHES,
  heads: [{ size: [0.24, 0.24, 0.06], at: [0.775, 0.65, 2.14], tilt: [-0.35, 0, 0], round: true }],
  markers: [],
  tyre: [0.28, 0.32],
  rim: { size: 0.7, spokes: 5, tone: "metal", spoke: 0.09 },
  deck: [-1.7, 0.75],
  hood: [-1.42, 0.86],
  exhaust: [0.3, 0.25, -1.94],
  // Only the kits fit a front piece: it lies under the kit's chin.
  fronts: [
    { paint: [], trim: [] },
    { paint: [], trim: [{ size: [KIT_HALF, 0.03, 0.2], at: [KIT_HALF / 2, 0.1, 2.3] }] },
    { paint: [], trim: [{ size: [KIT_HALF + 0.03, 0.03, 0.3], at: [(KIT_HALF + 0.03) / 2, 0.1, 2.3] }] },
  ],
  kit: KIT,
};

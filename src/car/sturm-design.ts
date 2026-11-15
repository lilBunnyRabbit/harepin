import { cabin_mirror, canard, endplate, glass_corner, gurney, leg, plane, tail_end } from "./design-parts";
import type { Arches, Cabin, Design, Kit, Mirror, Section, Slab, Wing } from "./designs";
import type { Part, Point } from "./geometry";

// The waist between the wheels: the wings and hips stand out past it as slabs, so the body pinches in at the doors.
const HALF = 0.95;
const KIT_HALF = 0.99;
// The stock sill strip hangs 0.045 under the sill and the kit drops its own sill to the hull floor: nothing under 0.171.
const SILL = 0.22;
const KIT_SILL = 0.18;
// The outline's first point, where the nose pinch is measured from, and the bumper face ahead of it.
const FOOT = 2.14;
const NOSE = 2.25;
const TAIL_FACE = -1.99;
const NOSE_PINCH = 0.2;
const NOSE_RUN = 0.6;
const TUCK = 0.03;
const LEDGE = 0.46;
const TAIL_FROM = -1.42;
const TAIL_PINCH = 0.12;
// Over the wings at the nose, so the shoulder never shears the lamps or twists the wings' rolled faces; under the hips' crest at the tail, which it rounds.
const BELT: Point = [0.94, 0.56];
const SHOULDER = 0.2;
const RISE = 0.21;

// The bonnet runs low from the bumper top to the cowl; the wings stand over it as slabs.
// The bumper is a band of its own: its top is a ledge the nose panel stands back from.
const BUMPER: Point[] = [[NOSE, 0.27], [NOSE, 0.42], [2.22, LEDGE], [2.16, LEDGE], [2.15, 0.52]];
const BONNET: Point[] = [[1.98, 0.61], [1.68, 0.7], [1.3, 0.745], [0.92, 0.78]];
const TOP: Point[] = [...BONNET, [0.2, 0.78], [-0.6, 0.79], [-1.5, 0.78], [-1.8, 0.7], [-1.92, 0.64]];
const TAIL: Point[] = [[-1.97, 0.6], [TAIL_FACE, 0.42], [TAIL_FACE, 0.28], [-1.96, 0.24], [-1.88, SILL]];
// The kit's tail face stops at a valance that the diffuser strakes hang under.
const KIT_TAIL: Point[] = [[-1.97, 0.6], [TAIL_FACE, 0.42], [TAIL_FACE, 0.3], [-1.66, 0.3], [-1.58, KIT_SILL]];
// The chin dips under the sill as an air dam, clear of the hull floor.
const OUTLINE: Point[] = [[FOOT, SILL], [NOSE - 0.03, 0.19], ...BUMPER, ...TOP, ...TAIL];

const belt_at = (z: number) => BELT[0] + ((BELT[1] - BELT[0]) * (FOOT - z)) / (FOOT - TAIL[TAIL.length - 1][0]);

const section = (shoulder: number): Section => ({ belt: BELT, shoulder, rise: RISE, tuck: TUCK, nose: [NOSE_PINCH, NOSE_RUN], tail: [TAIL_PINCH, TAIL_FROM - TAIL_FACE] });

const CABIN: Cabin = {
  points: [[0.92, 0.77], [0.3, 1.215], [0.0, 1.28], [-0.36, 1.26], [-1.0, 1.06], [-1.5, 0.86], [-1.86, 0.66]],
  width: 1.3,
  tumble: 0.24,
  frame: [0.05, 0.035, 0.035, 0.04, 0.035, 0.035, 0.035],
  screens: [[0, 0.07], [3, 0.16]],
  split: [-0.38, 0.07],
  glass_to: -1.0,
  floor: [[-1.0, 0.8]],
};

const MIRROR_UP = 0.07;
const MIRROR_BACK = 0.24;
const MIRROR_GROW = 1.35;

/** The door mirror grown about its root on the cabin side: the stock housing read as a chip beside the wide wings. */
function mirror(full: number): Mirror {
  const root = glass_corner(CABIN, MIRROR_UP, MIRROR_BACK);
  // The shoulder has only leaned in part of the way at the mirror's root, just over the belt.
  const shoulder = full * Math.max(0, Math.min(1, (root[1] - belt_at(root[2])) / RISE));
  const m = cabin_mirror(CABIN, shoulder, root);
  const x0 = root[0] / (1 - shoulder);
  const grow = (p: Part): Part => ({ ...p, size: [p.size[0] * MIRROR_GROW, p.size[1] * MIRROR_GROW, p.size[2] * MIRROR_GROW], at: [x0 + (p.at[0] - x0) * MIRROR_GROW, root[1] + (p.at[1] - root[1]) * MIRROR_GROW, root[2] + (p.at[2] - root[2]) * MIRROR_GROW] });
  return { paint: m.paint.map(grow), trim: m.trim.map(grow) };
}

const WING_IN = 0.44;
const WING_OUT = 1.06;
// Side profiles stand off the sill, or the wheel opening's floor would leave a sliver of slab across it.
const LIFT = 0.005;
// The wing's side under the bonnet line, a hair below it so no face lies on the body top.
const UNDER = 0.01;
const under = (points: Point[]): Point[] => points.map(([z, y]) => [z, y - UNDER]);
// Behind its wheel the side ends on an arc round the axle, so the wing wraps the wheel instead of ending in a wall.
const wing = (sill: number): Point[] => [[2.14, sill + 0.02], ...under([BUMPER[BUMPER.length - 1], ...BONNET]), [0.8, 0.6], [0.745, 0.4], [0.76, sill + LIFT]];
// The lamp's face, from the bumper top up to the wing's crest.
const FACE: [Point, Point] = [[2.15, 0.515], [2.05, 0.76]];
// The wing over the bonnet, on the side's top edge and clear of the wheel opening, so no face lies on another.
const WING_HUMP: Point[] = [...FACE, [1.9, 0.8], [1.5, 0.84], [1.1, 0.84], [0.92, 0.805], ...under([...BONNET].reverse())];
const WING_LEAN = { low: 0.55, high: 0.84, out: 0.2 };
// The crown line along the wing: over it the side rolls in, and stays outside the body side it stands on up to the bonnet line.
const WING_ROLL = { low: 0.68, high: 0.84, in: 0.1 };

const HIP_IN = 0.44;
const HIP_OUT = 1.05;
// Ahead of its wheel the hip starts on an arc round the axle, as the wing ends on one.
const hip = (sill: number, tail: Point[]): Point[] => [[-0.29, sill + LIFT], [-0.27, 0.4], [-0.33, 0.61], [-0.44, 0.77], [-0.6, 0.78], [-1.5, 0.77], [-1.8, 0.69], [-1.9, 0.66], ...tail.slice(0, -1), [tail[tail.length - 1][0], sill + LIFT]];
const HIP_HUMP: Point[] = [[-0.44, 0.77], [-0.47, 0.78], [-0.75, 0.86], [-1.1, 0.89], [-1.45, 0.85], [-1.72, 0.77], [-1.8, 0.69], [-1.5, 0.77], [-0.6, 0.78]];
const HIP_LEAN = { low: 0.78, high: 0.89, out: 0.22 };
const HIP_ROLL = { low: 0.5, high: 0.89, in: 0.1 };

const FLARE_OUT_F = 1.09;
const FLARE_OUT_R = 1.1;
const SKIRT: Point[] = [[0.72, KIT_SILL + 0.01], [0.72, 0.3], [-0.25, 0.3], [-0.25, KIT_SILL + 0.01]];

const ARCHES: Arches = { gap: 0.065, steps: 11, flare: 0.07, out: 0.13, reach: 0.03, tone: "paint" };
const KIT_ARCHES: Arches = { gap: 0.08, steps: 11, flare: 0.13, out: 0.12, reach: 0.03, tone: "paint" };

// The front axle's z plus the wheel radius, from the Sturm spec.
const FRONT_ARCH = 1.362 + 0.34;

const grown = (points: Point[], from: number, to: number): Slab[] => [{ points, from, to }];

// The side stands this far off the waist, so its arch faces never overlap the body's own.
const SEAM = 0.02;

/** A wing or hip: its side from the waist out up to the body top, and its hump over that from `inner` out, rolled in alike. */
function fender(waist: number, side: Point[], hump: Point[], inner: number, out: number, lean: Slab["lean"], roll?: Slab["roll"]): Slab[] {
  return [{ points: side, from: waist + SEAM, to: out, roll }, { points: hump, from: inner, to: out, lean, roll }];
}

const LAMP: Point = [(FACE[0][0] + FACE[1][0]) / 2, (FACE[0][1] + FACE[1][1]) / 2];
const LAMP_TILT = -Math.atan2(FACE[0][0] - FACE[1][0], FACE[1][1] - FACE[0][1]);
// The share of its x the body keeps at the lamp: drawn this much wider and further out, the lamp comes out round and in place.
const LAMP_KEPT = 1 - (NOSE_PINCH * (LAMP[0] - (FOOT - NOSE_RUN))) / NOSE_RUN - (TUCK * (BELT[0] - LAMP[1])) / (BELT[1] - SILL);
const LAMP_X = 0.6 / LAMP_KEPT;
/** A disc on the lamp's face, `sunk` metres under the lens along the face's normal. */
const on_face = (wide: number, deep: number, sunk: number): Part => ({ sides: 16, size: [wide / LAMP_KEPT, wide, deep], at: [LAMP_X, LAMP[1] + sunk * Math.sin(LAMP_TILT), LAMP[0] - sunk * Math.cos(LAMP_TILT)], tilt: [LAMP_TILT, 0, 0], round: true });

const lip = (root: Point, tip: Point): Point[] => [root, tip, [tip[0] - 0.015, tip[1] - 0.03], [-1.86, 0.62]];
const WHALETAIL = lip([-1.36, 0.88], [-2.08, 0.94]);
const TRAY = lip([-1.3, 0.9], [-2.14, 1.0]);
const DUCK = lip([-1.42, 0.86], [-2.12, 0.98]);
const LID_HALF = 0.82;
const PLANE = plane([-1.96, 1.24], 0.46, 0.05, 0.1);
const PLANE_HALF = 1.3;

function wings(shoulder: number): Wing[] {
  const over = (x: number) => x / (1 - shoulder);
  const lid = over(LID_HALF * 0.74);
  return [
    { paint: [], trim: [], lips: grown(WHALETAIL, 0, lid), stands: [{ points: gurney(WHALETAIL, 0.035), from: 0, to: lid - 0.02 }] },
    { paint: [], trim: [], lips: grown(TRAY, 0, lid), stands: [{ points: gurney(TRAY, 0.04), from: 0, to: lid - 0.02 }] },
    { paint: [], trim: [], lips: grown(TRAY, 0, lid), stands: [{ points: gurney(TRAY, 0.07), from: 0, to: lid - 0.02 }] },
    {
      paint: [],
      trim: [],
      lips: [...grown(DUCK, 0, lid), ...grown(leg(PLANE, [-1.78, 0.93], [-2.0, 0.97]), 0.44, 0.5), { points: PLANE, from: 0, to: PLANE_HALF }],
      stands: [{ points: endplate(PLANE, 0.12, 0.14), from: PLANE_HALF, to: PLANE_HALF + 0.03 }, { points: gurney(PLANE, 0.035), from: 0, to: PLANE_HALF - 0.01 }],
    },
  ];
}

const BAND_Y = 0.51;

/** The tail's lamp band, right across the hips: red lamps at each end and the reflector strip between them, in a black panel. */
function band(outline: Point[], half: number) {
  const span = half - 0.02;
  const end: Part = { size: [0.34, 0.15, 0.04], at: [span - 0.19, BAND_Y, 0] };
  return tail_end(outline, BAND_Y, 0.2, span, [end], { half: span - 0.37, y: BAND_Y, h: 0.13 }, 0.3);
}

const INTAKE_Y = 0.32;
const INTAKE_HALF = 0.4;
// The indicator pods at the bumper's outer ends.
const POD_X = 0.74;
const POD_Y = 0.355;

function shell(outline: Point[], half: number, shoulder: number) {
  const tail = band(outline, half);
  return {
    mirror: mirror(shoulder),
    paint: [],
    trim: [
      { size: [INTAKE_HALF, 0.05, 0.04], at: [INTAKE_HALF / 2, INTAKE_Y, NOSE - 0.008] } satisfies Part,
      { size: [0.2, 0.075, 0.03], at: [POD_X, POD_Y, NOSE - 0.005] } satisfies Part,
      { size: [0.9, 0.02, 0.03], at: [0.45, LEDGE + 0.01, 2.165] } satisfies Part,
      { size: [half - 0.1, 0.1, 0.03], at: [(half - 0.1) / 2, 0.24, TAIL_FACE + 0.01] } satisfies Part,
      ...tail.trim,
    ],
    tails: tail.tails,
    chrome: tail.chrome,
    wings: wings(shoulder),
  };
}

// The lens in a chrome ring on a dark gasket: a stripped build drops the chrome and keeps the gasket's ring.
const HEADS: Part[] = [on_face(0.215, 0.05, 0)];
const RINGS: Part[] = [on_face(0.265, 0.04, 0.008)];
const GASKETS: Part[] = [on_face(0.29, 0.04, 0.016)];
const INDICATORS: Part[] = [{ size: [0.13, 0.04, 0.03], at: [POD_X, POD_Y, NOSE + 0.006] }];

const LID_SLOPE = Math.atan2(1.06 - 0.86, 1.5 - 1.0);
const lid_y = (z: number) => 0.86 + ((z + 1.5) * (1.06 - 0.86)) / (1.5 - 1.0);
const on_lid = (x: number, w: number, z: number, h: number, long: number, sink: number): Part => ({ size: [w / (1 - SHOULDER), h, long], at: [x / (1 - SHOULDER), lid_y(z) + h / 2 - sink, z], tilt: [-LID_SLOPE, 0, 0] });
const GRILLE: Part[] = [on_lid(0.17, 0.34, -1.26, 0.012, 0.38, 0.004)];
const SLATS: Part[] = [0.035, 0.1, 0.165, 0.23, 0.295].map((x) => on_lid(x, 0.022, -1.26, 0.03, 0.36, 0.012));

const STOCK = shell(OUTLINE, HIP_OUT, SHOULDER);
const BODY: Slab[] = [...fender(HALF, wing(SILL), WING_HUMP, WING_IN, WING_OUT, WING_LEAN, WING_ROLL), ...fender(HALF, hip(SILL, TAIL), HIP_HUMP, HIP_IN, HIP_OUT, HIP_LEAN, HIP_ROLL)];

const KIT_OUTLINE: Point[] = [[FOOT, KIT_SILL], [NOSE + 0.09, KIT_SILL + 0.01], [NOSE + 0.1, 0.22], [NOSE + 0.01, 0.25], ...BUMPER, ...TOP, ...KIT_TAIL];
const KIT: Kit = {
  ...shell(KIT_OUTLINE, FLARE_OUT_R, SHOULDER),
  outline: KIT_OUTLINE,
  sill: KIT_SILL,
  width: 2 * KIT_HALF,
  section: section(1 - (HALF * (1 - SHOULDER)) / KIT_HALF),
  slabs: [...fender(KIT_HALF, wing(KIT_SILL), WING_HUMP, WING_IN, FLARE_OUT_F, WING_LEAN, WING_ROLL), ...fender(KIT_HALF, hip(KIT_SILL, KIT_TAIL), HIP_HUMP, HIP_IN, FLARE_OUT_R, HIP_LEAN, HIP_ROLL), { points: SKIRT, from: KIT_HALF - 0.04, to: KIT_HALF + 0.05 }],
  arches: KIT_ARCHES,
  tyre: [0.42, 0.52],
  rim: { size: 0.79, spokes: 5, tone: "metal", lip: 0.36, spoke: 0.09 },
};

export const STURM_DESIGN: Design = {
  ...STOCK,
  outline: OUTLINE,
  width: 2 * HALF,
  sill: SILL,
  section: section(SHOULDER),
  cabin: CABIN,
  arches: ARCHES,
  slabs: BODY,
  heads: HEADS,
  trim: [...STOCK.trim, ...GASKETS, ...GRILLE],
  chrome: [...STOCK.chrome, ...RINGS],
  paint: SLATS,
  markers: INDICATORS,
  tyre: [0.36, 0.37],
  rim: { size: 0.76, spokes: 5, tone: "metal", lip: 0.3, spoke: 0.09 },
  deck: [-1.7, 0.75],
  hood: [-1.42, 0.86],
  exhaust: [0.62, 0.27, -1.98],
  fronts: [
    { paint: [], trim: [] },
    { paint: [], trim: [{ size: [HALF, 0.03, 0.2], at: [HALF / 2, 0.19, NOSE - 0.04] }] },
    { paint: [], trim: [{ size: [HALF + 0.05, 0.03, 0.3], at: [(HALF + 0.05) / 2, KIT_SILL + 0.015, NOSE + 0.11] }, ...canard(KIT_OUTLINE, KIT_HALF, 0.34, FRONT_ARCH + KIT_ARCHES.gap + KIT_ARCHES.flare)] },
  ],
  kit: { ...KIT, trim: [...(KIT.trim ?? []), ...GASKETS, ...GRILLE], chrome: [...(KIT.chrome ?? []), ...RINGS], paint: SLATS },
};

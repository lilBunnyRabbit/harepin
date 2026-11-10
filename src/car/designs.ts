import type { BodyStyle, Triple } from "./cars";
import type { Panel } from "./livery";
import type { Token } from "../theme/theme";
import type { Part, Point } from "./geometry";

export interface Cabin {
  /** Greenhouse side outline [z, y], base front first, then over the roof; its base edge sits on the body top. */
  points: Point[];
  width: number;
  tumble: number;
  /** Pillar and frame thickness per outline edge, edge i running from point i to i + 1. */
  frame: number[];
  /** Outline edges that are glass seen end-on, with the painted pillar width beside each. */
  screens: Point[];
  split?: Point;
  /** Where the side glass ends toward the tail, z: a fastback roof runs on to the tail as painted panel. */
  glass_to?: number;
}

/** A side profile [z, y] extruded between two distances from the centre, mirrored: wing bulges and haunches. */
export interface Slab {
  points: Point[];
  from: number;
  to: number;
}

export interface Arches {
  gap: number;
  /** Segments per arch; 0 cuts none, for wheels that stand clear of the body. */
  steps: number;
  flare: number;
  out: number;
  /** How far the flare reaches in over the body top: a tall reach reads as a fender hump from the front. */
  reach: number;
  tone: "paint" | "trim";
}

export interface Rim {
  size: number;
  spokes: number;
  tone: "metal" | "light" | "bronze";
  /** Polished outer lip as a share of the rim radius, with the spokes set back in a dark dish inside it. */
  lip?: number;
  /** Spoke width, metres; 0.06 when unset. */
  spoke?: number;
}

/** Endplates in paint, planes in trim. */
export interface Wing {
  paint: Part[];
  trim: Part[];
}

/** Profiles are [z, y] from the ground at rest, +z forward; parts are [x, y, z] for the left one. */
export interface Design {
  /** Body outline from the front bottom corner over the top to the rear bottom corner; arches are cut from the wheel mounts. */
  outline: Point[];
  width: number;
  sill: number;
  cabin: Cabin;
  arches: Arches;
  heads: Part[];
  tails: Part[];
  paint: Part[];
  trim: Part[];
  /** Factory stripes in trim, dropped when a decal is chosen so the two never overlap. */
  stripes?: Part[];
  markers: Part[];
  chrome: Part[];
  tyre: Point;
  rim: Rim;
  /** Where a bolt-on wing sits: rear deck or roof edge, [z, y]. */
  deck: Point;
  /** A stock ducktail spoiler on `deck` while no aero wing is fitted. */
  ducktail?: boolean;
  /** A built-in rear wing per aero wing level from none up, set steeper and bigger in place of a bolt-on one on `deck`. */
  wings?: Wing[];
  /** A built-in front wing per aero front piece (none, lip, splitter), grown in place of a bolt-on lip or splitter. */
  fronts?: Wing[];
  /** Side decal area when the body side between the arches is hidden, as behind sidepods. */
  panel?: Panel;
  /** Where an engine bulge or scoop sits on the hood, [z, y]. */
  hood: Point;
  /** Hood camera [z, y] where the camera's own hood point misses the body: an open cockpit's eyes, a bus's windscreen. */
  eye?: Point;
  /** Left tailpipe outlet for engine upgrades, at the rear face; x 0 is one central pipe that widens instead of doubling. */
  exhaust: Triple;
  /** Nitro bottles on the rear deck (default), out of sight inside the bodywork, or on the outline at this z. */
  bottles?: "deck" | "inside" | number;
  /** Cockpit hoop in trim; hidden from the hood camera like the headlamps. */
  halo?: Part[];
  /** Stock brake caliper colour, proud of the spokes like an upgrade's; without one it hides in trim. */
  caliper?: Token;
  /** Raised profiles on the body sides in paint, such as front wings standing above a low bonnet. */
  slabs?: Slab[];
  /** Narrows the body behind z `from` to `share` of its width at the tail. */
  taper?: { from: number; share: number };
}

const MIRROR: Triple = [0.16, 0.1, 0.18];
const RIVET: Triple = [0.03, 0.025, 0.025];

/** Bolt heads around a bolt-on arch: `count` studs on a half circle of `radius` round the wheel centre [z, y], at side x. */
function rivets(z: number, y: number, radius: number, x: number, count: number): Part[] {
  return Array.from({ length: count }, (_, i): Part => {
    const a = (Math.PI * (i + 0.5)) / count;
    return { size: RIVET, at: [x, y + radius * Math.sin(a), z + radius * Math.cos(a)] };
  });
}

export const DESIGNS: Record<BodyStyle, Design> = {
  coupe: {
    outline: [[2.27, 0.3], [2.33, 0.42], [2.34, 0.6], [2.29, 0.72], [2.16, 0.78], [1.3, 0.84], [0.6, 0.87], [-1.6, 0.89], [-2.14, 0.9], [-2.3, 0.88], [-2.34, 0.8], [-2.34, 0.5], [-2.27, 0.3]],
    width: 1.88,
    sill: 0.3,
    cabin: { points: [[0.6, 0.87], [-0.08, 1.19], [-0.48, 1.225], [-0.92, 1.19], [-1.6, 0.89]], width: 1.56, tumble: 0.2, frame: [0.06, 0.04, 0.04, 0.13, 0.04], screens: [[0, 0.08], [3, 0.14]], split: [-0.62, 0.08] },
    arches: { gap: 0.05, steps: 7, flare: 0.05, out: 0.03, reach: 0.08, tone: "paint" },
    heads: [{ size: [0.42, 0.1, 0.05], at: [0.6, 0.66, 2.32], tilt: [-0.39, 0, 0] }],
    tails: [{ size: [0.56, 0.12, 0.05], at: [0.58, 0.74, -2.345] }],
    paint: [{ size: MIRROR, at: [0.86, 0.93, 0.45] }],
    trim: [
      { size: [0.34, 0.1, 0.05], at: [0.17, 0.49, 2.33] },
      { size: [0.94, 0.12, 0.08], at: [0.47, 0.36, 2.3] },
      { size: [0.94, 0.12, 0.08], at: [0.47, 0.36, -2.3] },
    ],
    markers: [{ size: [0.05, 0.1, 0.04], at: [0.86, 0.49, 2.32] }],
    chrome: [],
    tyre: [0.28, 0.3],
    rim: { size: 0.64, spokes: 6, tone: "metal" },
    deck: [-2.0, 0.9],
    ducktail: true,
    hood: [1.3, 0.84],
    exhaust: [0.55, 0.3, -2.3],
  },
  hatch: {
    outline: [[1.9, 0.3], [1.95, 0.62], [1.88, 0.72], [1.0, 0.86], [-1.82, 0.92], [-1.95, 0.92], [-1.97, 0.6], [-1.93, 0.3]],
    width: 1.7,
    sill: 0.3,
    cabin: { points: [[1.0, 0.86], [0.25, 1.3], [-1.45, 1.33], [-1.84, 0.92]], width: 1.5, tumble: 0.14, frame: [0.06, 0.05, 0.14, 0.04], screens: [[0, 0.08], [2, 0.12]], split: [-0.25, 0.1] },
    arches: { gap: 0.05, steps: 6, flare: 0.06, out: 0.03, reach: 0.04, tone: "trim" },
    heads: [{ size: [0.34, 0.16, 0.05], at: [0.56, 0.62, 1.94] }],
    tails: [{ size: [0.18, 0.3, 0.05], at: [0.72, 0.72, -1.975] }],
    paint: [
      { size: MIRROR, at: [0.82, 0.93, 0.8] },
      { size: [0.66, 0.05, 0.24], at: [0.33, 1.355, -1.44] },
    ],
    trim: [
      { size: [0.25, 0.12, 0.05], at: [0.125, 0.62, 1.94] },
      { size: [0.88, 0.14, 0.1], at: [0.44, 0.38, 1.93] },
      { size: [0.88, 0.14, 0.1], at: [0.44, 0.38, -1.95] },
    ],
    markers: [],
    chrome: [],
    tyre: [0.24, 0.24],
    rim: { size: 0.6, spokes: 0, tone: "metal" },
    deck: [-1.44, 1.37],
    hood: [1.35, 0.8],
    exhaust: [0.5, 0.32, -1.92],
  },
  muscle: {
    outline: [[2.46, 0.28], [2.53, 0.4], [2.53, 0.74], [2.4, 0.78], [0.45, 0.84], [-1.6, 0.86], [-2.42, 0.88], [-2.52, 0.84], [-2.52, 0.5], [-2.46, 0.28]],
    width: 1.98,
    sill: 0.28,
    cabin: { points: [[0.45, 0.84], [-0.22, 1.22], [-0.95, 1.24], [-1.6, 0.86]], width: 1.5, tumble: 0.22, frame: [0.08, 0.05, 0.15, 0.05], screens: [[0, 0.08], [2, 0.16]], split: [-0.78, 0.06] },
    arches: { gap: 0.05, steps: 7, flare: 0.1, out: 0.08, reach: 0.22, tone: "paint" },
    heads: [
      { size: [0.17, 0.15, 0.04], at: [0.74, 0.6, 2.545] },
      { size: [0.17, 0.15, 0.04], at: [0.52, 0.6, 2.545] },
    ],
    tails: [{ size: [0.82, 0.13, 0.04], at: [0.44, 0.73, -2.535] }],
    paint: [
      { size: MIRROR, at: [0.88, 0.9, 0.3] },
      { size: [0.35, 0.08, 1.7], at: [0.175, 0.87, 1.45] },
      { size: [0.24, 0.12, 0.42], at: [0.12, 0.95, 1.3] },
    ],
    trim: [
      { size: [0.9, 0.26, 0.04], at: [0.45, 0.6, 2.535] },
      { size: [0.19, 0.07, 0.02], at: [0.095, 0.97, 1.52] },
      { size: [0.06, 0.06, 0.16], at: [0.5, 0.24, -2.46] },
    ],
    stripes: [
      { size: [0.12, 0.012, 1.7], at: [0.12, 0.916, 1.45] },
      { size: [0.12, 0.012, 0.75], at: [0.12, 1.247, -0.58] },
      { size: [0.12, 0.012, 0.8], at: [0.12, 0.886, -2.0], tilt: [-0.025, 0, 0] },
    ],
    markers: [],
    chrome: [
      { size: [1.0, 0.12, 0.12], at: [0.5, 0.36, 2.5] },
      { size: [1.0, 0.12, 0.12], at: [0.5, 0.36, -2.5] },
    ],
    tyre: [0.3, 0.42],
    rim: { size: 0.62, spokes: 5, tone: "metal" },
    deck: [-2.15, 0.88],
    hood: [1.95, 0.91],
    exhaust: [0.5, 0.26, -2.44],
  },
  rally: {
    outline: [[2.15, 0.38], [2.2, 0.5], [2.17, 0.66], [1.2, 0.8], [-1.6, 0.88], [-2.13, 0.9], [-2.2, 0.86], [-2.2, 0.56], [-2.14, 0.38]],
    width: 1.8,
    sill: 0.38,
    cabin: { points: [[1.2, 0.8], [0.4, 1.3], [-1.0, 1.33], [-1.6, 0.88]], width: 1.5, tumble: 0.12, frame: [0.07, 0.05, 0.1, 0.05], screens: [[0, 0.08], [2, 0.12]], split: [-0.24, 0.1] },
    arches: { gap: 0.1, steps: 3, flare: 0.1, out: 0.08, reach: 0.06, tone: "trim" },
    heads: [
      { size: [0.34, 0.1, 0.05], at: [0.62, 0.58, 2.2], tilt: [-0.2, 0, 0] },
      { size: [0.15, 0.13, 0.03], at: [0.14, 0.76, 2.13] },
      { size: [0.15, 0.13, 0.03], at: [0.38, 0.76, 2.13] },
    ],
    tails: [{ size: [0.4, 0.15, 0.05], at: [0.62, 0.74, -2.21] }],
    paint: [{ size: MIRROR, at: [0.85, 0.9, 0.95] }],
    trim: [
      { size: [0.55, 0.18, 0.08], at: [0.275, 0.76, 2.08] },
      { size: [0.18, 0.08, 0.32], at: [0.09, 1.37, 0.1] },
      { size: [0.75, 0.06, 0.4], at: [0.375, 0.36, 1.9] },
      { size: [0.9, 0.12, 0.06], at: [0.45, 0.44, 2.18] },
      { size: [0.9, 0.12, 0.06], at: [0.45, 0.44, -2.18] },
      { size: [0.3, 0.3, 0.03], at: [0.78, 0.25, 0.75] },
      { size: [0.3, 0.3, 0.03], at: [0.78, 0.25, -1.8] },
    ],
    markers: [],
    chrome: [],
    tyre: [0.3, 0.3],
    rim: { size: 0.56, spokes: 0, tone: "light" },
    deck: [-1.95, 0.9],
    hood: [1.55, 0.75],
    exhaust: [0.55, 0.4, -2.13],
  },
  kaze: {
    outline: [[1.96, 0.28], [2.0, 0.56], [1.94, 0.65], [0.57, 0.93], [-1.9, 0.95], [-2.0, 0.94], [-2.12, 0.91], [-2.14, 0.6], [-2.08, 0.28]],
    width: 1.9,
    sill: 0.28,
    cabin: { points: [[0.57, 0.93], [-0.05, 1.26], [-0.35, 1.3], [-0.78, 1.28], [-1.9, 0.95]], width: 1.66, tumble: 0.34, frame: [0.05, 0.035, 0.035, 0.05, 0.035], screens: [[0, 0.07], [3, 0.2]] },
    arches: { gap: 0.07, steps: 8, flare: 0, out: 0, reach: 0, tone: "paint" },
    heads: [{ size: [0.38, 0.05, 0.24], at: [0.64, 0.67, 1.88], tilt: [0.42, 0.22, 0] }],
    tails: [{ size: [0.46, 0.14, 0.05], at: [0.63, 0.79, -2.155] }],
    paint: [
      { size: [0.18, 0.14, 0.18], at: [0.94, 1.0, 0.4] },
      { size: [0.8, 0.05, 0.18], at: [0.4, 0.96, -2.04], tilt: [0.25, 0, 0] },
    ],
    trim: [
      { size: [0.88, 0.05, 0.22], at: [0.44, 0.26, 1.9] },
      { size: [0.52, 0.12, 0.04], at: [0.25, 0.4, 1.985] },
      { size: [0.03, 0.16, 0.05], at: [0.955, 0.8, -0.7] },
      { size: [0.9, 0.14, 0.04], at: [0.45, 0.37, -2.11] },
    ],
    markers: [{ size: [0.05, 0.16, 0.04], at: [0.78, 0.42, 1.99] }],
    chrome: [{ size: [0.12, 0.07, 0.1], at: [0.55, 0.3, -2.12] }],
    tyre: [0.34, 0.36],
    rim: { size: 0.58, spokes: 0, tone: "metal" },
    deck: [-2.0, 0.97],
    hood: [1.2, 0.8],
    exhaust: [0.55, 0.3, -2.08],
  },
  sturm: {
    outline: [[2.2, 0.14], [2.27, 0.19], [2.28, 0.36], [2.24, 0.44], [2.1, 0.52], [1.8, 0.61], [1.2, 0.7], [0.76, 0.78], [-0.4, 0.82], [-1.0, 0.84], [-1.5, 0.8], [-1.78, 0.7], [-1.92, 0.58], [-1.96, 0.4], [-1.93, 0.24], [-1.86, 0.16]],
    width: 1.7,
    sill: 0.16,
    cabin: {
      points: [[0.76, 0.78], [0.44, 1.04], [0.22, 1.2], [0.0, 1.27], [-0.3, 1.3], [-0.62, 1.26], [-1.32, 0.97], [-1.56, 0.83], [-1.78, 0.68], [-1.9, 0.6]],
      width: 1.38,
      tumble: 0.22,
      frame: [0.05, 0.05, 0.035, 0.035, 0.035, 0.05, 0.035, 0.035, 0.035, 0.035],
      screens: [[0, 0.07], [1, 0.07], [5, 0.17]],
      split: [-0.42, 0.08],
      glass_to: -1.36,
    },
    arches: { gap: 0.02, steps: 8, flare: 0.13, out: 0.2, reach: 0.1, tone: "paint" },
    slabs: [
      { points: [[2.12, 0.44], [2.17, 0.56], [2.16, 0.68], [2.1, 0.78], [1.98, 0.84], [1.75, 0.85], [1.3, 0.83], [0.85, 0.82], [0.6, 0.8], [0.6, 0.5]], from: 0.46, to: 0.88 },
      { points: [[-0.08, 0.72], [-0.18, 0.86], [-0.38, 0.95], [-0.68, 0.99], [-1.08, 0.99], [-1.38, 0.95], [-1.6, 0.85], [-1.74, 0.72]], from: 0.55, to: 1.0 },
    ],
    heads: [{ size: [0.21, 0.21, 0.05], at: [0.665, 0.69, 2.175], tilt: [-0.25, 0, 0], round: true }],
    tails: [{ size: [0.84, 0.07, 0.04], at: [0.42, 0.56, -1.93] }],
    paint: [
      { size: MIRROR, at: [0.76, 0.93, 0.5] },
      { size: [0.62, 0.05, 0.28], at: [0.31, 0.74, -1.74], tilt: [-0.35, 0, 0] },
    ],
    trim: [
      { size: [0.25, 0.25, 0.03], at: [0.665, 0.69, 2.155], tilt: [-0.25, 0, 0], round: true },
      { size: [0.86, 0.17, 0.04], at: [0.43, 0.3, 2.275] },
      { size: [0.96, 0.035, 0.22], at: [0.48, 0.15, 2.22] },
      { size: [0.86, 0.1, 0.05], at: [0.43, 0.3, -1.95] },
      { size: [0.5, 0.012, 0.05], at: [0.25, 0.925, -1.4], tilt: [0.5, 0, 0] },
      { size: [0.5, 0.012, 0.05], at: [0.25, 0.885, -1.48], tilt: [0.5, 0, 0] },
      { size: [0.5, 0.012, 0.05], at: [0.25, 0.845, -1.56], tilt: [0.55, 0, 0] },
    ],
    markers: [{ size: [0.1, 0.045, 0.04], at: [0.66, 0.42, 2.255] }],
    chrome: [...rivets(1.362, 0.34, 0.43, 1.06, 7), ...rivets(-0.908, 0.34, 0.43, 1.06, 7)],
    tyre: [0.4, 0.46],
    rim: { size: 0.8, spokes: 3, tone: "metal", lip: 0.4 },
    deck: [-1.7, 0.75],
    hood: [-1.42, 0.86],
    exhaust: [0.3, 0.25, -1.94],
    bottles: 1.7,
    wings: [
      { paint: [], trim: [] },
      {
        paint: [{ size: [0.025, 0.14, 0.38], at: [0.8, 1.06, -1.78] }],
        trim: [
          { size: [0.04, 0.34, 0.1], at: [0.42, 0.88, -1.72] },
          { size: [0.8, 0.04, 0.34], at: [0.4, 1.06, -1.78], tilt: [0.08, 0, 0] },
        ],
      },
      {
        paint: [{ size: [0.02, 0.2, 0.46], at: [0.9, 1.3, -1.95] }],
        trim: [
          { size: [0.045, 0.62, 0.08], at: [0.42, 1.0, -1.74], tilt: [-0.3, 0, 0] },
          { size: [0.9, 0.045, 0.4], at: [0.45, 1.29, -1.9], tilt: [0.1, 0, 0] },
          { size: [0.9, 0.03, 0.18], at: [0.45, 1.37, -2.1], tilt: [0.45, 0, 0] },
        ],
      },
    ],
  },
  raijin: {
    outline: [[1.96, 0.22], [2.0, 0.3], [2.05, 0.46], [2.14, 0.76], [2.1, 0.82], [1.9, 0.88], [1.2, 0.95], [0.82, 1.0], [-0.6, 1.06], [-1.5, 1.11], [-1.95, 1.14], [-2.36, 1.15], [-2.42, 1.1], [-2.43, 0.7], [-2.4, 0.36], [-2.34, 0.26]],
    width: 1.78,
    sill: 0.26,
    cabin: {
      points: [[0.82, 1.0], [0.0, 1.45], [-0.4, 1.48], [-1.2, 1.47], [-1.45, 1.43], [-1.95, 1.14]],
      width: 1.5,
      tumble: 0.14,
      frame: [0.06, 0.04, 0.04, 0.04, 0.13, 0.04],
      screens: [[0, 0.08], [4, 0.13]],
      split: [-0.55, 0.09],
    },
    arches: { gap: 0.03, steps: 7, flare: 0.09, out: 0.1, reach: 0.08, tone: "paint" },
    heads: [{ size: [0.38, 0.07, 0.1], at: [0.62, 0.77, 2.11], tilt: [0.29, 0.35, 0.15] }],
    tails: [
      { size: [0.42, 0.17, 0.05], at: [0.66, 0.96, -2.43] },
      { size: [0.04, 0.12, 0.2], at: [0.885, 0.96, -2.33] },
    ],
    paint: [
      { size: [0.2, 0.36, 0.05], at: [0.52, 0.52, 2.115], tilt: [0.29, 0, -0.45] },
      { size: [0.3, 0.06, 0.9], at: [0.15, 0.97, 1.4], tilt: [-0.07, 0, 0] },
      { size: [0.18, 0.12, 0.16], at: [0.86, 1.1, 0.62] },
    ],
    trim: [
      { size: [0.5, 0.34, 0.05], at: [0.25, 0.58, 2.1], tilt: [0.29, 0, 0] },
      { size: [0.95, 0.035, 0.24], at: [0.475, 0.21, 1.98] },
      { size: [0.18, 0.02, 0.1], at: [0.82, 0.42, 2.0], tilt: [0, 0.3, 0.35] },
      { size: [0.16, 0.02, 0.1], at: [0.82, 0.33, 1.99], tilt: [0, 0.3, 0.3] },
      { size: [0.15, 0.015, 0.3], at: [0.42, 0.955, 1.5], tilt: [-0.07, 0, 0] },
      { size: [0.15, 0.06, 0.03], at: [0.075, 0.99, 1.86] },
      { size: [0.015, 0.12, 0.2], at: [0.895, 0.76, 0.46] },
      { size: [0.02, 0.38, 0.09], at: [0.7, 1.24, -0.55] },
      { size: [0.012, 0.6, 0.015], at: [0.894, 0.72, 0.6] },
      { size: [0.012, 0.74, 0.015], at: [0.894, 0.66, -0.55] },
      { size: [0.012, 0.34, 0.015], at: [0.894, 0.94, -1.3] },
      { size: [0.014, 0.03, 0.12], at: [0.896, 0.96, 0.02] },
      { size: [0.014, 0.03, 0.12], at: [0.896, 0.99, -1.0] },
      { size: [0.05, 0.05, 1.5], at: [0.885, 0.22, -0.21] },
      { size: [0.7, 0.1, 0.08], at: [0.35, 0.32, -2.4] },
      { size: [0.89, 0.02, 0.02], at: [0.445, 0.62, -2.435] },
      { size: [0.3, 0.12, 0.02], at: [0.0, 0.76, -2.435] },
    ],
    markers: [{ size: [0.05, 0.07, 0.08], at: [0.0, 0.3, 2.03] }],
    chrome: [{ size: [0.34, 0.14, 0.03], at: [0.17, 0.5, 2.09], tilt: [0.29, 0, 0] }],
    caliper: "warning",
    tyre: [0.34, 0.34],
    rim: { size: 0.8, spokes: 5, tone: "bronze", spoke: 0.1 },
    deck: [-2.2, 1.12],
    hood: [1.45, 0.89],
    exhaust: [0.4, 0.3, -2.4],
    wings: [
      {
        paint: [{ size: [0.02, 0.1, 0.28], at: [0.73, 1.29, -2.2] }],
        trim: [
          { size: [0.04, 0.14, 0.14], at: [0.55, 1.19, -2.18] },
          { size: [0.72, 0.04, 0.26], at: [0.36, 1.27, -2.2], tilt: [0.06, 0, 0] },
        ],
      },
      {
        paint: [{ size: [0.02, 0.16, 0.34], at: [0.8, 1.39, -2.24] }],
        trim: [
          { size: [0.04, 0.26, 0.14], at: [0.52, 1.25, -2.2] },
          { size: [0.8, 0.04, 0.3], at: [0.4, 1.39, -2.24], tilt: [0.08, 0, 0] },
        ],
      },
      {
        paint: [{ size: [0.02, 0.18, 0.42], at: [0.92, 1.55, -2.32] }],
        trim: [
          { size: [0.04, 0.42, 0.12], at: [0.5, 1.33, -2.2], tilt: [-0.2, 0, 0] },
          { size: [0.9, 0.045, 0.34], at: [0.45, 1.55, -2.3], tilt: [0.1, 0, 0] },
          { size: [0.9, 0.03, 0.16], at: [0.45, 1.61, -2.48], tilt: [0.45, 0, 0] },
        ],
      },
    ],
  },
  bus: {
    outline: [[5.84, 0.35], [5.9, 0.46], [5.92, 0.98], [5.88, 1.15], [-6.12, 1.15], [-6.16, 1.0], [-6.16, 0.46], [-6.1, 0.35]],
    width: 2.5,
    sill: 0.35,
    cabin: {
      points: [[5.86, 1.15], [5.76, 2.86], [5.6, 3.02], [-5.98, 3.02], [-6.12, 2.88], [-6.14, 1.15]],
      width: 2.48,
      tumble: 0,
      frame: [0.07, 0.04, 0.4, 0.04, 0.12, 0.12],
      screens: [[0, 0.1], [4, 0.3]],
      split: [3.95, 0.14],
      glass_to: -5.5,
    },
    arches: { gap: 0.06, steps: 8, flare: 0.04, out: 0.02, reach: 0.04, tone: "trim" },
    heads: [{ size: [0.34, 0.16, 0.05], at: [0.9, 0.62, 5.92] }],
    tails: [{ size: [0.16, 0.46, 0.05], at: [1.08, 0.78, -6.17] }],
    paint: [
      { size: [0.06, 0.32, 0.14], at: [1.5, 2.28, 5.55] },
      { size: [0.26, 0.04, 0.04], at: [1.36, 2.46, 5.58] },
      { size: [0.8, 0.2, 2.6], at: [0.4, 3.12, -1.4] },
      ...[2.6, 1.3, 0, -1.3, -2.6, -5.1].map((z): Part => ({ size: [0.03, 1.38, 0.1], at: [1.252, 1.92, z] })),
    ],
    trim: [
      { size: [0.03, 2.2, 1.1], at: [1.258, 1.5, 4.75] },
      { size: [0.03, 2.2, 1.1], at: [1.258, 1.5, -4.15] },
      { size: [1.26, 0.24, 0.1], at: [0.63, 0.44, 5.9] },
      { size: [1.26, 0.24, 0.1], at: [0.63, 0.44, -6.16] },
      { size: [0.9, 0.3, 0.03], at: [0.45, 0.8, -6.175] },
    ],
    stripes: [{ size: [0.02, 0.08, 11.6], at: [1.256, 1.21, -0.1] }],
    markers: [{ size: [0.86, 0.2, 0.04], at: [0.43, 2.72, 5.79] }],
    chrome: [
      { size: [0.035, 2.1, 0.03], at: [1.262, 1.5, 4.75] },
      { size: [0.035, 2.1, 0.03], at: [1.262, 1.5, -4.15] },
    ],
    tyre: [0.3, 0.42],
    rim: { size: 0.56, spokes: 8, tone: "light", lip: 0.3 },
    deck: [-5.7, 3.02],
    hood: [-5.4, 3.02],
    eye: [6.05, 2.3],
    exhaust: [0.8, 0.42, -6.16],
    bottles: "inside",
  },
  formula: {
    outline: [[2.3, 0.2], [2.32, 0.27], [2.1, 0.34], [1.3, 0.5], [0.98, 0.6], [0.9, 0.56], [0.42, 0.56], [0.3, 0.68], [-0.2, 0.7], [-1.2, 0.5], [-1.85, 0.38], [-2.0, 0.36], [-2.0, 0.12]],
    width: 0.56,
    sill: 0.1,
    cabin: { points: [[0.84, 0.6], [0.84, 0.78], [0.72, 0.9], [0.52, 0.88], [0.5, 0.6]], width: 0.24, tumble: 0.25, frame: [0.025, 0.03, 0.05, 0.2, 0.22], screens: [[1, 0.04]] },
    arches: { gap: 0, steps: 0, flare: 0, out: 0, reach: 0, tone: "trim" },
    heads: [{ size: [0.05, 0.035, 0.14], at: [0.27, 0.38, 1.75], tilt: [0.18, 0, 0] }],
    tails: [{ size: [0.07, 0.08, 0.03], at: [0.035, 0.22, -2.135] }],
    paint: [
      { size: [0.36, 0.32, 1.0], at: [0.46, 0.26, -0.62] },
      { size: [0.22, 0.2, 0.6], at: [0.38, 0.2, -1.3], tilt: [0.2, 0.16, 0] },
      { size: [0.08, 0.28, 0.3], at: [0.04, 0.84, 0.27] },
      { size: [0.06, 0.1, 1.1], at: [0.03, 0.78, -0.3], tilt: [-0.3, 0, 0] },
      { size: [0.03, 0.16, 0.52], at: [0.95, 0.17, 2.12] },
      { size: [0.12, 0.06, 0.09], at: [0.38, 0.7, 0.98] },
    ],
    trim: [
      { size: [0.62, 0.04, 2.5], at: [0.31, 0.115, -0.25] },
      { size: [0.9, 0.035, 0.42], at: [0.45, 0.13, 2.12] },
      { size: [0.62, 0.03, 0.22], at: [0.56, 0.2, 2.0], tilt: [-0.35, 0, 0] },
      { size: [0.02, 0.44, 0.14], at: [0.01, 0.62, -1.96], tilt: [0.25, 0, 0] },
      { size: [0.3, 0.2, 0.03], at: [0.43, 0.27, -0.11] },
      { size: [0.07, 0.1, 0.02], at: [0.035, 0.92, 0.42] },
      { size: [0.42, 0.025, 0.07], at: [0.47, 0.42, 1.6], tilt: [0, 0, -0.2] },
      { size: [0.42, 0.025, 0.07], at: [0.47, 0.24, 1.6], tilt: [0, 0, 0.12] },
      { size: [0.42, 0.025, 0.07], at: [0.47, 0.42, -1.45], tilt: [0, 0, -0.2] },
      { size: [0.42, 0.025, 0.07], at: [0.47, 0.22, -1.45], tilt: [0, 0, 0.12] },
      { size: [0.06, 0.02, 0.03], at: [0.3, 0.66, 0.98] },
      { size: [0.08, 0.12, 0.24], at: [0.04, 0.22, -2.0] },
    ],
    markers: [],
    chrome: [],
    tyre: [0.32, 0.42],
    rim: { size: 0.6, spokes: 0, tone: "metal" },
    deck: [-2.0, 0.6],
    hood: [-0.6, 0.62],
    exhaust: [0, 0.34, -1.98],
    halo: [
      { size: [0.03, 0.035, 0.48], at: [0.105, 0.94, 0.67], tilt: [0, -0.24, 0] },
      { size: [0.025, 0.36, 0.035], at: [0.0125, 0.78, 0.94], tilt: [-0.3, 0, 0] },
      { size: [0.025, 0.3, 0.03], at: [0.16, 0.79, 0.44] },
    ],
    bottles: "inside",
    taper: { from: -0.3, share: 0.42 },
    wings: [
      {
        paint: [{ size: [0.03, 0.34, 0.5], at: [0.5, 0.86, -2.08] }],
        trim: [
          { size: [0.485, 0.04, 0.28], at: [0.2425, 0.82, -2.02], tilt: [0.1, 0, 0] },
          { size: [0.485, 0.03, 0.16], at: [0.2425, 0.92, -2.2], tilt: [0.35, 0, 0] },
        ],
      },
      {
        paint: [{ size: [0.03, 0.38, 0.52], at: [0.5, 0.88, -2.08] }],
        trim: [
          { size: [0.485, 0.045, 0.3], at: [0.2425, 0.82, -2.02], tilt: [0.2, 0, 0] },
          { size: [0.485, 0.03, 0.22], at: [0.2425, 0.95, -2.21], tilt: [0.65, 0, 0] },
        ],
      },
      {
        paint: [{ size: [0.03, 0.62, 0.56], at: [0.5, 0.76, -2.08] }],
        trim: [
          { size: [0.485, 0.05, 0.32], at: [0.2425, 0.82, -2.02], tilt: [0.28, 0, 0] },
          { size: [0.485, 0.035, 0.24], at: [0.2425, 0.96, -2.22], tilt: [0.8, 0, 0] },
          { size: [0.485, 0.03, 0.16], at: [0.2425, 1.04, -2.31], tilt: [1.05, 0, 0] },
          { size: [0.485, 0.03, 0.2], at: [0.2425, 0.5, -2.1], tilt: [0.3, 0, 0] },
        ],
      },
    ],
    fronts: [
      { paint: [], trim: [] },
      { paint: [], trim: [{ size: [0.56, 0.025, 0.18], at: [0.6, 0.27, 1.88], tilt: [-0.5, 0, 0] }] },
      {
        paint: [{ size: [0.03, 0.26, 0.58], at: [0.96, 0.2, 2.1] }],
        trim: [
          { size: [0.58, 0.028, 0.2], at: [0.59, 0.27, 1.88], tilt: [-0.55, 0, 0] },
          { size: [0.5, 0.025, 0.16], at: [0.65, 0.33, 1.76], tilt: [-0.8, 0, 0] },
        ],
      },
    ],
    panel: { rear: -1.08, front: -0.16, low: 0.14, high: 0.4, side: 0.64 },
    eye: [0.7, 0.84],
  },
};

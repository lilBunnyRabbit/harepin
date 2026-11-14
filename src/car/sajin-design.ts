import type { Triple } from "./cars";
import { rod } from "./design-parts";
import type { Arm, Design, Section, Wing } from "./designs";
import type { Part, Point } from "./geometry";

const NOSE = 2.04;
const SILL = 0.44;
const HALF = 0.475;
// The tub narrows to half its width from the cowl to the nose tip, the cage, arms and wheels aside.
const SECTION: Section = { belt: [0.6, 0.6], shoulder: 0, tuck: 0, nose: [0.5, 1.14], tail: [0, 0] };

/** Share of its x a point at z keeps once the nose is pinched; parts drawn there are widened by it to come out as drawn. */
function keep(z: number): number {
  const [share, length] = SECTION.nose;
  return 1 - share * Math.max(0, Math.min(1, (z - (NOSE - length)) / length));
}

const on_nose = (part: Part): Part => ({ ...part, size: [part.size[0] / keep(part.at[2]), part.size[1], part.size[2]], at: [part.at[0] / keep(part.at[2]), part.at[1], part.at[2]] });

const tube = (from: Triple, to: Triple, thick: number): Part => rod([from[0] / keep(from[2]), from[1], from[2]], [to[0] / keep(to[2]), to[1], to[2]], thick);

const across = ([x, y, z]: Triple, thick: number): Part => ({ size: [x, thick, thick], at: [x / 2, y, z] });
const lerp = (a: Triple, b: Triple, t: number): Triple => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function coil(low: Triple, high: Triple): [Part, Part] {
  return [rod(low, high, 0.04), rod(lerp(low, high, 0.22), lerp(low, high, 0.84), 0.1)];
}

const BAR = 0.07;
const COWL: Triple = [0.44, 1.0, 0.86];
const ROOF_FRONT: Triple = [0.42, 1.52, 0.28];
const ROOF_REAR: Triple = [0.42, 1.54, -0.56];
const TAIL: Triple = [0.36, 0.84, -1.86];
const TAIL_LOW: Triple = [0.36, 0.5, -1.86];
const HUB_FRONT: Triple = [0.74, 0.41, 1.5];
const HUB_REAR: Triple = [0.7, 0.43, -1.3];
// The trailing arm ends inside the widest rear tyre's inner face; a stub axle runs on from it to the hub.
const AXLE_REAR: Triple = [0.56, 0.43, -1.3];

const CAGE: Part[] = [
  tube(COWL, ROOF_FRONT, BAR),
  tube(ROOF_FRONT, ROOF_REAR, BAR),
  tube(ROOF_REAR, [0.45, 1.0, -0.6], BAR),
  tube(ROOF_REAR, TAIL, BAR),
  tube([0.44, 0.5, -0.7], TAIL_LOW, BAR),
  tube(TAIL_LOW, TAIL, BAR),
  across(ROOF_FRONT, BAR),
  across(ROOF_REAR, BAR),
  across(TAIL, BAR),
  across(TAIL_LOW, BAR),
];
// The arms swing with the wheels outside the sculpted hull, so they are drawn where they end up.
const FRONT_COIL = coil([0.63, 0.46, 1.5], [0.33, 0.84, 1.48]);
const REAR_COIL = coil([0.58, 0.5, -1.24], lerp(ROOF_REAR, TAIL, 0.49));
const ARMS: Arm[] = [
  { pivot: [0.33, 0.52, 1.5], trim: [rod([0.27, 0.52, 1.62], HUB_FRONT, 0.055), rod([0.36, 0.52, 1.38], HUB_FRONT, 0.055), FRONT_COIL[0]], markers: [FRONT_COIL[1]] },
  { pivot: [0.46, 0.52, -0.5], trim: [rod([0.46, 0.52, -0.5], AXLE_REAR, 0.11, 0.07), rod(AXLE_REAR, HUB_REAR, 0.07), REAR_COIL[0]], markers: [REAR_COIL[1]] },
];
const SEAT: Part = { size: [0.3, 0.42, 0.1], at: [0.22, 0.97, -0.3], tilt: [0.12, 0, 0] };
const ENGINE: Part = { size: [0.26, 0.3, 0.74], at: [0.13, 0.66, -1.13] };
const TRIM: Part[] = [...CAGE, SEAT, ENGINE];
const CHROME: Part[] = [{ size: [0.15, 0.08, 0.42], at: [0.075, 0.85, -1.1] }];
const ROOF: Part = { size: [0.39, 0.03, 0.86], at: [0.195, 1.572, -0.14], tilt: [-0.024, 0, 0] };
const HEADS: Part[] = [on_nose({ size: [0.2, 0.08, 0.04], at: [0.125, 0.6, 2.1] })];

const LIGHT_BAR: Part = { size: [0.36, 0.06, 0.04], at: [0.18, 1.6, 0.345] };
const LIGHT_HOUSING: Part = { size: [0.4, 0.09, 0.08], at: [0.2, 1.6, 0.3] };
const NERF: Part[] = [tube([0.46, 0.5, 0.62], [0.62, 0.5, 0.42], 0.06), tube([0.62, 0.5, 0.42], [0.62, 0.5, -0.26], 0.06), tube([0.62, 0.5, -0.26], [0.46, 0.5, -0.46], 0.06)];
const SPARE_TILT = 1.065;
const spare_at = (lift: number): Triple => [0, 1.266 + lift * Math.sin(SPARE_TILT), -1.415 - lift * Math.cos(SPARE_TILT)];
const SPARE: Part = { size: [0.8, 0.8, 0.24], at: spare_at(0), tilt: [SPARE_TILT, 0, 0], round: true };
const SPARE_RIM: Part = { size: [0.42, 0.42, 0.03], at: spare_at(0.12), tilt: [SPARE_TILT, 0, 0], round: true };

const fin = (y: number): Point[] => [[-1.72, 0.92], [-1.84, y], [-1.98, y], [-1.89, 0.83]];
const WINGS: Wing[] = [
  { paint: [], trim: [] },
  { paint: [{ size: [0.39, 0.03, 0.22], at: [0.195, 1.6, -0.62], tilt: [0.3, 0, 0] }], trim: [] },
  { paint: [{ size: [0.5, 0.045, 0.4], at: [0.25, 1.38, -1.86], tilt: [0.1, 0, 0] }], trim: [], stands: [{ points: fin(1.38), from: 0.325, to: 0.355 }] },
  {
    paint: [{ size: [0.56, 0.05, 0.48], at: [0.28, 1.48, -1.88], tilt: [0.12, 0, 0] }],
    trim: [{ size: [0.03, 0.16, 0.5], at: [0.56, 1.5, -1.88] }],
    stands: [{ points: fin(1.48), from: 0.325, to: 0.355 }],
  },
];

const HOOP: Part[] = [tube([0.17, 0.56, 2.06], [0.17, 0.56, 2.27], 0.06), on_nose({ size: [0.2, 0.06, 0.06], at: [0.1, 0.56, 2.27] })];
const FRONTS: Wing[] = [
  { paint: [], trim: [] },
  { paint: [], trim: HOOP },
  { paint: [], trim: [...HOOP, on_nose({ size: [0.24, 0.03, 0.56], at: [0.12, 0.445, 1.82] })] },
];

export const SAJIN_DESIGN: Design = {
  outline: [[NOSE, 0.46], [2.1, 0.52], [2.1, 0.68], [2.02, 0.75], [0.92, 1.02], [0.8, 1.02], [0.7, 0.8], [-0.42, 0.8], [-0.5, 1.02], [-0.68, 1.02], [-0.74, 0.9], [-0.74, 0.52], [-0.68, SILL]],
  width: 2 * HALF,
  sill: SILL,
  section: SECTION,
  cabin: { points: [[0.92, 1.02], [0.8, 1.13], [0.76, 1.13], [0.8, 1.02]], width: 0.84, tumble: 0.06, frame: [0.012, 0.012, 0.012, 0.012], screens: [[0, 0.03]] },
  arches: { gap: 0, steps: 0, flare: 0, out: 0, reach: 0, tone: "paint" },
  heads: HEADS,
  tails: [{ size: [0.18, 0.06, 0.04], at: [0.2, 0.84, -1.9] }],
  paint: [ROOF],
  trim: TRIM,
  markers: [],
  arms: ARMS,
  chrome: CHROME,
  tyre: [0.28, 0.4],
  rim: { size: 0.5, spokes: 5, tone: "light", lip: 0.24, spoke: 0.08 },
  round: 12,
  tread: 1.4,
  deck: [-1.8, 1.0],
  hood: [1.45, 0.89],
  eye: [0.4, 1.22],
  exhaust: [0, 0.66, -1.5],
  panel: { rear: -0.36, front: 0.62, low: 0.5, high: 0.76, side: HALF },
  wings: WINGS,
  fronts: FRONTS,
  kit: {
    heads: [...HEADS, LIGHT_BAR],
    trim: [...TRIM, ...NERF, LIGHT_HOUSING, SPARE],
    chrome: [...CHROME, SPARE_RIM],
  },
};

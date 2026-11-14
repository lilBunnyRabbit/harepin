import type { BodyStyle, Triple } from "./cars";
import type { Panel } from "./livery";
import type { Token } from "../theme/theme";
import { FUJIN_DESIGN } from "./fujin-design";
import { endplate, gurney, hoop, leg, mirror, plane, rod, roof_lip, tail_end, widen_wing } from "./design-parts";
import { KAZE_DESIGN } from "./kaze-design";
import { RAIJIN_DESIGN } from "./raijin-design";
import { SAJIN_DESIGN } from "./sajin-design";
import { STURM_DESIGN } from "./sturm-design";
import { TSUMUJI_DESIGN } from "./tsumuji-design";
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
  /** Base points from the tail forward, under the body top: they lift a base that would cross a wheel opening. */
  floor?: Point[];
  /** An open cockpit's driver: the whole shape is a helmet in the glass tone, with no frame or screens. */
  helmet?: boolean;
  /** A helmet's visor, as a profile standing proud of the helmet's face. */
  visor?: Point[];
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
  /** Width of the lip round the wheel opening; 0 leaves the arch a bare cut. */
  flare: number;
  /** How far the lip stands out from the body side: enough to cover the tyre. */
  out: number;
  /** How far the lip sinks into the body side. */
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

/** The body's cross-section: every share is of the half width a point keeps, so flat faces stay flat. */
export interface Section {
  /** Belt height at the nose and at the tail. */
  belt: Point;
  /** Share of the half width the body top loses over the shoulder. */
  shoulder: number;
  /** Share lost at the sill. */
  tuck: number;
  /** [share lost at the tip, metres it takes] for the nose and the tail. */
  nose: Point;
  tail: Point;
}

/** A suspension arm and its coilover, drawn on the left wheel at rest; it swings about a hinge through `pivot` that runs square to the wheel in plan. */
export interface Arm {
  pivot: Triple;
  trim: Part[];
  markers: Part[];
}

/** Endplates in paint, planes in trim. */
export interface Wing {
  paint: Part[];
  trim: Part[];
  /** Profiles in paint: a lip grown out of the deck, legs that sweep up into a plane. */
  lips?: Slab[];
  /** Profiles in trim: the plate uprights of a bolt-on wing. */
  stands?: Slab[];
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
  /** Which way the left pipe blows its nitro flame, a unit vector; straight back without one. */
  jet?: Triple;
  /** Stock brake caliper colour, proud of the spokes like an upgrade's; without one it hides in trim. */
  caliper?: Token;
  /** Raised profiles on the body sides in paint, such as front wings standing above a low bonnet. */
  slabs?: Slab[];
  /**
   * Wheel openings cut in the slabs beside a body lower than its wheels, not in its outline: their radius and facets,
   * and the distance from the centre of the slab face that closes them, where each one's well starts.
   */
  pods?: { radius: number; steps: number; from: number };
  /** Narrows the body behind z `from` to `share` of its width at the tail. */
  taper?: { from: number; share: number };
  /** A chamfered shoulder above the belt line, a tuck below it, and nose and tail pinched in plan. */
  section?: Section;
  /** Tyre and rim sides; 8 when unset. */
  round?: number;
  /** Knobs on the stock tyre, as a scale on their size; none when unset. */
  tread?: number;
  /** Per axle, front first: arms that follow their wheels up and down. */
  arms?: Arm[];
  /**
   * The wide body an aero kit with skirts fits: each field given replaces the stock one. A kit with its own `outline` is the
   * shell itself (wider `width`, deeper `sill`, chin and tail in the outline, `section` and `wings` to match) and takes no bolt-on band.
   */
  kit?: Kit;
  /**
   * Pop-up lamps: `pods` and the `shells` profiles in paint and `bezels` in trim, modelled shut, and `heads` swing about the hinge line at [z, y] by `lift` radians
   * while the lights are on. Positive lift raises what sits ahead of the hinge.
   */
  popups?: { pods: Part[]; shells?: Slab[]; bezels?: Part[]; hinge: Point; lift: number };
}

/** What a build must have fitted for a detail to show: `base` is every build. */
export type Fit = "base" | "lip" | "wing" | "street" | "race" | "tuned" | "race_engine" | "light" | "stripped" | "knobbly" | "nitro" | "drift" | "lifted";

export type Swap = "bulge" | "pipes" | "diffuser" | "bonnet" | "tips";

/** Tuner parts a build wears once the part `on` is fitted, until the part `until` takes their place; one list per tone. */
export interface Detail {
  on: Fit;
  until?: Fit;
  /** Why it is there, for the review table. */
  cue: string;
  paint?: Part[];
  trim?: Part[];
  chrome?: Part[];
  warning?: Part[];
  red?: Part[];
  bright?: Part[];
  accent?: Part[];
  /** Extra lit lamps. */
  heads?: Part[];
  /** Profiles in paint and in trim. */
  lips?: Slab[];
  stands?: Slab[];
  /** Bare panels: paint rubbed back toward trim. */
  bare?: Part[];
  /** Lying on the cabin glass and leaned with it: bars in chrome, slats in paint, a banner in the light tone. */
  cage?: Part[];
  louvres?: Part[];
  banner?: Part[];
  /** Radians the wheels lean in at the top. */
  camber?: number;
  /** Generic part looks this takes the place of. */
  swaps?: Swap[];
  /** Blue nitro tips on the pipes this detail brings, drawn with a nitro tank in place of the stock tips. */
  tips?: Part[];
  /** Where the pipes this detail brings blow their nitro flame from, and which way: the design's `exhaust` and `jet`. */
  exhaust?: Triple;
  jet?: Triple;
}

export type Kit = Partial<Pick<Design, "outline" | "width" | "sill" | "section" | "wings" | "arches" | "slabs" | "heads" | "tails" | "paint" | "trim" | "markers" | "chrome" | "tyre" | "rim" | "caliper">>;

const COUPE_OUTLINE: Point[] = [[2.27, 0.3], [2.35, 0.42], [2.33, 0.54], [2.1, 0.63], [0.95, 0.84], [-2.1, 0.93], [-2.3, 0.9], [-2.34, 0.8], [-2.34, 0.5], [-2.27, 0.3]];
const COUPE_SECTION: Section = { belt: [0.62, 0.8], shoulder: 0.15, tuck: 0.04, nose: [0.2, 0.55], tail: [0.12, 0.5] };
const COUPE_CABIN: Cabin = { points: [[0.95, 0.84], [0.2, 1.17], [-0.4, 1.2], [-0.8, 1.16], [-2.0, 0.927]], width: 1.56, tumble: 0.2, frame: [0.06, 0.04, 0.04, 0.1, 0.04], screens: [[0, 0.08], [3, 0.14]], split: [-0.42, 0.08] };
const COUPE_ARCHES: Arches = { gap: 0.065, steps: 7, flare: 0.06, out: 0.06, reach: 0.04, tone: "paint" };
const COUPE_HALF = 0.944;
const COUPE_PLANE = 0.86;
// A lip grown out of the hatch across the whole tail, then a hoop: side plates swept up from the deck corners round the plane's ends.
const COUPE_LIP: Slab = { points: [[-2.02, 0.922], [-2.36, 0.985], [-2.37, 0.955], [-2.3, 0.88]], from: 0, to: COUPE_HALF };
const COUPE_DUCKTAIL: Slab = { points: [[-1.99, 0.922], [-2.4, 1.05], [-2.415, 1.02], [-2.3, 0.88]], from: 0, to: COUPE_HALF };
const COUPE_HOOP = plane([-2.25, 1.14], 0.3, 0.05, 0.1);
const COUPE_RACE = plane([-2.29, 1.31], 0.36, 0.055, 0.12);
const coupe_plates = (profile: Point[], front: number): Slab => ({ points: hoop(profile, [front, 0.915], [-2.32, 0.86]), from: COUPE_PLANE, to: COUPE_HALF });
const COUPE_WINGS: Wing[] = [
  { paint: [], trim: [], lips: [COUPE_LIP] },
  { paint: [], trim: [], lips: [COUPE_DUCKTAIL] },
  { paint: [], trim: [], lips: [{ points: COUPE_HOOP, from: 0, to: COUPE_PLANE }, coupe_plates(COUPE_HOOP, -1.98)], stands: [{ points: gurney(COUPE_HOOP, 0.03), from: 0, to: COUPE_PLANE }] },
  { paint: [], trim: [], lips: [COUPE_LIP, coupe_plates(COUPE_RACE, -1.94)], stands: [{ points: COUPE_RACE, from: 0, to: COUPE_PLANE }] },
];
// The kit is the shell: 8 cm wider a side over deeper sills, its chin and tail valance drawn in the outline. The shoulder
// grows by what the body widens, so the body top, and the cabin and wings on it, stay where they were.
const COUPE_TAIL = tail_end(COUPE_OUTLINE, 0.74, 0.2, 0.93, [{ size: [0.56, 0.12, 0.05], at: [0.58, 0.74, 0] }], { half: 0.32, y: 0.74 }, 0.55);
const COUPE_GRILLE: Part = { size: [0.34, 0.07, 0.05], at: [0.17, 0.48, 2.33] };
const COUPE_WIDE = 2.04;
const COUPE_WIDE_SHOULDER = 1 - (1.88 * (1 - COUPE_SECTION.shoulder)) / COUPE_WIDE;
const COUPE_KIT: Kit = {
  outline: [[2.3, 0.19], [2.37, 0.25], [2.35, 0.42], [2.33, 0.54], [2.1, 0.63], [0.95, 0.84], [-2.1, 0.93], [-2.3, 0.9], [-2.34, 0.8], [-2.34, 0.25], [-2.28, 0.19]],
  width: COUPE_WIDE,
  sill: 0.19,
  section: { ...COUPE_SECTION, belt: [0.69, 0.8], shoulder: COUPE_WIDE_SHOULDER, tuck: 0 },
  arches: { ...COUPE_ARCHES, gap: 0.075, flare: 0.05, out: 0.03 },
  tyre: [0.32, 0.36],
  paint: mirror(COUPE_CABIN, COUPE_WIDE_SHOULDER),
  // The bumper bars sit on the kit's upright valances: the rear one stands proud of the tail face.
  trim: [COUPE_GRILLE, { size: [1.0, 0.12, 0.08], at: [0.5, 0.356, 2.31] }, { size: [1.0, 0.12, 0.08], at: [0.5, 0.356, -2.312] }, ...COUPE_TAIL.trim],
  wings: COUPE_WINGS.map((wing) => widen_wing(wing, (1 - COUPE_SECTION.shoulder) / (1 - COUPE_WIDE_SHOULDER))),
};

const HATCH_OUTLINE: Point[] = [[1.9, 0.3], [1.96, 0.46], [1.95, 0.68], [1.86, 0.77], [1.0, 0.88], [-1.82, 0.93], [-1.95, 0.93], [-1.98, 0.62], [-1.93, 0.3]];
const HATCH_SECTION: Section = { belt: [0.7, 0.76], shoulder: 0.1, tuck: 0.04, nose: [0.14, 0.31], tail: [0.07, 0.13] };
const HATCH_CABIN: Cabin = { points: [[1.0, 0.88], [0.3, 1.3], [-1.28, 1.33], [-1.84, 0.93]], width: 1.5, tumble: 0.14, frame: [0.06, 0.05, 0.14, 0.04], screens: [[0, 0.08], [2, 0.12]], split: [-0.25, 0.1] };
const HATCH_ARCHES: Arches = { gap: 0.055, steps: 7, flare: 0.07, out: 0.06, reach: 0.04, tone: "trim" };
const HATCH_TAIL = tail_end(HATCH_OUTLINE, 0.72, 0.34, 0.84, [{ size: [0.18, 0.3, 0.05], at: [0.72, 0.72, 0] }], { half: 0.54, y: 0.84 }, 0.68);
const hatch_lip = (reach: number, kick: number) => roof_lip(HATCH_CABIN, HATCH_SECTION.shoulder, 1, 0.3, reach, kick, 0.04);
const HATCH_LIPS = [hatch_lip(0.14, 0.01), hatch_lip(0.24, 0.03), hatch_lip(0.32, 0.05), hatch_lip(0.42, 0.08)];
// The roof runs on into a spoiler that grows with each level, the last two fenced at the ends.
const HATCH_WINGS: Wing[] = [
  { paint: [], trim: [], lips: [HATCH_LIPS[0].lip] },
  { paint: [], trim: [], lips: [HATCH_LIPS[1].lip] },
  { paint: [], trim: [], lips: [HATCH_LIPS[2].lip, HATCH_LIPS[2].fence(0.12)] },
  { paint: [], trim: [], lips: [HATCH_LIPS[3].lip, HATCH_LIPS[3].fence(0.2)] },
];

// The hood is level and the deck kicks up behind the door, so the cabin base sinks into the haunch at its tail.
const MUSCLE_OUTLINE: Point[] = [[2.44, 0.28], [2.5, 0.4], [2.56, 0.72], [2.5, 0.8], [0.2, 0.88], [-1.1, 0.88], [-1.7, 0.96], [-2.42, 0.97], [-2.52, 0.92], [-2.5, 0.5], [-2.44, 0.28]];
const MUSCLE_SECTION: Section = { belt: [0.76, 0.78], shoulder: 0.14, tuck: 0.04, nose: [0.06, 0.4], tail: [0.1, 0.5] };
const MUSCLE_CABIN: Cabin = { points: [[0.2, 0.88], [-0.4, 1.23], [-1.25, 1.25], [-1.7, 0.88]], width: 1.5, tumble: 0.22, frame: [0.08, 0.05, 0.2, 0.05], screens: [[0, 0.08], [2, 0.16]], split: [-0.85, 0.06] };
const MUSCLE_ARCHES: Arches = { gap: 0.07, steps: 7, flare: 0.06, out: 0.08, reach: 0.04, tone: "paint" };
const MUSCLE_TAIL = tail_end(MUSCLE_OUTLINE, 0.76, 0.19, 0.9, [{ size: [0.82, 0.13, 0.04], at: [0.44, 0.76, 0] }], null, 0.54);
const HOOD_FALL = 0.035;
const MUSCLE_HALF = 0.994;
const MUSCLE_PLANE = 0.9;
// A lip grown out of the boot lid across the whole tail, then a pedestal wing on two legs, the last with endplates.
const MUSCLE_LIP: Slab = { points: [[-2.2, 0.962], [-2.56, 1.04], [-2.575, 1.01], [-2.5, 0.9]], from: 0, to: MUSCLE_HALF };
const MUSCLE_DUCKTAIL: Slab = { points: [[-2.14, 0.962], [-2.6, 1.1], [-2.615, 1.07], [-2.5, 0.9]], from: 0, to: MUSCLE_HALF };
const MUSCLE_PEDESTAL = plane([-2.33, 1.14], 0.34, 0.05, 0.12);
const MUSCLE_RACE = plane([-2.35, 1.22], 0.4, 0.055, 0.14);
const muscle_legs = (profile: Point[]): Slab => ({ points: leg(profile, [-2.16, 0.95], [-2.46, 0.95]), from: 0.54, to: 0.62 });
const MUSCLE_WINGS: Wing[] = [
  { paint: [], trim: [], lips: [MUSCLE_LIP] },
  { paint: [], trim: [], lips: [MUSCLE_DUCKTAIL] },
  { paint: [], trim: [], lips: [{ points: MUSCLE_PEDESTAL, from: 0, to: MUSCLE_PLANE }, muscle_legs(MUSCLE_PEDESTAL)] },
  {
    paint: [],
    trim: [],
    lips: [{ points: MUSCLE_RACE, from: 0, to: MUSCLE_PLANE }, muscle_legs(MUSCLE_RACE), { points: endplate(MUSCLE_RACE, 0.04, 0.09), from: MUSCLE_PLANE, to: MUSCLE_PLANE + 0.03 }],
    stands: [{ points: gurney(MUSCLE_RACE, 0.035), from: 0, to: MUSCLE_PLANE }],
  },
];

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
const RALLY_MIRROR = mirror(RALLY_CABIN, RALLY_SECTION.shoulder);
const RALLY_BUMPERS: Part[] = [
  { size: [0.52, 0.14, 0.05], at: [0.26, 0.47, 2.08] },
  { size: [0.9, 0.12, 0.06], at: [0.45, 0.45, -1.855] },
];
const rally_lip = (reach: number, kick: number) => roof_lip(RALLY_CABIN, RALLY_SECTION.shoulder, 2, 0.3, reach, kick, 0.04);
const RALLY_LIPS = [rally_lip(0.12, 0), rally_lip(0.2, 0.02), rally_lip(0.28, 0.04)];
const RALLY_TOP = rally_lip(0.4, 0.05);
const RALLY_PLANE = plane([RALLY_TOP.edge[0] - 0.215, RALLY_TOP.edge[1] + 0.2], 0.36, 0.05, 0.16);
const RALLY_PLATE = 0.03 / (1 - RALLY_SECTION.shoulder);
// The roof runs on into a spoiler, fenced at the third level; the last stands a second plane over it between two plates.
const RALLY_WINGS: Wing[] = [
  { paint: [], trim: [], lips: [RALLY_LIPS[0].lip] },
  { paint: [], trim: [], lips: [RALLY_LIPS[1].lip] },
  { paint: [], trim: [], lips: [RALLY_LIPS[2].lip, RALLY_LIPS[2].fence(0.14)] },
  {
    paint: [],
    trim: [],
    lips: [{ ...RALLY_TOP.lip, to: RALLY_TOP.half - RALLY_PLATE }, { points: RALLY_PLANE, from: 0, to: RALLY_TOP.half - RALLY_PLATE }],
    stands: [{ ...RALLY_TOP.fence(0.16, 0.32), from: RALLY_TOP.half - RALLY_PLATE }],
  },
];

const FORMULA_NOSE = 2.3;
// The nose narrows to half its width over its last 0.9 m, wings and wishbones aside.
const FORMULA_SECTION: Section = { belt: [0.3, 0.3], shoulder: 0, tuck: 0, nose: [0.5, 0.9], tail: [0, 0] };

/** A part ahead of the cockpit, widened by what the pinched nose takes back at its centre, so it comes out as drawn. */
function on_nose(part: Part): Part {
  const [share, length] = FORMULA_SECTION.nose;
  const keep = 1 - share * Math.max(0, Math.min(1, (part.at[2] - (FORMULA_NOSE - length)) / length));
  return { ...part, size: [part.size[0] / keep, part.size[1], part.size[2]], at: [part.at[0] / keep, part.at[1], part.at[2]] };
}

// Inlet face undercut, top falling away to stop short of the rear tyres.
// Airbox and engine cover as one fin down the spine.
const SPINE: Point[] = [[0.4, 0.6], [0.36, 0.9], [0.1, 0.96], [-0.1, 0.9], [-1.6, 0.44], [-1.6, 0.4], [0.4, 0.5]];
const SIDEPOD: Point[] = [[-0.14, 0.22], [-0.1, 0.48], [-0.45, 0.5], [-0.85, 0.42], [-1.08, 0.3], [-1.08, 0.12], [-0.45, 0.12]];

// The rear wing stands over the back of the rear wheels: each endplate is wide at the planes and narrows to a foot on
// the beam, which ties both to the tail.
const RACE_ENDPLATE: Slab = { points: [[-1.58, 1.04], [-2.12, 1.04], [-2.12, 0.39], [-1.96, 0.39], [-1.9, 0.7], [-1.64, 0.8]], from: 0.485, to: 0.515 };
const RACE_BEAM: Part = { size: [0.485, 0.035, 0.18], at: [0.2425, 0.414, -2.02] };
const race_plane = (chord: number, tilt: number): Part => ({ size: [0.485, 0.04, chord], at: [0.2425, 0.9, -1.82], tilt: [tilt, 0, 0] });
const race_flap = (chord: number, tilt: number): Part => ({ size: [0.485, 0.03, chord], at: [0.2425, 0.985, -2.02], tilt: [tilt, 0, 0] });
const race_wing = (plane: Part, flap: Part): Wing => ({ paint: [], trim: [RACE_BEAM, plane, flap], lips: [RACE_ENDPLATE] });

const FORMULA_HUB = 0.33;
// Two legs from the chassis side, `high` and `low` on it, to the hub centre, both square to the car: a raked leg would
// run through the tyre at full lock. They start inside the chassis side and end inside the rim.
const wishbones = (z: number, side: number, high: number, low: number, hub: number): Arm => ({
  pivot: [side, FORMULA_HUB, z],
  trim: [high, low].map((y) => rod([side, y, z], [hub, FORMULA_HUB, z], 0.025, 0.08)),
  markers: [],
});

// Every front wing element stays ahead of the steered tyre, whose corner sweeps to z 1.97 at full lock.
const NOSE_FLAP_Z = 2.09;
const nose_flap = (chord: number, y: number, tilt: number): Part => on_nose({ size: [0.6, 0.03, chord], at: [0.6, y, NOSE_FLAP_Z], tilt: [tilt, 0, 0] });

const BUS_OUTLINE: Point[] = [[5.84, 0.35], [5.9, 0.46], [5.92, 0.98], [5.88, 1.15], [-6.12, 1.15], [-6.16, 1.0], [-6.16, 0.46], [-6.1, 0.35]];
const BUS_TAIL = tail_end(BUS_OUTLINE, 0.78, 0.5, 1.2, [{ size: [0.16, 0.46, 0.05], at: [1.08, 0.78, 0] }], { half: 1.0, y: 0.84, h: 0.05 }, 0.66);

export const DESIGNS: Record<BodyStyle, Design> = {
  coupe: {
    outline: COUPE_OUTLINE,
    width: 1.88,
    sill: 0.3,
    cabin: COUPE_CABIN,
    section: COUPE_SECTION,
    arches: COUPE_ARCHES,
    heads: [{ size: [0.42, 0.07, 0.05], at: [0.6, 0.48, 2.335] }],
    tails: COUPE_TAIL.tails,
    paint: mirror(COUPE_CABIN, COUPE_SECTION.shoulder),
    trim: [
      COUPE_GRILLE,
      { size: [0.94, 0.12, 0.08], at: [0.47, 0.356, 2.3] },
      { size: [0.94, 0.12, 0.08], at: [0.47, 0.356, -2.3] },
      ...COUPE_TAIL.trim,
    ],
    markers: [],
    chrome: COUPE_TAIL.chrome,
    tyre: [0.28, 0.3],
    rim: { size: 0.68, spokes: 6, tone: "metal", lip: 0.18 },
    deck: [-2.14, 0.93],
    wings: COUPE_WINGS,
    hood: [1.5, 0.74],
    exhaust: [0.55, 0.3, -2.3],
    kit: COUPE_KIT,
  },
  hatch: {
    outline: HATCH_OUTLINE,
    width: 1.7,
    sill: 0.3,
    cabin: HATCH_CABIN,
    section: HATCH_SECTION,
    arches: HATCH_ARCHES,
    heads: [{ size: [0.34, 0.16, 0.05], at: [0.56, 0.6, 1.95] }],
    tails: HATCH_TAIL.tails,
    paint: mirror(HATCH_CABIN, HATCH_SECTION.shoulder),
    trim: [
      { size: [0.25, 0.12, 0.05], at: [0.125, 0.6, 1.95] },
      { size: [0.88, 0.14, 0.1], at: [0.44, 0.38, 1.93] },
      { size: [0.88, 0.14, 0.1], at: [0.44, 0.38, -1.95] },
      ...HATCH_TAIL.trim,
    ],
    markers: [],
    chrome: HATCH_TAIL.chrome,
    tyre: [0.24, 0.24],
    rim: { size: 0.64, spokes: 5, tone: "metal", spoke: 0.07 },
    deck: [-1.3, 1.37],
    hood: [1.35, 0.8],
    exhaust: [0.5, 0.32, -1.92],
    wings: HATCH_WINGS,
    kit: {
      arches: { ...HATCH_ARCHES, gap: 0.065, flare: 0.09, out: 0.1 },
      tyre: [0.28, 0.28],
    },
  },
  muscle: {
    outline: MUSCLE_OUTLINE,
    width: 1.98,
    sill: 0.28,
    cabin: MUSCLE_CABIN,
    section: MUSCLE_SECTION,
    arches: MUSCLE_ARCHES,
    heads: [
      { size: [0.17, 0.15, 0.04], at: [0.74, 0.6, 2.56] },
      { size: [0.17, 0.15, 0.04], at: [0.52, 0.6, 2.56] },
    ],
    tails: MUSCLE_TAIL.tails,
    paint: mirror(MUSCLE_CABIN, MUSCLE_SECTION.shoulder),
    trim: [{ size: [0.9, 0.26, 0.04], at: [0.45, 0.6, 2.55] }, ...MUSCLE_TAIL.trim],
    stripes: [
      { size: [0.12, 0.012, 0.86], at: [0.12, 0.825, 2.02], tilt: [HOOD_FALL, 0, 0] },
      { size: [0.12, 0.012, 0.64], at: [0.12, 0.873, 0.58], tilt: [HOOD_FALL, 0, 0] },
      { size: [0.12, 0.012, 0.8], at: [0.12, 1.247, -0.825], tilt: [0.024, 0, 0] },
      { size: [0.12, 0.012, 0.6], at: [0.12, 0.972, -2.08], tilt: [0.014, 0, 0] },
    ],
    markers: [],
    chrome: [{ size: [1.0, 0.12, 0.12], at: [0.5, 0.36, 2.5] }, { size: [1.0, 0.12, 0.12], at: [0.5, 0.36, -2.5] }, ...MUSCLE_TAIL.chrome],
    tyre: [0.3, 0.42],
    rim: { size: 0.64, spokes: 5, tone: "metal", lip: 0.22, spoke: 0.08 },
    deck: [-2.2, 0.965],
    wings: MUSCLE_WINGS,
    hood: [1.95, 0.82],
    exhaust: [0.5, 0.26, -2.44],
    kit: {
      arches: { ...MUSCLE_ARCHES, gap: 0.08, flare: 0.08, out: 0.12 },
      tyre: [0.34, 0.5],
    },
  },
  rally: {
    outline: RALLY_OUTLINE,
    width: 1.8,
    sill: 0.38,
    cabin: RALLY_CABIN,
    section: RALLY_SECTION,
    arches: { gap: 0.07, steps: 7, flare: 0.07, out: 0.05, reach: 0.04, tone: "trim" },
    heads: [RALLY_HEAD],
    tails: RALLY_TAIL.tails,
    paint: RALLY_MIRROR,
    trim: [...RALLY_BUMPERS, ...RALLY_TAIL.trim],
    markers: [],
    chrome: RALLY_TAIL.chrome,
    tyre: [0.24, 0.24],
    rim: { size: 0.58, spokes: 5, tone: "metal", spoke: 0.07 },
    deck: [-1.22, 1.36],
    hood: [1.6, 0.84],
    exhaust: [0.55, 0.4, -1.85],
    wings: RALLY_WINGS,
    kit: {
      arches: { gap: 0.09, steps: 7, flare: 0.09, out: 0.1, reach: 0.04, tone: "trim" },
      tyre: [0.3, 0.3],
      rim: { size: 0.62, spokes: 6, tone: "light", spoke: 0.07 },
    },
  },
  kaze: KAZE_DESIGN,
  sturm: STURM_DESIGN,
  raijin: RAIJIN_DESIGN,
  bus: {
    outline: BUS_OUTLINE,
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
    arches: { gap: 0.06, steps: 7, flare: 0.04, out: 0.02, reach: 0.04, tone: "trim" },
    heads: [{ size: [0.34, 0.16, 0.05], at: [0.9, 0.62, 5.92] }],
    tails: BUS_TAIL.tails,
    paint: [
      { size: [0.06, 0.32, 0.14], at: [1.5, 2.28, 5.55] },
      { size: [0.26, 0.04, 0.04], at: [1.36, 2.46, 5.58] },
      { size: [0.8, 0.2, 2.6], at: [0.4, 3.12, -1.4] },
      ...[2.6, 1.3, 0, -1.3, -2.6, -5.1].map((z): Part => ({ size: [0.03, 1.38, 0.1], at: [1.255, 1.92, z] })),
    ],
    trim: [
      { size: [0.03, 2.2, 1.1], at: [1.258, 1.5, 4.75] },
      { size: [0.03, 2.2, 1.1], at: [1.258, 1.5, -4.15] },
      { size: [1.26, 0.24, 0.1], at: [0.63, 0.44, 5.9] },
      { size: [1.26, 0.24, 0.1], at: [0.63, 0.44, -6.16] },
      ...BUS_TAIL.trim,
    ],
    stripes: [{ size: [0.02, 0.08, 11.6], at: [1.256, 1.21, -0.1] }],
    markers: [{ size: [0.86, 0.2, 0.04], at: [0.43, 2.72, 5.79] }],
    chrome: [
      { size: [0.035, 2.1, 0.03], at: [1.262, 1.5, 4.75] },
      { size: [0.035, 2.1, 0.03], at: [1.262, 1.5, -4.15] },
      ...BUS_TAIL.chrome,
    ],
    tyre: [0.3, 0.42],
    rim: { size: 0.56, spokes: 8, tone: "light", lip: 0.3 },
    deck: [-5.7, 3.02],
    hood: [-5.4, 3.02],
    eye: [6.05, 2.3],
    exhaust: [0.8, 0.42, -6.16],
  },
  formula: {
    outline: [[FORMULA_NOSE, 0.2], [2.32, 0.27], [2.1, 0.34], [1.3, 0.5], [0.98, 0.6], [0.9, 0.56], [0.42, 0.56], [0.3, 0.68], [-0.2, 0.7], [-1.2, 0.5], [-1.85, 0.38], [-2.0, 0.36], [-2.0, 0.12]],
    width: 0.44,
    section: FORMULA_SECTION,
    sill: 0.1,
    cabin: { points: [[0.8, 0.54], [0.83, 0.7], [0.76, 0.8], [0.62, 0.82], [0.52, 0.75], [0.5, 0.54]], width: 0.26, tumble: 0.3, frame: [], screens: [], helmet: true, visor: [[0.842, 0.68], [0.797, 0.765], [0.66, 0.765], [0.66, 0.68]] },
    arches: { gap: 0, steps: 0, flare: 0, out: 0, reach: 0, tone: "trim" },
    heads: [{ size: [0.05, 0.035, 0.14], at: [0.21, 0.38, 1.75], tilt: [0.18, 0, 0] }],
    tails: [{ size: [0.07, 0.08, 0.03], at: [0.035, 0.22, -2.135] }],
    paint: [on_nose({ size: [0.03, 0.18, 0.38], at: [0.915, 0.2, 2.19] })],
    trim: [
      { size: [0.62, 0.04, 2.16], at: [0.31, 0.115, -0.08] },
      { size: [0.5, 0.04, 0.34], at: [0.25, 0.115, -1.33] },
      on_nose({ size: [0.9, 0.035, 0.34], at: [0.45, 0.14, 2.17] }),
      on_nose({ size: [0.04, 0.1, 0.12], at: [0.07, 0.19, 2.2] }),
      { size: [0.03, 0.52, 0.16], at: [0.015, 0.64, -1.84] },
      { size: [0.36, 0.18, 0.03], at: [0.44, 0.36, -0.118], tilt: [-0.15, 0, 0] },
      { size: [0.08, 0.12, 0.24], at: [0.04, 0.22, -2.0] },
    ],
    markers: [],
    chrome: [],
    tyre: [0.32, 0.42],
    rim: { size: 0.6, spokes: 0, tone: "metal" },
    deck: [-2.0, 0.6],
    hood: [-0.6, 0.62],
    exhaust: [0, 0.34, -1.98],
    taper: { from: -0.3, share: 0.42 },
    arms: [wishbones(1.6, 0.16, 0.4, 0.25, 0.7), wishbones(-1.45, 0.1, 0.4, 0.22, 0.66)],
    wings: [
      race_wing(race_plane(0.3, 0.1), race_flap(0.12, 0.4)),
      race_wing(race_plane(0.32, 0.14), race_flap(0.15, 0.5)),
      race_wing(race_plane(0.36, 0.18), race_flap(0.18, 0.6)),
    ],
    fronts: [
      { paint: [], trim: [nose_flap(0.14, 0.2, 0.2)] },
      { paint: [], trim: [nose_flap(0.17, 0.205, 0.3)] },
      { paint: [], trim: [nose_flap(0.17, 0.205, 0.3), nose_flap(0.12, 0.265, 0.45)] },
    ],
    slabs: [
      { points: SIDEPOD, from: 0.2, to: 0.66 },
      { points: SPINE, from: 0, to: 0.07 },
    ],
    panel: { rear: -0.86, front: -0.2, low: 0.16, high: 0.4, side: 0.66 },
    eye: [0.7, 0.84],
  },
  fujin: FUJIN_DESIGN,
  sajin: SAJIN_DESIGN,
  tsumuji: TSUMUJI_DESIGN,
};

import type { BodyStyle, Triple } from "./cars";
import type { Panel } from "./livery";
import type { Token } from "../theme/theme";
import { BUS_DESIGN } from "./bus-design";
import { COUPE_DESIGN } from "./coupe-design";
import { FORMULA_DESIGN } from "./formula-design";
import { FUJIN_DESIGN } from "./fujin-design";
import { HATCH_DESIGN } from "./hatch-design";
import { KAZE_DESIGN } from "./kaze-design";
import { MUSCLE_DESIGN } from "./muscle-design";
import { RAIJIN_DESIGN } from "./raijin-design";
import { RALLY_DESIGN } from "./rally-design";
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

/** A mirror by tone: the housing in paint, its arm or stalk and the glass face in trim. Drawn once per side. */
export interface Mirror {
  paint: Part[];
  trim: Part[];
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
  /** The door mirrors, kept apart from `paint` and `trim` so a viewer can draw them alone. */
  mirror?: Mirror;
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
  /** A second part the build must also have fitted. */
  with?: Fit;
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

export type Kit = Partial<Pick<Design, "outline" | "width" | "sill" | "section" | "wings" | "mirror" | "arches" | "slabs" | "heads" | "tails" | "paint" | "trim" | "markers" | "chrome" | "tyre" | "rim" | "caliper">>;

/** The shoulder a kit shell `wide` across needs for its body top to stay where the stock body's is. */
export function kit_shoulder(stock: number, shoulder: number, wide: number): number {
  return 1 - (stock * (1 - shoulder)) / wide;
}

export const DESIGNS: Record<BodyStyle, Design> = {
  coupe: COUPE_DESIGN,
  hatch: HATCH_DESIGN,
  muscle: MUSCLE_DESIGN,
  rally: RALLY_DESIGN,
  kaze: KAZE_DESIGN,
  sturm: STURM_DESIGN,
  raijin: RAIJIN_DESIGN,
  bus: BUS_DESIGN,
  formula: FORMULA_DESIGN,
  fujin: FUJIN_DESIGN,
  sajin: SAJIN_DESIGN,
  tsumuji: TSUMUJI_DESIGN,
};

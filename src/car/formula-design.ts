import { endplate, leg, plane, rod, stalk_mirror } from "./design-parts";
import type { Arm, Design, Section, Slab, Wing } from "./designs";
import type { Part, Point } from "./geometry";

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

// On the cockpit side, level with the driver's eyes.
const FORMULA_MIRROR = stalk_mirror([0.21, 0.6, 0.74], "side");

const FORMULA_OUTLINE: Point[] = [[FORMULA_NOSE, 0.2], [2.32, 0.27], [2.1, 0.34], [1.3, 0.5], [0.98, 0.6], [0.9, 0.56], [0.42, 0.56], [0.3, 0.68], [-0.2, 0.7], [-1.2, 0.5], [-1.85, 0.38], [-2.0, 0.36], [-2.0, 0.12]];
const [NOSE_FOOT, TAIL_FOOT] = [FORMULA_OUTLINE[0], FORMULA_OUTLINE[FORMULA_OUTLINE.length - 1]];
const under = (z: number) => TAIL_FOOT[1] + ((NOSE_FOOT[1] - TAIL_FOOT[1]) * (z - TAIL_FOOT[0])) / (NOSE_FOOT[0] - TAIL_FOOT[0]);
const FLOOR_THICK = 0.035;
const FLOOR_SEAT = 0.008;
const floor_strip = (from: number, to: number, front: number, rear: number): Part => {
  const y = (z: number) => under(z) + FLOOR_SEAT - FLOOR_THICK / 2;
  const x = (from + to) / 2;
  return rod([x, y(front), front], [x, y(rear), rear], FLOOR_THICK, to - from);
};
// One plate on the tub's own underside, with nothing hung under the nose: it starts at the sidepod inlets, runs full
// width to the rear tyres and on between them to the gearbox.
const FORMULA_FLOOR: Part[] = [floor_strip(0, 0.44, 0.02, -1.6), floor_strip(0.44, 0.68, 0.02, -1.1)];
// The front wing's main plane runs through the nose foot, so the nose stands on it without pylons.
const NOSE_PLANE_Z = 2.17;
const NOSE_PLANE_Y = under(NOSE_PLANE_Z) - 0.003;
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
const nose_flap = (chord: number, lift: number, tilt: number): Part => on_nose({ size: [0.6, 0.03, chord], at: [0.6, NOSE_PLANE_Y + lift, NOSE_FLAP_Z], tilt: [tilt, 0, 0] });

export const FORMULA_DESIGN: Design = {
  outline: FORMULA_OUTLINE,
  width: 0.44,
  section: FORMULA_SECTION,
  sill: 0.225,
  cabin: { points: [[0.8, 0.54], [0.83, 0.7], [0.76, 0.8], [0.62, 0.82], [0.52, 0.75], [0.5, 0.54]], width: 0.26, tumble: 0.3, frame: [], screens: [], helmet: true, visor: [[0.842, 0.68], [0.797, 0.765], [0.66, 0.765], [0.66, 0.68]] },
  arches: { gap: 0, steps: 0, flare: 0, out: 0, reach: 0, tone: "trim" },
  heads: [{ size: [0.05, 0.035, 0.14], at: [0.21, 0.38, 1.75], tilt: [0.18, 0, 0] }],
  tails: [{ size: [0.07, 0.08, 0.03], at: [0.035, 0.22, -2.135] }],
  mirror: FORMULA_MIRROR,
  paint: [on_nose({ size: [0.03, 0.2, 0.38], at: [0.915, NOSE_PLANE_Y + 0.05, 2.19] })],
  trim: [
    ...FORMULA_FLOOR,
    on_nose({ size: [0.9, 0.035, 0.34], at: [0.45, NOSE_PLANE_Y, NOSE_PLANE_Z] }),
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
    { paint: [], trim: [nose_flap(0.14, 0.06, 0.2)] },
    { paint: [], trim: [nose_flap(0.17, 0.065, 0.3)] },
    { paint: [], trim: [nose_flap(0.17, 0.065, 0.3), nose_flap(0.12, 0.125, 0.45)] },
  ],
  slabs: [
    { points: SIDEPOD, from: 0.2, to: 0.66 },
    { points: SPINE, from: 0, to: 0.07 },
  ],
  panel: { rear: -0.86, front: -0.2, low: 0.16, high: 0.4, side: 0.66 },
  eye: [0.7, 0.84],
};

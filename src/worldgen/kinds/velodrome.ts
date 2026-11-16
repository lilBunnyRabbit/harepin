import { generate_sky, SKY, type SkyRecipe } from "../sky";
import { SIZE, VELODROME_VERSION, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";
import { knob, tune, type Knob } from "./options";

const DEG = Math.PI / 180;
const PIPES = { most: 2, bank: [28 * DEG, 35 * DEG], length: [140, 180] } as const;
const WALL = { bank: [60 * DEG, 64 * DEG], hold: [40, 60] } as const;

// docs/plan/wall-ride.md: 45-55° on the racing line, a 60-70° kick at each bowl's middle, under the 75° past which a soft car
// can fall through the deck. The bus scrapes from 40° and is out; the Raijin scrapes its floor in a bowl but holds its line.
// Pipes swing to 35° on a straight, where nothing but the tyres holds the car on the slope (tan 35° is well inside every
// car's grip). The wall holds 60-64° for 40-60 m of one bowl with its high rail off: carried over the top, the car falls and
// resets. At 68-72° held 50-80 m the autopilot's muscle, rally and Sajin slid down to the low rail below the wall's neutral
// speed and crashed there.
const VELODROME: SkyRecipe = {
  ...SKY,
  kind: WorldKind.VELODROME,
  // The Wall Ride kind this one took over: under "velodrome" seed 1, which every trackless seed falls back to, finds no track.
  salt: "wallride",
  odds: { eight: 1, helix: 0, hairpin: 0.35 },
  gaps: 1,
  pads: 2,
  open: [0.1, 0.2],
  length: [2400, 5200],
  bowls: { angle: [Math.PI, 1.2 * Math.PI], radius: [40, 60], bank: [45 * DEG, 55 * DEG], kick: [60 * DEG, 70 * DEG] },
  pipes: PIPES,
  wall: WALL,
  excludes: ["bus"],
};

const VELODROME_KNOBS: readonly Knob<SkyRecipe>[] = [
  knob<SkyRecipe, SkyRecipe["length"]>({ field: "E", name: "Length", help: "How long a lap runs.", labels: ["Short", "Normal", "Long"], normal: 1, values: [[2400, 4400], VELODROME.length, [3800, 6400]], set: (r, length) => ({ ...r, length }) }),
  knob<SkyRecipe, number>({ field: "A", name: "Gaps", help: "Gap jumps across open sky.", labels: ["None", "Normal", "More"], normal: 1, values: [0, VELODROME.gaps, 2], set: (r, gaps) => ({ ...r, gaps }) }),
  knob<SkyRecipe, number>({ field: "V", name: "Boost pads", help: "Pads that kick the car forward.", labels: ["None", "Normal", "More"], normal: 1, values: [0, VELODROME.pads, 5], set: (r, pads) => ({ ...r, pads }) }),
  knob<SkyRecipe, SkyRecipe["pipes"]>({ field: "P", name: "Half-pipes", help: "Straights that swing up one side, then the other.", labels: ["None", "Normal", "More"], normal: 1, values: [null, PIPES, { ...PIPES, most: 4 }], set: (r, pipes) => ({ ...r, pipes }) }),
  knob<SkyRecipe, SkyRecipe["wall"]>({ field: "R", name: "Wall ride", help: "One bowl held steep with its high rail off.", labels: ["Off", "On"], switch: true, normal: 1, values: [null, WALL], set: (r, wall) => ({ ...r, wall }) }),
];

export const velodrome = kind_def({
  kind: WorldKind.VELODROME,
  base: 10000,
  tag: "velo",
  version: VELODROME_VERSION,
  size: SIZE,
  generate: (seed, levels) => generate_sky(seed, tune(VELODROME, VELODROME_KNOBS, levels), VELODROME),
  options: VELODROME_KNOBS,
  recipe: null,
  open_ground: false,
  rails: true,
  ground: false,
  fall_reset: true,
  grip: LAND_GRIP,
});

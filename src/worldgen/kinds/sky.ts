import { generate_sky, SKY, type SkyRecipe } from "../sky";
import { knob, tune, type Knob } from "./options";
import { SIZE, SKY_VERSION, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";
import { gaps_knob, length_knob, pads_knob } from "./sky-knobs";

const DEG = Math.PI / 180;
export const PIPES = { most: 2, bank: [28 * DEG, 35 * DEG], length: [140, 180] } as const;
export const WALL = { bank: [60 * DEG, 64 * DEG], hold: [40, 60] } as const;

// docs/plan/wall-ride.md: 45-55° on the racing line, a 60-70° kick at each bowl's middle, under the 75° past which a soft car
// can fall through the deck. The bus scrapes from 40° and is out; the Raijin scrapes its floor in a bowl but holds its line.
// Pipes swing to 35° on a straight, where nothing but the tyres holds the car on the slope (tan 35° is well inside every
// car's grip). The wall holds 60-64° for 40-60 m of one bowl with its high rail off: carried over the top, the car falls and
// resets. At 68-72° held 50-80 m the autopilot's muscle, rally and Sajin slid down to the low rail below the wall's neutral
// speed and crashed there.
export const WALLED: SkyRecipe = {
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

const SKY_KNOBS: readonly Knob<SkyRecipe>[] = [
  length_knob(SKY, [2400, 4400], [3800, 6400]),
  knob<SkyRecipe, SkyRecipe["odds"]>({
    field: "Q",
    name: "Twist",
    help: "Hairpins, helix coils and figure-eights.",
    labels: ["Flowing", "Normal", "Wild"],
    normal: 1,
    values: [{ eight: 0.15, helix: 0.2, hairpin: 0.15 }, SKY.odds, { eight: 0.45, helix: 0.65, hairpin: 0.5 }],
    set: (r, odds) => ({ ...r, odds }),
  }),
  gaps_knob(SKY, 3),
  pads_knob(SKY, 7),
  knob<SkyRecipe, SkyRecipe["open"]>({ field: "F", name: "Open sections", help: "Stretches with no rail to catch you.", labels: ["Railed", "Normal", "Exposed"], normal: 1, values: [[0, 0], SKY.open, [0.35, 0.55]], set: (r, open) => ({ ...r, open }) }),
];

/** Base 1000 keeps it off the island's ids, so old builds see a sky peer as on a foreign map. */
export const sky = kind_def({
  kind: WorldKind.SKY,
  base: 1000,
  tag: "sky",
  version: SKY_VERSION,
  size: SIZE,
  generate: (seed, levels) => generate_sky(seed, tune(SKY, SKY_KNOBS, levels)),
  options: SKY_KNOBS,
  recipe: null,
  open_ground: false,
  rails: true,
  ground: false,
  fall_reset: true,
  grip: LAND_GRIP,
});

import { generate_raceway, hills, RACEWAY, type RacewayRecipe } from "../raceway";
import type { LapRecipe } from "../raceway-plan";
import { SIZE, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";
import { knob, tune, type Knob } from "./options";

export const RACEWAY_VERSION = 2;

const lap = <V>(set: (lap: LapRecipe, value: V) => LapRecipe) => (r: RacewayRecipe, value: V): RacewayRecipe => ({ ...r, lap: set(r.lap, value) });

type Straights = Pick<LapRecipe, "length" | "link" | "back">;
type Mix = Pick<LapRecipe, "odds" | "counter" | "sweeper">;

const SHORT: Straights = { length: [2800, 3400], link: [40, 160], back: [450, 650] };
const LONG: Straights = { length: [3700, 4200], link: [120, 320], back: [650, 900] };
const FLOWING: Mix = { odds: { hairpin: 0, double: 0.2, kink: 1, chicane: 0 }, counter: [100, 180], sweeper: [180, 300] };
const TECHNICAL: Mix = { odds: { hairpin: 0.8, double: 0.8, kink: 0.2, chicane: 1 }, counter: [40, 90], sweeper: [80, 160] };

export const RACEWAY_KNOBS: readonly Knob<RacewayRecipe>[] = [
  knob<RacewayRecipe, Straights>({ field: "E", name: "Length", help: "How long a lap runs.", labels: ["Short", "Normal", "Long"], normal: 1, values: [SHORT, RACEWAY.lap, LONG], set: lap((l, straights) => ({ ...l, ...straights })) }),
  knob<RacewayRecipe, RacewayRecipe["terrain"]>({ field: "H", name: "Hills", help: "How far the lap climbs and falls.", labels: ["Flat", "Gentle", "Rolling"], normal: 1, values: [hills(12), RACEWAY.terrain, hills(95)], set: (r, terrain) => ({ ...r, terrain }) }),
  knob<RacewayRecipe, Mix>({ field: "C", name: "Corners", help: "Fast sweepers, or hairpins and chicanes.", labels: ["Flowing", "Mixed", "Technical"], normal: 1, values: [FLOWING, RACEWAY.lap, TECHNICAL], set: lap((l, mix) => ({ ...l, ...mix })) }),
  knob<RacewayRecipe, number>({ field: "R", name: "Run-off", help: "Grass between the road and the trees.", labels: ["Narrow", "Normal", "Wide"], normal: 1, values: [18, RACEWAY.runoff, 54], set: (r, runoff) => ({ ...r, runoff }) }),
];

export const raceway = kind_def({
  kind: WorldKind.RACEWAY,
  base: 13000,
  tag: "rw",
  version: RACEWAY_VERSION,
  size: SIZE,
  generate: (seed, levels) => generate_raceway(seed, tune(RACEWAY, RACEWAY_KNOBS, levels)),
  options: RACEWAY_KNOBS,
  recipe: null,
  open_ground: true,
  rails: false,
  ground: true,
  fall_reset: false,
  grip: LAND_GRIP,
});

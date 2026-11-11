import { generate_sky, SKY, type SkyRecipe } from "../sky";
import { knob, tune, type Knob } from "./options";
import { SIZE, SKY_VERSION, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";

const SKY_KNOBS: readonly Knob<SkyRecipe>[] = [
  knob<SkyRecipe, SkyRecipe["length"]>({ field: "E", name: "Length", help: "How long a lap runs.", labels: ["Short", "Normal", "Long"], normal: 1, values: [[2400, 4400], SKY.length, [3800, 6400]], set: (r, length) => ({ ...r, length }) }),
  knob<SkyRecipe, SkyRecipe["odds"]>({
    field: "Q",
    name: "Twist",
    help: "Hairpins, helix coils and figure-eights.",
    labels: ["Flowing", "Normal", "Wild"],
    normal: 1,
    values: [{ eight: 0.15, helix: 0.2, hairpin: 0.15 }, SKY.odds, { eight: 0.45, helix: 0.65, hairpin: 0.5 }],
    set: (r, odds) => ({ ...r, odds }),
  }),
  knob<SkyRecipe, number>({ field: "A", name: "Gaps", help: "Gap jumps across open sky.", labels: ["None", "Normal", "More"], normal: 1, values: [0, SKY.gaps, 3], set: (r, gaps) => ({ ...r, gaps }) }),
  knob<SkyRecipe, number>({ field: "V", name: "Boost pads", help: "Pads that kick the car forward.", labels: ["None", "Normal", "More"], normal: 1, values: [0, SKY.pads, 7], set: (r, pads) => ({ ...r, pads }) }),
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

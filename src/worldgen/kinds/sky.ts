import { generate_sky, SKY, type SkyRecipe } from "../sky";
import { knob, tune, type Knob } from "./options";
import { SIZE, SKY_VERSION, WorldKind } from "../types";
import { kind_def, LAND_GRIP } from "./kind-def";
import { gaps_knob, length_knob, pads_knob } from "./sky-knobs";

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

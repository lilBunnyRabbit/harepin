import { DUNE_SEA_SIZE } from "../worldgen/dune-sea";
import { tones } from "../theme/palette";
import { WorldKind } from "../worldgen/types";
import type { WorldDef } from "./world-def";

export const big_dunes: WorldDef = {
  kind: WorldKind.BIG_DUNES,
  listed: true,
  mini: true,
  name: "Big dunes",
  pick: "Dune bashing across a sea of sand",
  note: "Open sand, crests to jump, no roads",
  hero: "Free roam. The sand streams in around you. Loose sand eats speed: the off-road cars bash the dunes, the rest struggle.",
  drawing: "Drawing the big dunes…",
  map_label: "big dunes",
  pads: false,
  mood: { hemi_ground: tones.sand, fog_near: 60, fog_far: 950 },
  ground_puff: "dust",
  backdrop: "sky",
  facts: () => [[`${(DUNE_SEA_SIZE / 1000).toFixed(0)} km`, "of sand across"]],
  dress: () => [],
};

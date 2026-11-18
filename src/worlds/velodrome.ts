import { PLAIN_KIT } from "../render/prop-kit";
import { cloud_floor, sky_tones } from "../render/sky";
import { brand, carbon, dark, lighten, mix } from "../theme/palette";
import { WorldKind } from "../worldgen/types";
import { bowl_dress } from "./sky";
import { lap_facts, type WorldDef } from "./world-def";

const DEG = Math.PI / 180;

// Legend's graphite, a step up: the tow's own tone left the flat stretches a black ribbon at dusk.
const DECK = lighten(carbon.thread, dark ? 0.1 : 0.06);
// The cloud sea under a floodlit arena is lit by the sky alone: the theme's sunlit tan read as desert.
const CLOUD_LIT = mix(sky_tones.skylight, brand.background, 0.45);

export const velodrome: WorldDef = {
  kind: WorldKind.VELODROME,
  listed: true,
  mini: true,
  name: "Velodrome",
  label: "Velodrome",
  pick: "Bowls, half-pipes and a wall above the clouds",
  note: "Banked bowls, half-pipes, a wall ride",
  hero: "Steep bowls in the clouds: carry the speed or go over the top of the wall.",
  drawing: "Drawing velodrome…",
  map_label: "velodrome",
  pads: true,
  mood: { key: sky_tones.skylight, fog_near: 70, fog_far: 800 },
  deck: { deck: DECK, side: carbon.base, rail: lighten(DECK, 0.08), joint: lighten(DECK, -0.06), pad: brand.accent, chevron: lighten(brand.accent, -0.16) },
  ground_puff: "grass",
  backdrop: "sky",
  facts: (f) => lap_facts(f, "track"),
  dress: (world) => {
    if (!world.deck) throw new Error("velodrome: no deck");
    return [cloud_floor(world, CLOUD_LIT, brand.background_dark), ...bowl_dress(world.deck.deck)];
  },
  kit: PLAIN_KIT,
  wall_view: 20 * DEG,
};

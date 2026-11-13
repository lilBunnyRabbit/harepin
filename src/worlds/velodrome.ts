import { masts, pylons } from "../render/arena";
import { deck_marks, type DeckBand } from "../render/deck-marks";
import { PLAIN_KIT } from "../render/prop-kit";
import { cloud_floor, sky_tones } from "../render/sky";
import { brand, carbon, dark, lighten, mix, tones } from "../theme/palette";
import { WorldKind } from "../worldgen/types";
import { lap_facts, type WorldDef } from "./world-def";

const DEG = Math.PI / 180;
const BOWL = 25 * DEG;
// Past this the low edge of a kick is the foot of a wall, and a line there read as a second rail.
const EDGE_BANK = 60 * DEG;

// Legend's graphite, a step up: the tow's own tone left the flat stretches a black ribbon at dusk.
const DECK = lighten(carbon.thread, dark ? 0.1 : 0.06);
const PAINT = dark ? lighten(brand.foreground, 0.18) : brand.background_lightest;
const EDGES: DeckBand[] = [
  { from: -0.94, to: -0.84, tone: PAINT },
  { from: 0.84, to: 0.94, tone: PAINT },
];
const LANES: DeckBand[] = [
  { from: -0.34, to: -0.3, tone: PAINT, high: true, dash: 6, gap: 6 },
  { from: 0.3, to: 0.34, tone: PAINT, high: true, dash: 6, gap: 6 },
  { from: 0.72, to: 1, tone: mix(brand.error, carbon.base, 0.8), high: true },
];

export const velodrome: WorldDef = {
  kind: WorldKind.VELODROME,
  listed: false,
  mini: true,
  name: "Velodrome",
  pick: "A track of steep bowls above the clouds",
  note: "Banked bowls, wall kicks, rails",
  hero: "Steep bowls in the clouds: carry the speed and ride the wall.",
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
    const deck = world.deck.deck;
    return [
      cloud_floor(world, mix(sky_tones.skylight, brand.background, 0.45), brand.background_dark),
      deck_marks(deck, LANES, (bank) => Math.abs(bank) >= BOWL),
      deck_marks(deck, EDGES, (bank) => Math.abs(bank) < EDGE_BANK),
      ...masts(deck, { post: carbon.thread, lamp: tones.head }, BOWL),
      pylons(deck, mix(carbon.thread, carbon.base, 0.2), 60),
    ];
  },
  kit: PLAIN_KIT,
  wall_view: 20 * DEG,
};

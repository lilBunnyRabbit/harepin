import type * as THREE from "three";
import { masts, pylons } from "../render/arena";
import { deck_marks, type DeckBand } from "../render/deck-marks";
import { PLAIN_KIT } from "../render/prop-kit";
import { cloud_floor } from "../render/sky";
import { brand, carbon, dark, lighten, mix, tones } from "../theme/palette";
import { walled } from "../worldgen/kinds/sky";
import { WorldKind, type Deck } from "../worldgen/types";
import { lap_facts, shown, type WorldDef } from "./world-def";

const DEG = Math.PI / 180;
const BOWL = 25 * DEG;
// Past this the low edge of a kick is the foot of a wall, and a line there read as a second rail.
const EDGE_BANK = 60 * DEG;
const PYLON_PITCH = 60;
// The old Velodrome's: pipes (28-35°) lean part way, bowls (45-55°) and the wall all the way.
const WALL_VIEW = 20 * DEG;

const PAINT = dark ? lighten(brand.foreground, 0.18) : brand.background_lightest;
const EDGES: DeckBand[] = [
  { from: -0.94, to: -0.84, tone: PAINT },
  { from: 0.84, to: 0.94, tone: PAINT },
];
const PYLON = mix(carbon.thread, carbon.base, 0.2);
const LANES: DeckBand[] = [
  { from: -0.34, to: -0.3, tone: PAINT, high: true, dash: 6, gap: 6 },
  { from: 0.3, to: 0.34, tone: PAINT, high: true, dash: 6, gap: 6 },
  { from: 0.72, to: 1, tone: mix(brand.error, carbon.base, 0.8), high: true },
];

/** Lane paint over the bowls and pipes, edge lines, floodlight masts over the bowls and pylons under the deck. */
const bowl_dress = (deck: Deck): THREE.Object3D[] => [
  deck_marks(deck, LANES, (bank) => Math.abs(bank) >= BOWL),
  deck_marks(deck, EDGES, (bank) => Math.abs(bank) < EDGE_BANK),
  ...masts(deck, { post: carbon.thread, lamp: tones.head }, BOWL),
  pylons(deck, PYLON, PYLON_PITCH),
];

export const sky: WorldDef = {
  kind: WorldKind.SKY,
  listed: true,
  mini: true,
  name: "Sky Track",
  label: "Sky",
  pick: "A toy circuit floating in the clouds",
  note: "Drops, rails, jumps, boost pads",
  hero: "A toy circuit in the clouds: drops, rails, jumps and boost pads.",
  drawing: "Drawing track…",
  map_label: "sky track",
  pads: true,
  mood: {},
  ground_puff: "grass",
  backdrop: "sky",
  facts: (f) => [...lap_facts(f, "track"), [shown(f, (f) => String(f.gaps)), f?.gaps === 1 ? "gap to fly over" : "gaps to fly over"]],
  dress: (world) => (world.deck && walled(world.levels) ? [cloud_floor(world), ...bowl_dress(world.deck.deck)] : [cloud_floor(world)]),
  kit: PLAIN_KIT,
  wall_view: (world) => (walled(world.levels) ? WALL_VIEW : null),
};

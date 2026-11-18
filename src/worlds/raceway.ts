import { curbs } from "../car/trackside";
import { WorldKind } from "../worldgen/types";
import { lap_facts, type WorldDef } from "./world-def";
import { PLAIN_KIT } from "../render/prop-kit";
import { stadium } from "./raceway-stadium";

export const raceway: WorldDef = {
  kind: WorldKind.RACEWAY,
  listed: true,
  mini: true,
  name: "Raceway",
  label: "Raceway",
  pick: "A race circuit over low hills: hairpin, esses, long straights",
  note: "Hairpins, esses, kerbs and grass run-off",
  hero: "A race circuit. Kerbs mark the inside of each corner, the grass costs you grip. Flags start the lap and the field race.",
  drawing: "Drawing the raceway…",
  map_label: "raceway",
  pads: false,
  mood: {},
  ground_puff: "grass",
  backdrop: "sky",
  facts: (f) => lap_facts(f, "lap"),
  dress: (world) => [curbs(world), ...stadium(world)],
  kit: PLAIN_KIT,
};

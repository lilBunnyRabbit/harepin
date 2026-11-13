import { roadside } from "../car/trackside";
import { WorldKind } from "../worldgen/types";
import { lap_facts, type WorldDef } from "./world-def";
import { PLAIN_KIT } from "../render/prop-kit";

export const lab: WorldDef = {
  kind: WorldKind.LAB,
  listed: false,
  mini: false,
  name: "Feel lab",
  pick: "Test stations on every surface",
  note: "Skidpads, slalom, runways, kickers",
  hero: "The feel lab: nothing here is saved to your records.",
  drawing: "Drawing lab…",
  map_label: "feel lab",
  pads: false,
  mood: {},
  ground_puff: "grass",
  backdrop: "sky",
  facts: (f) => lap_facts(f, "oval"),
  dress: (world) => [roadside(world)],
  kit: PLAIN_KIT,
};

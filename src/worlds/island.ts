import { roadside } from "../car/trackside";
import { water_mesh } from "../render/scene";
import { WorldKind } from "../worldgen/types";
import { lap_facts, shown, type WorldDef } from "./world-def";

export const island: WorldDef = {
  kind: WorldKind.ISLAND,
  listed: true,
  name: "Island",
  pick: "Roam an island with towns and a circuit",
  note: "Towns, hills and every challenge",
  hero: "Free roam. Flags on the orange circuit start the challenges.",
  drawing: "Drawing island…",
  map_label: "island",
  pads: false,
  mood: {},
  ground_puff: "grass",
  backdrop: "sky",
  facts: (f) => [...lap_facts(f, "circuit"), [shown(f, (f) => String(f.towns)), "towns"]],
  dress: (world) => [roadside(world), water_mesh(world.tiles.ext.size)],
};

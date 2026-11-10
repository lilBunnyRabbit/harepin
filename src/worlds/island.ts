import { roadside } from "../car/models";
import { water_mesh } from "../scene";
import { WorldKind } from "../worldgen/types";
import { lap_facts, shown, type WorldDef } from "./world-def";

export const island: WorldDef = {
  kind: WorldKind.ISLAND,
  name: "Island",
  pick: "Roam an island with towns and a circuit",
  note: "Towns, hills and every challenge",
  hero: "Free roam. Flags on the orange circuit start the challenges.",
  drawing: "Drawing island…",
  map_label: "island",
  pads: false,
  facts: (f) => [...lap_facts(f, "circuit"), [shown(f, (f) => String(f.towns)), "towns"]],
  dress: (world) => [roadside(world), water_mesh()],
};

import { roadside } from "../car/trackside";
import { tones } from "../theme/palette";
import { WorldKind } from "../worldgen/types";
import { lap_facts, shown, type WorldDef } from "./world-def";

export const desert: WorldDef = {
  kind: WorldKind.DESERT,
  listed: true,
  name: "Desert",
  pick: "Dunes, mesas and a fast loop through the sand",
  note: "Sand, mesas and dune jumps",
  hero: "Free roam. Hardpack is quick, loose sand slides. Flags on the orange circuit start the challenges.",
  drawing: "Drawing desert…",
  map_label: "desert",
  pads: false,
  // Sand throws a warm bounce up under the car, and dust pulls the haze in.
  mood: { hemi_ground: tones.dirt, fog_near: 80, fog_far: 1100 },
  ground_puff: "dust",
  backdrop: "sky",
  facts: (f) => [...lap_facts(f, "circuit"), [shown(f, (f) => String(f.towns)), f?.towns === 1 ? "outpost" : "outposts"]],
  dress: (world) => [roadside(world)],
};

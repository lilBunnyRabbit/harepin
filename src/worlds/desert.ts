import { roadside } from "../car/trackside";
import { tones } from "../theme/palette";
import { WorldKind } from "../worldgen/types";
import { lap_facts, shown, type WorldDef } from "./world-def";
import { PLAIN_KIT } from "../render/prop-kit";

export const desert: WorldDef = {
  kind: WorldKind.DESERT,
  listed: true,
  mini: true,
  name: "Dune sea",
  pick: "Dune crests, hardpack pans and a fast loop through the sand",
  note: "Dune crests, pans and outposts",
  hero: "Free roam. The pale pans are quick, loose sand slides. Flags on the orange circuit start the challenges.",
  drawing: "Drawing the dune sea…",
  map_label: "desert",
  pads: false,
  // Sand throws a warm bounce up under the car, and blown dust pulls a close haze in over the crests.
  mood: { hemi_ground: tones.sand, fog_near: 60, fog_far: 950 },
  upland: tones.desert_upland,
  ground_puff: "dust",
  backdrop: "sky",
  facts: (f) => [...lap_facts(f, "circuit"), [shown(f, (f) => String(f.towns)), f?.towns === 1 ? "outpost" : "outposts"]],
  dress: (world) => [roadside(world)],
  kit: PLAIN_KIT,
};

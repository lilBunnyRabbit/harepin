import { water_mesh } from "../render/scene";
import { WorldKind } from "../worldgen/types";
import { shown, type WorldDef } from "./world-def";
import { PLAIN_KIT } from "../render/prop-kit";

export const mainland: WorldDef = {
  kind: WorldKind.MAINLAND,
  listed: true,
  mini: false,
  name: "Mainland",
  pick: "Six kilometres of towns joined by open roads",
  note: "Towns, highways and long drives",
  hero: "Free roam. The land streams in around you as you drive.",
  drawing: "Drawing mainland…",
  map_label: "mainland",
  pads: false,
  mood: {},
  ground_puff: "grass",
  backdrop: "sky",
  facts: (f) => [[shown(f, (f) => `${(f.length / 1000).toFixed(1)} km`), "circuit"], [shown(f, (f) => String(f.towns)), "towns"]],
  dress: (world) => [water_mesh(world.tiles.ext.size)],
  kit: PLAIN_KIT,
};

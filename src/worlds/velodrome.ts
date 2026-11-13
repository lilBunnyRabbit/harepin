import { cloud_floor } from "../render/sky";
import { WorldKind } from "../worldgen/types";
import { lap_facts, type WorldDef } from "./world-def";
import { PLAIN_KIT } from "../render/prop-kit";

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
  mood: {},
  ground_puff: "grass",
  backdrop: "sky",
  facts: (f) => lap_facts(f, "track"),
  dress: (world) => [cloud_floor(world)],
  kit: PLAIN_KIT,
  wall_view: (20 * Math.PI) / 180,
};

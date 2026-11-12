import { cloud_floor } from "../render/sky";
import { WorldKind } from "../worldgen/types";
import { lap_facts, shown, type WorldDef } from "./world-def";
import { PLAIN_KIT } from "../render/prop-kit";

export const sky: WorldDef = {
  kind: WorldKind.SKY,
  listed: true,
  mini: true,
  name: "Sky Track",
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
  dress: (world) => [cloud_floor(world)],
  kit: PLAIN_KIT,
};

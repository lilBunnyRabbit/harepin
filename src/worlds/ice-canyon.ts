import { roadside } from "../car/trackside";
import { WorldKind } from "../worldgen/types";
import { lap_facts, type WorldDef } from "./world-def";

// Unlisted while it is built: it loads from `?world=icecanyon` only.
export const ice_canyon: WorldDef = {
  kind: WorldKind.ICE_CANYON,
  listed: false,
  mini: true,
  name: "Ice canyon",
  pick: "A frozen riverbed down from a snowy rim",
  note: "Ice floor, packed snow, steep walls",
  hero: "Free roam. The canyon floor is bare ice, the rim road packed snow. Race the descent down the frozen river.",
  drawing: "Drawing the ice canyon…",
  map_label: "ice canyon",
  pads: false,
  mood: {},
  ground_puff: "snow",
  backdrop: "sky",
  facts: (f) => lap_facts(f, "rim lap"),
  dress: (world) => [roadside(world)],
};

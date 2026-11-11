import { roadside } from "../car/trackside";
import { WorldKind } from "../worldgen/types";
import { lap_facts, shown, type WorldDef } from "./world-def";

export const tundra: WorldDef = {
  kind: WorldKind.TUNDRA,
  listed: true,
  mini: true,
  name: "Frozen lakes",
  pick: "Snowfields, frozen lakes and a long loop on packed snow",
  note: "Snow, ice and pine bands",
  hero: "Free roam. Packed snow on the roads holds, the lakes are bare ice. Flags on the orange circuit start the challenges.",
  drawing: "Drawing the tundra…",
  map_label: "tundra",
  pads: false,
  mood: {},
  ground_puff: "snow",
  backdrop: "sky",
  facts: (f) => [...lap_facts(f, "circuit"), [shown(f, (f) => String(f.towns)), f?.towns === 1 ? "hamlet" : "hamlets"]],
  dress: (world) => [roadside(world)],
};

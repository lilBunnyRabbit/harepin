import { roadside } from "../car/trackside";
import { tones } from "../theme/palette";
import { WorldKind } from "../worldgen/types";
import { lap_facts, shown, type WorldDef } from "./world-def";

// Unlisted while it is built: it loads from `?world=dunes` only.
export const big_dunes: WorldDef = {
  kind: WorldKind.BIG_DUNES,
  listed: false,
  mini: true,
  name: "Big dunes",
  pick: "Dune bashing over sand mountains",
  note: "120 m dunes, pans and outposts",
  hero: "Free roam. Loose sand eats speed: only the off-road cars bash the dunes, the rest keep to the roads and pans.",
  drawing: "Drawing the big dunes…",
  map_label: "big dunes",
  pads: false,
  mood: { hemi_ground: tones.sand, fog_near: 60, fog_far: 950 },
  ground_puff: "dust",
  backdrop: "sky",
  facts: (f) => [...lap_facts(f, "circuit"), [shown(f, (f) => String(f.towns)), f?.towns === 1 ? "outpost" : "outposts"]],
  dress: (world) => [roadside(world)],
};

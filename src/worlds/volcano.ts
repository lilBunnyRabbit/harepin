import { roadside } from "../car/trackside";
import { lava_lakes } from "../render/lava";
import { mix, tones } from "../theme/palette";
import { WorldKind } from "../worldgen/types";
import { lap_facts, type WorldDef } from "./world-def";

// Unlisted while it is built: it loads from `?world=volcano` only.
export const volcano: WorldDef = {
  kind: WorldKind.VOLCANO,
  listed: false,
  mini: true,
  name: "Volcano",
  pick: "Lap the rim of a volcano over its lava crater",
  note: "Crater rim, lava and loose scree",
  hero: "Free roam. Lava resets you, scree off the road is loose. Flags on the orange circuit start the challenges.",
  drawing: "Drawing the volcano…",
  map_label: "volcano",
  pads: false,
  // The crater's lava throws a warm bounce up under the car; ash haze pulls the fog in.
  mood: { hemi_ground: mix(tones.lava, tones.rock, 0.35), fog_near: 60, fog_far: 1300 },
  ground_puff: "grass",
  backdrop: "sky",
  facts: (f) => lap_facts(f, "rim lap"),
  dress: (world) => [roadside(world), ...lava_lakes(world)],
};

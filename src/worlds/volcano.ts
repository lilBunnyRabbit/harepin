import { roadside } from "../car/trackside";
import { tones } from "../theme/palette";
import { WorldKind } from "../worldgen/types";
import { lap_facts, type WorldDef } from "./world-def";

// Unlisted while it is built: it loads from `?world=volcano` only.
export const volcano: WorldDef = {
  kind: WorldKind.VOLCANO,
  listed: false,
  mini: true,
  name: "Volcano",
  pick: "Lap the crater rim of a volcano island",
  note: "Crater rim and loose scree",
  hero: "Free roam. Scree off the road is loose. Flags on the orange circuit start the challenges.",
  drawing: "Drawing the volcano…",
  map_label: "volcano",
  pads: false,
  // Dark rock bounces a cool grey up under the car; ash haze pulls the fog in.
  mood: { hemi_ground: tones.rock, fog_near: 60, fog_far: 1300 },
  ground_puff: "grass",
  backdrop: "sky",
  facts: (f) => lap_facts(f, "rim lap"),
  dress: (world) => [roadside(world)],
};

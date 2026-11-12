import { roadside } from "../car/trackside";
import { tones } from "../theme/palette";
import { WorldKind } from "../worldgen/types";
import { lap_facts, shown, type WorldDef } from "./world-def";
import { Piece } from "../render/prop-kit";

export const alpine: WorldDef = {
  kind: WorldKind.ALPINE,
  listed: true,
  mini: true,
  name: "Alpine pass",
  pick: "Climb hairpins over a mountain pass and run the valleys below",
  note: "Hairpins, passes and snow caps",
  hero: "Free roam. Scree up high is loose. Flags on the orange circuit start the challenges.",
  drawing: "Drawing the mountains…",
  map_label: "alpine",
  pads: false,
  // Rock throws a cool grey bounce up under the car; clear mountain air keeps the far ridges in view.
  mood: { hemi_ground: tones.rock, fog_near: 120, fog_far: 1500 },
  ground_puff: "grass",
  backdrop: "sky",
  facts: (f) => [...lap_facts(f, "circuit"), [shown(f, (f) => String(f.towns)), f?.towns === 1 ? "village" : "villages"]],
  dress: (world) => [roadside(world)],
  kit: { trees: "green", pieces: [Piece.SCREE, Piece.FENCE] },
};

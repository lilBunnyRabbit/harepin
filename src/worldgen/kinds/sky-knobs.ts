import type { SkyRecipe } from "../sky";
import { knob, type Knob } from "./options";

// Knobs every sky-track kind shares; each kind passes its own recipe for the normal level and its own extremes.
const AMOUNT = ["None", "Normal", "More"] as const;

export const length_knob = (base: SkyRecipe, short: SkyRecipe["length"], long: SkyRecipe["length"]): Knob<SkyRecipe> =>
  knob<SkyRecipe, SkyRecipe["length"]>({ field: "E", name: "Length", help: "How long a lap runs.", labels: ["Short", "Normal", "Long"], normal: 1, values: [short, base.length, long], set: (r, length) => ({ ...r, length }) });

export const gaps_knob = (base: SkyRecipe, more: number): Knob<SkyRecipe> =>
  knob<SkyRecipe, number>({ field: "A", name: "Gaps", help: "Gap jumps across open sky.", labels: AMOUNT, normal: 1, values: [0, base.gaps, more], set: (r, gaps) => ({ ...r, gaps }) });

export const pads_knob = (base: SkyRecipe, more: number): Knob<SkyRecipe> =>
  knob<SkyRecipe, number>({ field: "V", name: "Boost pads", help: "Pads that kick the car forward.", labels: AMOUNT, normal: 1, values: [0, base.pads, more], set: (r, pads) => ({ ...r, pads }) });

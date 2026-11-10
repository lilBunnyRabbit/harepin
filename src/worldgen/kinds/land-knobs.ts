import { DESERT, ISLAND, type Recipe, type RoadRecipe, type TownRecipe } from "../recipe";
import { knob, type Knob } from "./options";

const LEVELS = ["Less", "Normal", "More"] as const;
const SWITCH = ["Off", "On"] as const;

const road = (recipe: Recipe, patch: Partial<RoadRecipe>): Recipe => ({ ...recipe, road: { ...recipe.road, ...patch } });

const length = (values: readonly RoadRecipe["loop"][]) =>
  knob<Recipe, RoadRecipe["loop"]>({ name: "Length", help: "How far the circuit reaches toward the coast.", labels: ["Short", "Normal", "Long"], normal: 1, values, set: (r, loop) => road(r, { loop }) });

const twist = (values: readonly number[]) =>
  knob<Recipe, number>({ name: "Twist", help: "How much the circuit swings in and out.", labels: ["Smooth", "Normal", "Twisty"], normal: 1, values, set: (r, swing) => road(r, { loop: { ...r.road.loop, swing } }) });

// More hairpins than the summit has room for builds the next count down, then the single tongue, as the normal level does.
const hairpins = (values: readonly (readonly number[])[]) =>
  knob<Recipe, readonly number[]>({ name: "Hairpins", help: "The switchback stack up the summit.", labels: ["None", "Normal", "More"], normal: 1, values, set: (r, stacks) => road(r, { stacks }) });

const jumps = (values: readonly RoadRecipe["kickers"][]) =>
  knob<Recipe, RoadRecipe["kickers"]>({ name: "Jumps", help: "Kickers on the road and across open ground.", labels: LEVELS, normal: 1, values, set: (r, kickers) => road(r, { kickers }) });

const canyon = (on: RoadRecipe["canyon"]) =>
  knob<Recipe, RoadRecipe["canyon"]>({ name: "Canyon", help: "The canyon trail and its gap jump.", labels: SWITCH, normal: 1, values: [null, on], set: (r, c) => road(r, { canyon: c }) });

const towns = (values: readonly Pick<TownRecipe, "min" | "max">[]) =>
  knob<Recipe, Pick<TownRecipe, "min" | "max">>({ name: "Towns", help: "Towns, their streets and the roads between them.", labels: LEVELS, normal: 1, values, set: (r, count) => ({ ...r, towns: { ...r.towns, ...count } }) });

export const ISLAND_KNOBS: readonly Knob<Recipe>[] = [
  length([{ radius: 560, swing: 560, min: 360, max: 780 }, ISLAND.road.loop, { radius: 660, swing: 640, min: 420, max: 870 }]),
  twist([320, ISLAND.road.loop.swing, 900]),
  hairpins([[], ISLAND.road.stacks, [6, 4, 2]]),
  jumps([{ road: 2, total: 6, big: 1 }, ISLAND.road.kickers, { road: 6, total: 18, big: 5 }]),
  towns([{ min: 1, max: 2 }, ISLAND.towns, { min: 6, max: 9 }]),
  canyon(ISLAND.road.canyon),
];

export const DESERT_KNOBS: readonly Knob<Recipe>[] = [
  jumps([{ road: 2, total: 8, big: 2 }, DESERT.road.kickers, { road: 6, total: 22, big: 6 }]),
  towns([{ min: 0, max: 1 }, DESERT.towns, { min: 3, max: 5 }]),
  canyon(DESERT.road.canyon),
];

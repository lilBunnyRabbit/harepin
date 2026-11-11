import { ALPINE, DESERT, ISLAND, TUNDRA, type Recipe, type RoadRecipe, type TerrainLayer, type TownRecipe } from "../recipe";
import { SNOW_KIT, type SnowKit } from "../snow";
import { knob, slider, type Knob } from "./options";

const LEVELS = ["Less", "Normal", "More"] as const;
const SWITCH = ["Off", "On"] as const;

const road = (recipe: Recipe, patch: Partial<RoadRecipe>): Recipe => ({ ...recipe, road: { ...recipe.road, ...patch } });

const length = (values: readonly RoadRecipe["loop"][]) =>
  knob<Recipe, RoadRecipe["loop"]>({ field: "E", name: "Length", help: "How far the circuit reaches toward the coast.", labels: ["Short", "Normal", "Long"], normal: 1, values, set: (r, loop) => road(r, { loop }) });

const twist = (values: readonly number[]) =>
  knob<Recipe, number>({ field: "Q", name: "Twist", help: "How much the circuit swings in and out.", labels: ["Smooth", "Normal", "Twisty"], normal: 1, values, set: (r, swing) => road(r, { loop: { ...r.road.loop, swing } }) });

// More hairpins than the summit has room for builds the next count down, then the single tongue, as the normal level does.
const hairpins = (values: readonly (readonly number[])[]) =>
  knob<Recipe, readonly number[]>({ field: "Y", name: "Hairpins", help: "The switchback stack up the summit.", labels: ["None", "Normal", "More"], normal: 1, values, set: (r, stacks) => road(r, { stacks }) });

const jumps = (values: readonly RoadRecipe["kickers"][]) =>
  knob<Recipe, RoadRecipe["kickers"]>({ field: "J", name: "Jumps", help: "Kickers on the road and across open ground.", labels: LEVELS, normal: 1, values, set: (r, kickers) => road(r, { kickers }) });

const canyon = (on: RoadRecipe["canyon"]) =>
  knob<Recipe, RoadRecipe["canyon"]>({ field: "X", name: "Canyon", help: "The canyon trail and its gap jump.", labels: SWITCH, normal: 1, values: [null, on], set: (r, c) => road(r, { canyon: c }) });

const towns = (values: readonly Pick<TownRecipe, "min" | "max">[]) =>
  knob<Recipe, Pick<TownRecipe, "min" | "max">>({ field: "C", name: "Towns", help: "Towns, their streets and the roads between them.", labels: LEVELS, normal: 1, values, set: (r, count) => ({ ...r, towns: { ...r.towns, ...count } }) });

// Winter keeps the seed's geometry, so its lap lines stay comparable with summer's; its records are its own all the same.
const season = knob<Recipe, SnowKit | null>({
  field: "W",
  name: "Season",
  help: "Winter lays snow over the land, packs it on the roads and freezes the lakes.",
  labels: ["Summer", "Winter"],
  normal: 0,
  late: true,
  values: [null, SNOW_KIT],
  set: (r, snow) => (snow ? { ...r, snow } : r),
});

const percent = (value: number) => `${(value * 100).toFixed(0)}%`;
const metres = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)} m`;
const terrain = (r: Recipe, map: (layer: TerrainLayer) => TerrainLayer): Recipe => ({ ...r, terrain: r.terrain.map(map) });

const hills = (hi: number) =>
  slider<Recipe>({
    field: "H",
    name: "Hills",
    help: "How tall the rolling hills and the summit stand.",
    lo: 0.4,
    mid: 1,
    hi,
    label: percent,
    set: (r, f) => terrain(r, (l) => (l.kind === "fbm" ? { ...l, amp: l.amp * f } : l.kind === "peak" ? { ...l, height: l.height * f } : l)),
  });

const ridges = slider<Recipe>({
  field: "G",
  name: "Ridges",
  help: "Sharp ridge lines over the hills.",
  more: true,
  lo: 0,
  mid: 1,
  hi: 1.5,
  label: percent,
  set: (r, f) => terrain(r, (l) => (l.kind === "ridged" ? { ...l, amp: l.amp * f } : l)),
});

const dunes = slider<Recipe>({
  field: "D",
  name: "Dunes",
  help: "How high the dune crests build.",
  lo: 0,
  mid: 1,
  hi: 1.6,
  label: percent,
  set: (r, f) => terrain(r, (l) => (l.kind === "dunes" ? { ...l, bands: l.bands.map((b) => ({ ...b, height: b.height * f })) } : l)),
});

// Water rises by sinking the land under the sea plane, so the coast moves and nothing else about the sea changes.
const water = slider<Recipe>({
  field: "P",
  name: "Water level",
  help: "How high the sea stands against the land.",
  more: true,
  lo: -3,
  mid: 0,
  hi: 3,
  label: metres,
  set: (r, rise) => terrain(r, (l) => (l.kind === "lift" ? { ...l, height: l.height - rise } : l)),
});

const trees = slider<Recipe>({
  field: "T",
  name: "Trees",
  help: "How thick the woods grow.",
  lo: 0,
  mid: 1,
  hi: 2,
  label: percent,
  set: (r, f) => ({ ...r, biomes: { ...r.biomes, rules: Object.fromEntries(Object.entries(r.biomes.rules).map(([k, rule]) => [k, { ...rule, fill: rule.fill * f }])) as Recipe["biomes"]["rules"] } }),
});

const rocks = slider<Recipe>({
  field: "K",
  name: "Rocks",
  help: "Boulders, cacti and pumps across the open ground.",
  lo: 0,
  mid: 1,
  hi: 2,
  label: percent,
  set: (r, f) => ({ ...r, scatter: r.scatter.map((rule) => ({ ...rule, odds: rule.odds * f })) }),
});

const town_size = (mid: number) =>
  slider<Recipe>({
    field: "Z",
    name: "Town size",
    help: "How big a town's blocks are.",
    more: true,
    lo: 30,
    mid,
    hi: 70,
    label: (value) => `${value.toFixed(0)} m`,
    set: (r, min) => ({ ...r, towns: { ...r.towns, block: { ...r.towns.block, min } } }),
  });

export const ISLAND_KNOBS: readonly Knob<Recipe>[] = [
  length([{ radius: 560, swing: 560, min: 360, max: 780 }, ISLAND.road.loop, { radius: 660, swing: 640, min: 420, max: 870 }]),
  twist([320, ISLAND.road.loop.swing, 900]),
  { ...hairpins([[], ISLAND.road.stacks, [6, 4, 2]]), more: true },
  jumps([{ road: 2, total: 6, big: 1 }, ISLAND.road.kickers, { road: 6, total: 18, big: 5 }]),
  towns([{ min: 1, max: 2 }, ISLAND.towns, { min: 6, max: 9 }]),
  { ...canyon(ISLAND.road.canyon), more: true },
  hills(1.5),
  trees,
  ridges,
  water,
  town_size(ISLAND.towns.block.min),
  season,
];

export const DESERT_KNOBS: readonly Knob<Recipe>[] = [
  jumps([{ road: 2, total: 8, big: 2 }, DESERT.road.kickers, { road: 6, total: 22, big: 6 }]),
  towns([{ min: 0, max: 1 }, DESERT.towns, { min: 3, max: 5 }]),
  canyon(DESERT.road.canyon),
  hills(1.5),
  dunes,
  rocks,
  town_size(DESERT.towns.block.min),
  season,
];

export const ALPINE_KNOBS: readonly Knob<Recipe>[] = [
  hairpins([[], ALPINE.road.stacks, [6, 4, 2]]),
  jumps([{ road: 1, total: 4, big: 1 }, ALPINE.road.kickers, { road: 4, total: 14, big: 4 }]),
  towns([{ min: 1, max: 1 }, ALPINE.towns, { min: 3, max: 5 }]),
  hills(1.5),
  trees,
  ridges,
  town_size(ALPINE.towns.block.min),
  season,
];

// No season row: the tundra is always under snow.
export const TUNDRA_KNOBS: readonly Knob<Recipe>[] = [
  jumps([{ road: 1, total: 5, big: 1 }, TUNDRA.road.kickers, { road: 5, total: 16, big: 4 }]),
  towns([{ min: 1, max: 1 }, TUNDRA.towns, { min: 3, max: 4 }]),
  hills(1.5),
  trees,
  town_size(TUNDRA.towns.block.min),
];

import { generate } from "../index";
import type { Recipe, TerrainLayer } from "../recipe";
import { SPAWN_INDEX, type WorldData, type WorldKind } from "../types";
import { tune, type Knob } from "./options";

/** Hills times ridges (or dunes) past this builds slopes the road and trail rules were never tuned for. */
const MAX_RELIEF = 1.5;
/** Of the land inside the shore mask, at least this much stays above the sea. */
const MIN_LAND = 0.45;

const soften_layer = (l: TerrainLayer, f: number): TerrainLayer => {
  if (l.kind === "fbm" || l.kind === "ridged") return { ...l, amp: l.amp * f };
  if (l.kind === "peak" || l.kind === "range") return { ...l, height: l.height * f };
  if (l.kind === "dunes") return { ...l, bands: l.bands.map((b) => ({ ...b, height: b.height * f })) };
  return l;
};

/** The relief layers scaled by `f`; 1 leaves the recipe as it is. */
export const soften = (recipe: Recipe, f: number): Recipe => (f === 1 ? recipe : { ...recipe, terrain: recipe.terrain.map((l) => soften_layer(l, f)) });

const factor = (knob: Knob<Recipe>, level: number) => knob.values?.[level] ?? 1;

/**
 * Hills and the second relief slider (ridges, or dunes) share one budget: the second's reachable end drops as hills
 * climb, so every pair stays under MAX_RELIEF. Levels past it come back at the reachable end.
 */
export function relief_clamp(knobs: readonly Knob<Recipe>[]): (levels: readonly number[]) => number[] {
  const hills = knobs.findIndex((k) => k.field === "H");
  const second = knobs.findIndex((k) => k.field === "G" || k.field === "D");
  return (levels) => {
    const out = [...levels];
    if (hills < 0 || second < 0) return out;
    const h = factor(knobs[hills], out[hills]);
    while (out[second] > knobs[second].normal && h * (1 + (factor(knobs[second], out[second]) - 1) / 2) > MAX_RELIEF) out[second]--;
    return out;
  };
}

/** The cheap facts a generated world already holds that make it drivable: a circuit, spawn above the sea, its towns, enough land. */
export function drivable(data: WorldData, recipe: Recipe): boolean {
  const spawn = data.road.at(SPAWN_INDEX);
  if (!data.circuit.length || data.road.length < 2 || !spawn) return false;
  const mask = recipe.terrain.find((l) => l.kind === "mask");
  const sea = mask?.kind === "mask" && mask.edge < 0;
  if (sea && spawn.y <= 0) return false;
  if (data.towns.length < Math.min(1, recipe.towns.min)) return false;
  if (!sea || mask?.kind !== "mask") return true;
  const { heights, n, cell, size } = data.terrain;
  if (!heights.length) return true;
  let inside = 0;
  let land = 0;
  const r2 = mask.radius * mask.radius;
  for (let iz = 0; iz < n; iz++)
    for (let ix = 0; ix < n; ix++) {
      const x = ix * cell - size / 2;
      const z = iz * cell - size / 2;
      if (x * x + z * z > r2) continue;
      inside++;
      if (heights[iz * n + ix] > 0) land++;
    }
  return land >= inside * MIN_LAND;
}

/** A land kind's generator, relief softener and drivability check over its knobs. */
export function land_kind(base: Recipe, knobs: readonly Knob<Recipe>[], kind: WorldKind) {
  const clamp = relief_clamp(knobs);
  const recipe = (levels: readonly number[], relief: number) => soften(tune(base, knobs, clamp(levels)), relief);
  return {
    generate: (seed: number, levels: readonly number[], relief = 1) => generate(seed, recipe(levels, relief), kind),
    clamp,
    drivable: (data: WorldData, levels: readonly number[]) => drivable(data, recipe(levels, 1)),
  };
}

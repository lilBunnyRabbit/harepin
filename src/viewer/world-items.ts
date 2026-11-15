import { TreeKind } from "../worldgen/biomes";
import { generate_world, KINDS } from "../worldgen/kinds/kinds";
import type { Landmark, Recipe } from "../worldgen/recipe";
import { FLOOR } from "../worldgen/town-style";
import { PropKind, WorldKind, type Building, type Lot, type Ramp, type WorldData } from "../worldgen/types";

export interface ItemPick {
  id: string;
  label: string;
}

/** Of each look (form, floors, roof), so a town of 600 buildings lists a few dozen. */
const PER_LOOK = 3;
const CACHED_WORLDS = 2;

export const TREE_NAMES: Record<TreeKind, string> = { [TreeKind.PINE]: "pine", [TreeKind.BROADLEAF]: "broadleaf", [TreeKind.SCRUB]: "scrub" };
export const LANDMARK_PROPS: Record<Landmark, PropKind> = { mast: PropKind.MAST, lighthouse: PropKind.LIGHTHOUSE, turbines: PropKind.TURBINE, arch: PropKind.ARCH };
const WORLD_KINDS = Object.values(WorldKind);

export function tree_kinds(recipe: Recipe): TreeKind[] {
  const rules = Object.values(recipe.biomes.rules).filter((rule) => rule.fill > 0);
  const kinds: TreeKind[] = [];
  if (rules.some((rule) => rule.pine > 0)) kinds.push(TreeKind.PINE);
  if (rules.some((rule) => rule.pine + rule.scrub < 1)) kinds.push(TreeKind.BROADLEAF);
  if (rules.some((rule) => rule.scrub > 0)) kinds.push(TreeKind.SCRUB);
  return kinds;
}

export const prop_kinds = (recipe: Recipe): PropKind[] => [...new Set([...recipe.landmarks.map((landmark) => LANDMARK_PROPS[landmark]), ...recipe.scatter.map((rule) => rule.kind)])];

export const tree_of = (item: string): TreeKind | null => {
  const at = Object.values(TREE_NAMES).indexOf(item);
  return at < 0 ? null : (at as TreeKind);
};

export const is_prop_kind = (item: string): item is PropKind => Object.values<string>(PropKind).includes(item);

const worlds = new Map<string, WorldData>();

// A world takes up to a second to generate, so the last few are kept.
export function world_data(world: WorldKind, seed: number): WorldData {
  const key = `${world}@${seed}`;
  const kept = worlds.get(key);
  if (kept) return kept;
  const data = generate_world(seed, world);
  worlds.set(key, data);
  while (worlds.size > CACHED_WORLDS) worlds.delete(worlds.keys().next().value ?? key);
  return data;
}

// Moved onto the stage: at the origin, on the floor, its front facing the camera's yaw 0.
const FACING = { x: 0, y: 0, z: 0, fx: 0, fz: 1, angle: 0 };
const index_of = (item: string, prefix: string) => (item.startsWith(prefix) && /^\d+$/.test(item.slice(prefix.length)) ? Number(item.slice(prefix.length)) : -1);

const floors = (b: Building) => b.detail?.floors ?? Math.max(1, Math.round(b.height / FLOOR));
const building_look = (b: Building) => (b.detail ? (b.detail.form === "clock" ? "clock tower" : `${b.detail.form} · ${floors(b)} floors`) : `${b.roof} roof · ${floors(b)} floors`);
const GROUND_NAMES: Record<NonNullable<Lot["ground"]>, string> = { plaza: "market square", yard: "garden wall", paved: "paving" };

function picks<T>(list: readonly T[], prefix: string, look: (t: T) => string | null): ItemPick[] {
  const seen = new Map<string, number>();
  const out: ItemPick[] = [];
  list.forEach((thing, i) => {
    const name = look(thing);
    if (name === null) return;
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    if (n <= PER_LOOK) out.push({ id: `${prefix}${i}`, label: `${name} · ${prefix}${i}` });
  });
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export const building_picks = (data: WorldData) => picks(data.buildings, "b", building_look);
export const ground_picks = (data: WorldData) => picks(data.lots, "l", (lot) => (lot.ground ? GROUND_NAMES[lot.ground] : null));
export const ramp_picks = (data: WorldData) => picks(data.ramps, "r", (ramp) => (ramp.deck ? null : ramp.kind));

export function stood_building(data: WorldData, item: string): Building | null {
  const b = data.buildings[index_of(item, "b")];
  return b ? { ...b, ...FACING } : null;
}

export function stood_lot(data: WorldData, item: string): Lot | null {
  const lot = data.lots[index_of(item, "l")];
  return lot?.ground ? { ...lot, ...FACING } : null;
}

export function stood_ramp(data: WorldData, item: string): Ramp | null {
  const ramp = data.ramps[index_of(item, "r")];
  return ramp && !ramp.deck ? { ...ramp, x: 0, y: 0, z: 0, fx: 0, fz: 1 } : null;
}

export const land_worlds = () => WORLD_KINDS.filter((kind) => KINDS[kind].recipe);
export const all_worlds = () => WORLD_KINDS;

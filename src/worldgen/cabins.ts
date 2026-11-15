import { mulberry32, sub } from "../rng";
import { sample } from "./field";
import { roof_rise } from "./lots";
import { Roof, type Building, type Lot, type Solid, type Terrain } from "./types";

/** Loose cabins on the open ground, far from every road: `groups` sites within `reach` of the centre, `size` cabins each. */
export interface CabinRecipe {
  groups: number;
  size: readonly [number, number];
  reach: number;
}

/** road_dist a cabin's every corner keeps: past the snowbanks and a car's line through a wide corner. */
const ROAD_CLEAR = 30;
const GROUP_R = 22;
const GROUP_GAP = 160;
const SITE_TRIES = 48;
const CABIN_TRIES = 10;
/** Most the ground may fall across a footprint: the walls reach below it, the base sits at the lowest corner. */
const MAX_STEP = 1.2;
const CABIN_GAP = 4;
const WALLS = 3.1;
const STYLES = 3;

export interface Cabins {
  lots: Lot[];
  buildings: Building[];
  solids: Solid[];
  blocks(x: number, z: number, r: number): boolean;
}

/** `blocked`: whether a circle of `r` at (x, z) touches ground something else holds (towns, jumps, ice, trails). */
export function plan_cabins(seed: number, land: Terrain, recipe: CabinRecipe, first_lot: number, blocked: (x: number, z: number, r: number) => boolean): Cabins {
  const next = mulberry32(sub(seed, "cabins"));
  const spots: { x: number; z: number; r: number }[] = [];
  const out: Cabins = { lots: [], buildings: [], solids: [], blocks: (x, z, r) => spots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < (s.r + r + CABIN_GAP) ** 2) };
  const sites: { x: number; z: number }[] = [];
  const clear = (x: number, z: number) => sample(land.road_dist, x, z) >= ROAD_CLEAR;
  for (let g = 0; g < recipe.groups; g++) {
    let site: { x: number; z: number } | null = null;
    for (let t = 0; t < SITE_TRIES && !site; t++) {
      const a = next() * Math.PI * 2;
      const d = Math.sqrt(next()) * recipe.reach;
      const x = Math.sin(a) * d;
      const z = Math.cos(a) * d;
      if (clear(x, z) && sample(land.road_dist, x, z) >= ROAD_CLEAR + GROUP_R && !blocked(x, z, GROUP_R) && sites.every((s) => (s.x - x) ** 2 + (s.z - z) ** 2 >= GROUP_GAP * GROUP_GAP)) site = { x, z };
    }
    if (!site) continue;
    sites.push(site);
    const count = recipe.size[0] + Math.floor(next() * (recipe.size[1] - recipe.size[0] + 1));
    for (let c = 0; c < count; c++)
      for (let t = 0; t < CABIN_TRIES; t++) {
        const a = next() * Math.PI * 2;
        const d = c === 0 && t === 0 ? 0 : Math.sqrt(next()) * GROUP_R;
        const x = site.x + Math.sin(a) * d;
        const z = site.z + Math.cos(a) * d;
        const angle = next() * Math.PI * 2;
        const hw = 3 + next() * 1.4;
        const hd = 2.4 + next() * 0.8;
        const style = Math.floor(next() * STYLES);
        const r = Math.hypot(hw, hd);
        if (out.blocks(x, z, r) || blocked(x, z, r)) continue;
        const fx = Math.sin(angle);
        const fz = Math.cos(angle);
        let lo = Infinity;
        let hi = -Infinity;
        let open = true;
        for (const [lx, lz] of [
          [-hw, -hd],
          [hw, -hd],
          [-hw, hd],
          [hw, hd],
        ]) {
          const px = x + lx * fz + lz * fx;
          const pz = z - lx * fx + lz * fz;
          const h = sample(land.heights, px, pz);
          lo = Math.min(lo, h);
          hi = Math.max(hi, h);
          open &&= clear(px, pz);
        }
        if (!open || hi - lo > MAX_STEP || lo <= 0) continue;
        const id = first_lot + out.lots.length;
        out.lots.push({ id, town: -1, edge: -1, side: 1, x, y: lo, z, w: 2 * hw, d: 2 * hd, fx, fz, angle, kind: "house" });
        const building: Building = { lot: id, x, y: lo, z, hw, hd, fx, fz, angle, height: WALLS, style, roof: Roof.STEEP };
        out.buildings.push(building);
        out.solids.push({ kind: "box", x, y: lo, z, hw, hd, cos: fz, sin: fx, height: WALLS + roof_rise(building) });
        spots.push({ x, z, r });
        break;
      }
  }
  return out;
}

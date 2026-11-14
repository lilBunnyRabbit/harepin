import { Roof, type BuildingForm, type Lot } from "./types";

export const FLOOR = 3.2;
export const SHOP_FLOOR = 3.6;
/** Terraces line the main street and the lanes this far out, as shares of the town radius. */
const TERRACE_REACH_MAIN = 0.72;
const TERRACE_REACH_LANE = 0.62;
const WALL_INSET = 0.5;
/** A cottage's garden wall, stone, with a gap for the gate. */
export const WALL_HALF = 0.28;
const GATE_HALF = 1;
export const WALL_TOP = 1;
/** A cottage stands this far behind its garden wall. */
const COTTAGE_BACK = 1.8;
export const TOWER = { half: 2.6, height: 17 };
/** The tower's back stands this far inside the square's far edge. */
export const TOWER_INSET = 2.4;
/** The clock tower's plinth reaches this far past the tower on every side, this high above its base. */
export const PLINTH_OUT = 0.5;
export const PLINTH_TOP = 1.2;

export interface Plot {
  /** Null leaves the lot open: a car park, or a garden where it is too shallow for one. */
  form: BuildingForm | null;
  wide: number;
  deep: number;
  min_w: number;
  gap: number;
  share: number;
}

/** `near` runs 0 at the town centre to 1 at its edge; `main` is the street through the centre along the town axis. */
export function high_street_plot(near: number, main: boolean, r1: number, r2: number, open: number): Plot {
  if (near < (main ? TERRACE_REACH_MAIN : TERRACE_REACH_LANE)) return { form: "terrace", wide: 6 + r1 * 4, deep: 12 + r2 * 3, min_w: 5.5, gap: 0, share: 0.45 };
  if (open < 0.08) return { form: null, wide: 12 + r1 * 6, deep: 14 + r2 * 4, min_w: 10, gap: 1, share: 0.45 };
  return { form: "house", wide: 11 + r1 * 4, deep: 15 + r2 * 6, min_w: 9.5, gap: 1, share: 0.47 };
}

export interface Shape {
  hw: number;
  hd: number;
  floors: number;
  height: number;
  /** Lot-local z of the building's centre. */
  front: number;
  roof: Roof;
}

/** Eaves to the street: the ridge runs along it, so a row of them reads as one roofline. */
export function terrace_shape(lot: Lot, r1: number): Shape {
  const hd = Math.max(3.5, Math.min(5.5, lot.d / 2 - 1));
  const floors = r1 < 0.4 ? 3 : 2;
  return { hw: lot.w / 2, hd, floors, height: SHOP_FLOOR + (floors - 1) * FLOOR + 0.3, front: lot.d / 2 - hd, roof: Roof.GABLE };
}

export function house_shape(lot: Lot, r1: number, r2: number): Shape {
  const hw = lot.w / 2 - 2 - r1 * 1.5;
  const hd = Math.max(3, Math.min(6, lot.d / 2 - 3.5 - r2 * 2));
  const floors = r1 < 0.45 ? 2 : 1;
  return { hw, hd, floors, height: floors * FLOOR + 0.3, front: lot.d / 2 - COTTAGE_BACK - hd, roof: Roof.GABLE };
}

export interface Run {
  x: number;
  z: number;
  hw: number;
  hd: number;
}

// One source for a yard's front wall: the mesh draws these lot-local boxes and the solids collide with them.
export function wall_runs(lot: Lot): Run[] {
  const hw = (lot.w / 2 - WALL_INSET - GATE_HALF) / 2;
  const x = GATE_HALF + hw;
  const z = lot.d / 2 - WALL_INSET;
  return [
    { x: -x, z, hw, hd: WALL_HALF },
    { x, z, hw, hd: WALL_HALF },
  ];
}

export const STALL = { hw: 1.4, hd: 0.9, height: 2.4 };
const STALL_EVERY = 7;

export interface Spot {
  x: number;
  z: number;
}

/** Market stalls in a staggered line along the square's street side, lot-local; the mesh and the solids share them. */
export function stall_spots(lot: Lot): Spot[] {
  const out: Spot[] = [];
  const n = Math.max(2, Math.floor((lot.w - 10) / STALL_EVERY));
  for (let i = 0; i < n; i++) out.push({ x: (i - (n - 1) / 2) * STALL_EVERY, z: lot.d / 2 - 5 - (i % 2) * 3.4 });
  return out;
}

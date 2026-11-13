import { Roof, type BuildingForm, type Lot } from "./types";

export const FLOOR = 3.2;
export const SHOP_FLOOR = 3.6;
export const PARAPET = 0.7;
/** Rows line the whole main street, and side streets this far out, as shares of the town radius. */
const ROW_REACH_MAIN = 0.9;
const ROW_REACH_SIDE = 0.3;
const HEDGE_INSET = 0.5;
const HEDGE_HALF = 0.35;
const GATE_HALF = 1;
export const HEDGE_TOP = 1;
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

const OPEN: Omit<Plot, "wide" | "deep"> = { form: null, min_w: 12, gap: 1, share: 0.45 };

/** `near` runs 0 at the town centre to 1 at its edge; `main` is the street through the centre along the town axis. */
export function high_street_plot(near: number, main: boolean, r1: number, r2: number, open: number): Plot {
  const row = near < (main ? ROW_REACH_MAIN : ROW_REACH_SIDE);
  if (open < (row ? 0.1 : 0.06)) return { ...OPEN, wide: 16 + r1 * 6, deep: 16 + r2 * 4 };
  if (row) return { form: "row", wide: 7 + r1 * 5, deep: 13 + r2 * 3, min_w: 6.5, gap: 0, share: 0.42 };
  return { form: "house", wide: 12 + r1 * 4, deep: 18 + r2 * 8, min_w: 10, gap: 1.5, share: 0.45 };
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

export function row_shape(lot: Lot, r1: number): Shape {
  const hd = Math.max(4, Math.min(7, lot.d / 2 - 1));
  const floors = r1 < 0.3 ? 3 : r1 < 0.85 ? 2 : 1;
  return { hw: lot.w / 2, hd, floors, height: SHOP_FLOOR + (floors - 1) * FLOOR + PARAPET + 0.2, front: lot.d / 2 - hd, roof: Roof.FLAT };
}

export function house_shape(lot: Lot, r1: number, r2: number, r3: number): Shape {
  const hw = lot.w / 2 - 2 - r1 * 1.5;
  const hd = Math.max(3, Math.min(6, lot.d / 2 - 3.5 - r2 * 2));
  const floors = r1 < 0.45 ? 2 : 1;
  return { hw, hd, floors, height: floors * FLOOR + 0.3, front: lot.d / 2 - 3 - hd, roof: r3 < 0.5 ? Roof.GABLE : r3 < 0.8 ? Roof.CROSS : Roof.HIP };
}

export interface Run {
  x: number;
  z: number;
  hw: number;
  hd: number;
}

// One source for a yard's front hedge: the mesh draws these lot-local boxes and the solids collide with them.
export function hedge_runs(lot: Lot): Run[] {
  const hw = (lot.w / 2 - HEDGE_INSET - GATE_HALF) / 2;
  const x = GATE_HALF + hw;
  const z = lot.d / 2 - HEDGE_INSET;
  return [
    { x: -x, z, hw, hd: HEDGE_HALF },
    { x, z, hw, hd: HEDGE_HALF },
  ];
}

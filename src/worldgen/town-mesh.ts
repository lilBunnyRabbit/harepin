import type { MeshTones } from "./chunks";
import { roof_rise } from "./lots";
import { turned, type Builder, type Frame, type Rgb, type V3 } from "./mesh";
import { hash } from "./noise";
import { LIFT } from "./lifts";
import { FLOOR, HEDGE_TOP, PARAPET, PLINTH_OUT, PLINTH_TOP, SHOP_FLOOR, hedge_runs } from "./town-style";
import { Roof, type Building, type Detail, type Lot } from "./types";

export interface TownTones {
  pave: Rgb;
  square: Rgb;
  hedge: Rgb;
  awnings: Rgb[];
  trim: Rgb;
  door: Rgb;
  walls: Rgb[];
}

const NONE: Rgb = [0, 0, 0];
const OUT = 0.04;
const PAD_LIFT = LIFT.pad;
const SILL = 0.9;
const WINDOW_TALL = 1.4;
const PATH_HALF = 0.7;
const PATH_LONG = 5.7;
/** A pad reaches this far past the lot line, over the grass strip behind the sidewalk. */
const PAD_OUT = 1.2;
const PLAZA_BORDER = 3;

function across(glass: Builder, hw: number, z: number, y0: number, y1: number, pitch: number, w: number) {
  const n = Math.max(1, Math.floor((2 * hw - 0.6) / pitch));
  const step = (2 * hw) / n;
  for (let i = 0; i < n; i++) {
    const c = -hw + step * (i + 0.5);
    if (z > 0) glass.quad([c - w / 2, y0, z], [c + w / 2, y0, z], [c + w / 2, y1, z], [c - w / 2, y1, z], NONE);
    else glass.quad([c + w / 2, y0, z], [c - w / 2, y0, z], [c - w / 2, y1, z], [c + w / 2, y1, z], NONE);
  }
}

function along(glass: Builder, hd: number, x: number, y0: number, y1: number, pitch: number, w: number) {
  const n = Math.max(1, Math.floor((2 * hd - 0.6) / pitch));
  const step = (2 * hd) / n;
  for (let i = 0; i < n; i++) {
    const c = -hd + step * (i + 0.5);
    if (x > 0) glass.quad([x, y0, c + w / 2], [x, y0, c - w / 2], [x, y1, c - w / 2], [x, y1, c + w / 2], NONE);
    else glass.quad([x, y0, c - w / 2], [x, y0, c + w / 2], [x, y1, c + w / 2], [x, y1, c - w / 2], NONE);
  }
}

function box(out: Builder, hw: number, hd: number, y0: number, y1: number, rgb: Rgb) {
  out.walls(hw, hd, y0, y1, rgb);
  out.top(hw, hd, y1, rgb);
}

function shift(b: Frame, lx: number, lz: number): Frame {
  return { x: b.x + b.fz * lx + b.fx * lz, y: b.y, z: b.z - b.fx * lx + b.fz * lz, fx: b.fx, fz: b.fz };
}

function band(out: Builder, hw: number, z: number, y0: number, y1: number, rgb: Rgb) {
  out.quad([-hw, y0, z], [hw, y0, z], [hw, y1, z], [-hw, y1, z], rgb);
}

// Both faces: the chase camera sits near awning height and sees its underside from the far kerb.
function awning(out: Builder, hw: number, hd: number, rgb: Rgb) {
  const a: V3 = [-hw, 3.2, hd];
  const b: V3 = [hw, 3.2, hd];
  const c: V3 = [hw, 2.55, hd + 1.4];
  const d: V3 = [-hw, 2.55, hd + 1.4];
  out.quad(d, c, b, a, rgb);
  out.quad(a, b, c, d, rgb);
}

function door(out: Builder, z: number, rgb: Rgb) {
  out.quad([-0.55, 0, z], [0.55, 0, z], [0.55, 2.1, z], [-0.55, 2.1, z], rgb);
}

function row(out: Builder, glass: Builder, b: Building, detail: Detail, tones: MeshTones, pick: (k: number) => number) {
  const { hw, hd, height: h } = b;
  const town = tones.town;
  out.walls(hw, hd, -1, h, town.walls[Math.floor(detail.tint * town.walls.length)]);
  out.top(hw, hd, h - PARAPET, tones.roof_flat);
  band(out, hw, hd + OUT * 2, h - 0.4, h, town.trim);
  band(out, hw, hd + OUT * 2, 3.2, 3.5, town.trim);
  across(glass, hw - 0.5, hd + OUT, 0.5, 2.7, 2.6, 2.3);
  awning(out, hw - 0.4, hd, town.awnings[Math.floor(pick(2) * town.awnings.length)]);
  for (let s = 1; s < detail.floors; s++) {
    const y0 = SHOP_FLOOR + (s - 1) * FLOOR + 0.8;
    across(glass, hw, hd + OUT, y0, y0 + 1.6, 2.2, 1.1);
    across(glass, hw, -hd - OUT, y0, y0 + 1.6, 3, 1.1);
  }
  if (pick(3) < 0.5) box(out.at(shift(b, hw * 0.3, -hd * 0.4)), 0.9, 0.7, h - PARAPET, h + 0.2, town.trim);
}

function house(out: Builder, glass: Builder, b: Building, detail: Detail, tones: MeshTones, pick: (k: number) => number) {
  const { hw, hd, height: h } = b;
  const town = tones.town;
  const wall = town.walls[Math.floor(detail.tint * town.walls.length)];
  const roof = tones.roofs[Math.floor(pick(1) * tones.roofs.length)];
  const rise = roof_rise(b);
  out.walls(hw, hd, -1, h, wall);
  if (b.roof === Roof.GABLE) out.gable(hw, hd, h, rise, roof, wall);
  else if (b.roof === Roof.CROSS) out.at(turned(b)).gable(hd, hw, h, rise, roof, wall);
  else if (hw >= hd) out.hip(hw, hd, h, rise, roof);
  else out.at(turned(b)).hip(hd, hw, h, rise, roof);
  door(out.at(b), hd + OUT, town.door);
  for (let s = 0; s < detail.floors; s++) {
    const y0 = s * FLOOR + SILL;
    const y1 = y0 + WINDOW_TALL;
    const z = hd + OUT;
    if (s > 0) across(glass, hw, z, y0, y1, 2.6, 1.2);
    else for (const x of [-hw * 0.6, hw * 0.6]) glass.quad([x - 0.6, y0, z], [x + 0.6, y0, z], [x + 0.6, y1, z], [x - 0.6, y1, z], NONE);
    across(glass, hw, -z, y0, y1, 3.2, 1.2);
    along(glass, hd, hw + OUT, y0, y1, 4, 1.1);
    along(glass, hd, -hw - OUT, y0, y1, 4, 1.1);
  }
  box(out.at(shift(b, hw * 0.5, 0)), 0.35, 0.35, h, h + rise * 0.6 + 0.9, tones.roof_flat);
}

function clock(out: Builder, glass: Builder, b: Building, tones: MeshTones) {
  const { hw, hd, height: h } = b;
  const town = tones.town;
  out.walls(hw, hd, -1, h, town.walls[0]);
  box(out, hw + PLINTH_OUT, hd + PLINTH_OUT, -1, PLINTH_TOP, tones.roof_flat);
  out.walls(hw + 0.2, hd + 0.2, h - 0.5, h, town.trim);
  out.hip(hw, hd, h, roof_rise(b), tones.roofs[0]);
  for (const [y0, y1, w] of [
    [h - 3.3, h - 1.1, 2.2],
    [3.9, 5.5, 0.7],
    [7.9, 9.5, 0.7],
  ]) {
    across(glass, hw, hd + OUT, y0, y1, 9, w);
    across(glass, hw, -hd - OUT, y0, y1, 9, w);
    along(glass, hd, hw + OUT, y0, y1, 9, w);
    along(glass, hd, -hw - OUT, y0, y1, 9, w);
  }
  door(out, hd + 0.52, town.door);
}

export function dress_building(out: Builder, glass: Builder, b: Building, detail: Detail, tones: MeshTones, seed: number) {
  const pick = (k: number) => hash(b.lot, k, seed + 83);
  out.at(b);
  glass.at(b);
  if (detail.form === "row") row(out, glass, b, detail, tones, pick);
  else if (detail.form === "house") house(out, glass, b, detail, tones, pick);
  else clock(out, glass, b, tones);
}

/** A rectangle of paving in a lot's frame, `lift` over the terrain. */
export interface Paving {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  lift: number;
}

/** The paving `dress_lot` lays on `lot`, highest last. */
export function lot_paving(lot: Lot): Paving[] {
  const hw = lot.w / 2;
  const hd = lot.d / 2;
  if (lot.ground === "plaza")
    return [
      { x0: -hw, x1: hw, z0: -hd, z1: hd, lift: PAD_LIFT },
      { x0: PLAZA_BORDER - hw, x1: hw - PLAZA_BORDER, z0: PLAZA_BORDER - hd, z1: hd - PLAZA_BORDER, lift: LIFT.plaza },
    ];
  if (lot.ground === "paved") return [{ x0: -hw, x1: hw, z0: -hd, z1: hd + PAD_OUT, lift: PAD_LIFT }];
  if (lot.ground === "yard") return [{ x0: -PATH_HALF, x1: PATH_HALF, z0: hd + PAD_OUT - PATH_LONG, z1: hd + PAD_OUT, lift: PAD_LIFT }];
  return [];
}

/** `ground` stands each hedge run on the terrain under its middle, where its solid stands. */
export function dress_lot(pads: Builder, out: Builder, lot: Lot, tones: MeshTones, ground: (x: number, z: number) => number) {
  const hw = lot.w / 2;
  const hd = lot.d / 2;
  const { pave, square, hedge } = tones.town;
  pads.at(lot);
  if (lot.ground === "plaza") {
    pads.top(hw, hd, PAD_LIFT, pave);
    pads.top(hw - PLAZA_BORDER, hd - PLAZA_BORDER, LIFT.plaza, square);
  } else if (lot.ground === "paved") pads.quad([-hw, PAD_LIFT, hd + PAD_OUT], [hw, PAD_LIFT, hd + PAD_OUT], [hw, PAD_LIFT, -hd], [-hw, PAD_LIFT, -hd], pave);
  else if (lot.ground === "yard") {
    pads.quad([-PATH_HALF, PAD_LIFT, hd + PAD_OUT], [PATH_HALF, PAD_LIFT, hd + PAD_OUT], [PATH_HALF, PAD_LIFT, hd + PAD_OUT - PATH_LONG], [-PATH_HALF, PAD_LIFT, hd + PAD_OUT - PATH_LONG], pave);
    for (const run of hedge_runs(lot)) {
      const at = shift(lot, run.x, run.z);
      box(out.at({ ...at, y: ground(at.x, at.z) }), run.hw, run.hd, -0.6, HEDGE_TOP, hedge);
    }
  }
}

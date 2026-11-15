import type { MeshTones } from "./chunks";
import { roof_rise } from "./lots";
import { turned, type Builder, type Frame, type Rgb, type V3 } from "./mesh";
import { hash } from "./noise";
import { OUT, back_glazing, bays, framed, glazing, pane, post } from "./town-parts";
import { FLOOR, PLINTH_OUT, PLINTH_TOP, SHOP_FLOOR } from "./town-style";
import { Roof, type Building, type Detail } from "./types";

export interface TownTones {
  pave: Rgb;
  square: Rgb;
  awnings: Rgb[];
  trim: Rgb;
  door: Rgb;
  walls: Rgb[];
  stone: Rgb;
  timber: Rgb;
}

type Pick = (k: number) => number;

const SILL = 0.9;
const WINDOW_TALL = 1.45;
const WINDOW_WIDE = 0.95;
const FASCIA = { y0: 2.85, y1: 3.4 };
const PILASTER = 0.3;
const SHOP_GLASS = { y0: 0.7, y1: 2.55 };
const SHOP_RETURN = 2.2;
const STACK = { half: 0.4, over: 0.9 };
const BREAST = { half: 0.95, out: 0.3, stack: 0.45 };
const ATTIC_RISE = 2.2;
const CLOCK_FACE = { radius: 1.75, sides: 8, below: 2.7 };

const tone = (list: readonly Rgb[], roll: number) => list[Math.min(list.length - 1, Math.floor(roll * list.length))];

// Both faces: the chase camera sits near awning height and sees its underside from the far kerb.
function awning(out: Builder, x0: number, x1: number, z: number, rgb: Rgb) {
  const a: V3 = [x0, 3.1, z];
  const b: V3 = [x1, 3.1, z];
  const c: V3 = [x1, 2.5, z + 1.3];
  const d: V3 = [x0, 2.5, z + 1.3];
  out.quad(d, c, b, a, rgb);
  out.quad(a, b, c, d, rgb);
}

/**
 * An end wall nothing joins, drawn in the frame that faces out of it: `hd` is the wall's half width here, `z` where it
 * stands, `street` the x side the street is on. The shop turns the corner, windows flank a chimney breast up the gable.
 */
function open_end(out: Builder, glass: Builder, hd: number, z: number, eave: number, top: number, floors: number, street: number, wall: Rgb, tones: MeshTones) {
  const t = tones.town;
  pane(out, -hd, hd, FASCIA.y0, FASCIA.y1, z + OUT, t.trim);
  const corner = street * hd;
  pane(out, Math.min(corner, corner - street * PILASTER), Math.max(corner, corner - street * PILASTER), 0, FASCIA.y0, z + OUT, t.trim);
  const g0 = corner - street * (PILASTER + 0.3);
  const g1 = corner - street * Math.min(SHOP_RETURN + PILASTER, hd - BREAST.half - 0.4);
  glazing(glass, Math.min(g0, g1), Math.max(g0, g1), SHOP_GLASS.y0, SHOP_GLASS.y1, z + OUT * 2);
  for (let s = 1; s < floors; s++) {
    const y0 = SHOP_FLOOR + (s - 1) * FLOOR + SILL;
    for (const x of [-hd * 0.62, hd * 0.62]) framed(out, glass, x, WINDOW_WIDE - 0.15, y0, y0 + WINDOW_TALL, z, t.trim);
  }
  post(out, -BREAST.half, BREAST.half, FASCIA.y1, eave, z, z + BREAST.out, wall);
  post(out, -BREAST.stack, BREAST.stack, eave, top, z - BREAST.out, z + BREAST.out, t.stone);
}

function terrace(out: Builder, glass: Builder, b: Building, detail: Detail, tones: MeshTones, pick: Pick) {
  const { hw, hd, height: h } = b;
  const t = tones.town;
  const wall = tone(t.walls, detail.tint);
  const rise = roof_rise(b);
  out.walls(hw, hd, -1, h, wall);
  out.gable(hw, hd, h, rise, tones.roofs[pick(1) < 0.75 ? 0 : 1], wall);
  pane(out, -hw, hw, FASCIA.y0, FASCIA.y1, hd + OUT, t.trim);
  pane(out, -hw, -hw + PILASTER, 0, FASCIA.y0, hd + OUT, t.trim);
  pane(out, hw - PILASTER, hw, 0, FASCIA.y0, hd + OUT, t.trim);
  const side = pick(4) < 0.5 ? 1 : -1;
  const door = side * (hw - 1.05);
  pane(out, door - 0.5, door + 0.5, 0, 2.25, hd + OUT, t.door);
  const g0 = side > 0 ? -hw + 0.6 : door + 0.8;
  const g1 = side > 0 ? door - 0.8 : hw - 0.6;
  if (g1 - g0 > 0.8) glazing(glass, g0, g1, SHOP_GLASS.y0, SHOP_GLASS.y1, hd + OUT * 2);
  for (let s = 1; s < detail.floors; s++) {
    const y0 = SHOP_FLOOR + (s - 1) * FLOOR + SILL;
    for (const x of bays(hw, 2.3)) framed(out, glass, x, WINDOW_WIDE, y0, y0 + WINDOW_TALL, hd, t.trim);
    for (const x of bays(hw, 3)) back_glazing(glass, x - WINDOW_WIDE / 2, x + WINDOW_WIDE / 2, y0, y0 + WINDOW_TALL, -hd - OUT);
  }
  if (pick(3) < 0.45) awning(out, g0 - 0.2, g1 + 0.2, hd, tone(t.awnings, pick(2)));
  const top = h + rise + STACK.over;
  const [left, right] = detail.ends ?? [false, false];
  if (!left && !right) {
    const x = hw * (pick(6) < 0.5 ? 0.55 : -0.55);
    post(out, x - STACK.half, x + STACK.half, h + rise * 0.5, top, -STACK.half + 0.05, STACK.half - 0.05, t.stone);
    return;
  }
  const faces: [boolean, Frame, number][] = [
    [right, turned(b), -1],
    [left, turned(turned(turned(b))), 1],
  ];
  for (const [open, frame, street] of faces) {
    if (!open) continue;
    out.at(frame);
    glass.at(frame);
    open_end(out, glass, hd, hw, h, top, detail.floors, street, wall, tones);
  }
  out.at(b);
  glass.at(b);
}

function house(out: Builder, glass: Builder, b: Building, detail: Detail, tones: MeshTones, pick: Pick) {
  const { hw, hd, height: h } = b;
  const t = tones.town;
  const wall = tone(t.walls, detail.tint);
  const rise = roof_rise(b);
  out.walls(hw, hd, -1, h, wall);
  out.gable(hw, hd, h, rise, tone(tones.roofs, pick(1)), wall);
  pane(out, -0.55, 0.55, 0, 2.1, hd + OUT, t.door);
  for (let s = 0; s < detail.floors; s++) {
    const y0 = s * FLOOR + SILL;
    const y1 = y0 + WINDOW_TALL;
    for (const x of s > 0 ? bays(hw, 2.6) : [-hw * 0.6, hw * 0.6]) framed(out, glass, x, 1.1, y0, y1, hd, t.trim);
    for (const x of bays(hw, 3.2)) back_glazing(glass, x - 0.6, x + 0.6, y0, y1, -hd - OUT);
  }
  let frame: Frame = b;
  for (let side = 0; side < 2; side++) {
    frame = turned(frame);
    out.at(frame);
    glass.at(frame);
    for (let s = 0; s < detail.floors; s++) for (const x of [-hd * 0.5, hd * 0.5]) framed(out, glass, x, 0.9, s * FLOOR + SILL, s * FLOOR + SILL + WINDOW_TALL, hw, t.trim);
    if (rise > ATTIC_RISE) framed(out, glass, 0, 0.8, h + 0.45, h + 1.35, hw, t.trim);
    frame = turned(frame);
  }
  out.at(b);
  glass.at(b);
  post(out, hw * 0.5 - 0.35, hw * 0.5 + 0.35, h + rise * 0.3, h + rise + STACK.over, -0.35, 0.35, t.stone);
}

function clock_face(out: Builder, z: number, y: number, tones: MeshTones) {
  const { radius: r, sides } = CLOCK_FACE;
  const at = (i: number): V3 => {
    const a = ((i + 0.5) / sides) * Math.PI * 2;
    return [Math.cos(a) * r, y + Math.sin(a) * r, z + OUT];
  };
  for (let i = 0; i < sides; i++) out.tri([0, y, z + OUT], at(i), at(i + 1), tones.town.trim);
  pane(out, -0.09, 0.09, y - 0.1, y + r * 0.72, z + OUT * 2, tones.roof_flat);
  pane(out, -0.1, r * 0.5, y - 0.09, y + 0.09, z + OUT * 2, tones.roof_flat);
}

function tower(out: Builder, glass: Builder, b: Building, _detail: Detail, tones: MeshTones) {
  const { hw, hd, height: h } = b;
  const t = tones.town;
  out.walls(hw, hd, -1, h, t.stone);
  post(out, -hw - PLINTH_OUT, hw + PLINTH_OUT, -1, PLINTH_TOP, -hd - PLINTH_OUT, hd + PLINTH_OUT, tones.roof_flat);
  out.walls(hw + 0.25, hd + 0.25, h - 0.6, h, t.trim);
  out.walls(hw + 0.15, hd + 0.15, h - 5.2, h - 4.8, t.trim);
  out.hip(hw + 0.25, hd + 0.25, h, roof_rise(b), tones.roofs[0]);
  let frame: Frame = b;
  for (let s = 0; s < 4; s++) {
    out.at(frame);
    glass.at(frame);
    clock_face(out, hd, h - CLOCK_FACE.below, tones);
    for (const y of [4, 8]) glazing(glass, -0.35, 0.35, y, y + 1.7, hd + OUT);
    frame = turned(frame);
  }
  out.at(b);
  glass.at(b);
  pane(out, -0.7, 0.7, PLINTH_TOP, PLINTH_TOP + 2.3, hd + OUT, t.door);
}

const PLAIN_PITCH = 2.8;
const SHOP_PANE = 2.6;
const DOOR_CLEAR = 1.3;
const MULLION = 0.2;
const SIDE_PITCH = 3.4;
const CORNICE = { out: 0.18, below: 0.35, over: 0.12 };
const CROSS_WING = 0.55;
const CROSS_RISE = 0.8;

function roof(out: Builder, b: Building, wall: Rgb, cover: Rgb, tones: MeshTones) {
  const { hw, hd, height: h } = b;
  const rise = roof_rise(b);
  if (b.roof === Roof.GABLE || b.roof === Roof.STEEP) {
    out.gable(hw, hd, h, rise, cover, wall);
    post(out, hw * 0.5 - STACK.half, hw * 0.5 + STACK.half, h + rise * 0.3, h + rise + STACK.over, -STACK.half, STACK.half, tones.town.stone);
  } else if (b.roof === Roof.CROSS) {
    out.at(turned(b)).gable(hd, hw, h, rise, cover, wall);
    out.at(b).gable(hw, Math.min(hw, hd) * CROSS_WING, h, rise * CROSS_RISE, cover, wall);
  } else if (b.roof === Roof.HIP) {
    if (hw >= hd) out.hip(hw, hd, h, rise, cover);
    else out.at(turned(b)).hip(hd, hw, h, rise, cover);
  } else {
    const { out: o, below, over } = CORNICE;
    out.walls(hw + o, hd + o, h - below, h + over, tones.town.trim);
    out.top(hw + o, hd + o, h + over, tones.roof_flat);
  }
  out.at(b);
}

export function plain_building(out: Builder, glass: Builder, b: Building, shop: boolean, tones: MeshTones, seed: number) {
  const { hw, hd, height: h } = b;
  const t = tones.town;
  const wall = tones.walls[b.style % tones.walls.length];
  const storey = shop ? SHOP_FLOOR : FLOOR;
  const floors = Math.max(1, Math.round(h / storey));
  out.walls(hw, hd, -1, h, wall);
  if (shop) {
    pane(out, -hw, hw, FASCIA.y0, FASCIA.y1, hd + OUT, t.trim);
    const panes = Math.max(1, Math.round((2 * hw - 1.2) / SHOP_PANE));
    const step = (2 * hw - 1.2) / panes;
    for (let p = 0; p < panes; p++) glazing(glass, -hw + 0.6 + p * step + MULLION / 2, -hw + 0.6 + (p + 1) * step - MULLION / 2, SHOP_GLASS.y0, SHOP_GLASS.y1, hd + OUT * 2);
  } else {
    pane(out, -0.55, 0.55, 0, 2.1, hd + OUT, t.door);
    for (const x of bays(hw, PLAIN_PITCH)) if (Math.abs(x) > DOOR_CLEAR) framed(out, glass, x, WINDOW_WIDE, SILL, SILL + WINDOW_TALL, hd, t.trim);
  }
  for (let s = 0; s < floors; s++) {
    const y0 = s * storey + SILL;
    const y1 = y0 + WINDOW_TALL;
    if (s > 0) for (const x of bays(hw, PLAIN_PITCH)) framed(out, glass, x, WINDOW_WIDE, y0, y1, hd, t.trim);
    for (const x of bays(hw, SIDE_PITCH)) back_glazing(glass, x - WINDOW_WIDE / 2, x + WINDOW_WIDE / 2, y0, y1, -hd - OUT);
  }
  let frame: Frame = b;
  for (let side = 0; side < 2; side++) {
    frame = turned(frame);
    glass.at(frame);
    for (let s = 0; s < floors; s++) for (const x of bays(hd, SIDE_PITCH)) glazing(glass, x - WINDOW_WIDE / 2, x + WINDOW_WIDE / 2, s * storey + SILL, s * storey + SILL + WINDOW_TALL, hw + OUT);
    frame = turned(frame);
  }
  glass.at(b);
  roof(out, b, wall, tones.roofs[Math.floor(hash(b.lot, 0, seed + 81) * tones.roofs.length)], tones);
}

const FORMS: Record<Detail["form"], (out: Builder, glass: Builder, b: Building, detail: Detail, tones: MeshTones, pick: Pick) => void> = { terrace, house, clock: tower };

export function dress_building(out: Builder, glass: Builder, b: Building, detail: Detail, tones: MeshTones, seed: number) {
  out.at(b);
  glass.at(b);
  FORMS[detail.form](out, glass, b, detail, tones, (k) => hash(b.lot, k, seed + 83));
}

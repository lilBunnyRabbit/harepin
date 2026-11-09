import { sample } from "./field";
import { ARCH_CLEARANCE, ARCH_LEG, ARCH_THICK, LIGHTHOUSE_HEIGHT, MAST_HEIGHT, TURBINE_HEIGHT } from "./landmarks";
import type { Builder, Rgb, V3 } from "./mesh";
import { hash } from "./noise";
import { PropKind, type Prop } from "./types";

export interface LandmarkTones {
  pale: Rgb;
  band: Rgb;
  cap: Rgb;
  stone: Rgb;
  stone_shade: Rgb;
}

const MAST_BANDS = 6;
const MAST_BASE = 3;
const MAST_TOP = 1;
const ANTENNA = 5;
const LIGHTHOUSE_BANDS = 4;
const LANTERN = 2;
const NACELLE = { hw: 0.9, hd: 2.2, low: -0.6, high: 1.2 };
export const HUB_AHEAD = 2.6;
export const HUB_RISE = 0.3;

export interface Beacon {
  x: number;
  y: number;
  z: number;
  size: number;
}

function forward(prop: Prop): [number, number] {
  return [Math.sin(prop.angle), Math.cos(prop.angle)];
}

export function rotor_hub(prop: Prop): V3 {
  const [fx, fz] = forward(prop);
  return [prop.x + fx * HUB_AHEAD, prop.y + TURBINE_HEIGHT + HUB_RISE, prop.z + fz * HUB_AHEAD];
}

export function beacons(props: Prop[]): Beacon[] {
  const out: Beacon[] = [];
  for (const p of props) {
    if (p.kind === PropKind.MAST) out.push({ x: p.x, y: p.y + MAST_HEIGHT + ANTENNA, z: p.z, size: 0.8 });
    else if (p.kind === PropKind.LIGHTHOUSE)
      out.push({
        x: p.x,
        y: p.y + LIGHTHOUSE_HEIGHT + 0.4 + LANTERN / 2,
        z: p.z,
        size: 1.3,
      });
    else if (p.kind === PropKind.TURBINE)
      out.push({
        x: p.x,
        y: p.y + TURBINE_HEIGHT + NACELLE.high + 0.2,
        z: p.z,
        size: 0.25,
      });
  }
  return out;
}

function ring(sides: number, r: number, k: number, phase: number): [number, number] {
  const a = phase + (k / sides) * Math.PI * 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

function prism(out: Builder, sides: number, r0: number, r1: number, y0: number, y1: number, rgb: Rgb, phase = 0, shade?: Rgb, cx = 0, cz = 0) {
  for (let k = 0; k < sides; k++) {
    const [ax0, az0] = ring(sides, r0, k, phase);
    const [bx0, bz0] = ring(sides, r0, k + 1, phase);
    const [ax1, az1] = ring(sides, r1, k, phase);
    const [bx1, bz1] = ring(sides, r1, k + 1, phase);
    out.quad([cx + bx0, y0, cz + bz0], [cx + ax0, y0, cz + az0], [cx + ax1, y1, cz + az1], [cx + bx1, y1, cz + bz1], shade && k % 2 ? shade : rgb);
  }
  if (r1 <= 0) return;
  for (let k = 0; k < sides; k++) {
    const [ax, az] = ring(sides, r1, k, phase);
    const [bx, bz] = ring(sides, r1, k + 1, phase);
    out.tri([cx, y1, cz], [cx + bx, y1, cz + bz], [cx + ax, y1, cz + az], shade ?? rgb);
  }
}

function slab(out: Builder, x0: number, x1: number, hd: number, y0: number, y1: number, rgb: Rgb, side: Rgb) {
  out.quad([x0, y0, hd], [x1, y0, hd], [x1, y1, hd], [x0, y1, hd], side);
  out.quad([x1, y0, -hd], [x0, y0, -hd], [x0, y1, -hd], [x1, y1, -hd], side);
  out.quad([x1, y0, hd], [x1, y0, -hd], [x1, y1, -hd], [x1, y1, hd], rgb);
  out.quad([x0, y0, -hd], [x0, y0, hd], [x0, y1, hd], [x0, y1, -hd], rgb);
  out.quad([x0, y1, hd], [x1, y1, hd], [x1, y1, -hd], [x0, y1, -hd], rgb);
  out.quad([x0, y0, -hd], [x1, y0, -hd], [x1, y0, hd], [x0, y0, hd], side);
}

function mast(out: Builder, t: LandmarkTones) {
  const step = MAST_HEIGHT / MAST_BANDS;
  const radius = (y: number) => MAST_BASE + ((MAST_TOP - MAST_BASE) * y) / MAST_HEIGHT;
  for (let b = 0; b < MAST_BANDS; b++) prism(out, 4, radius(b * step), radius((b + 1) * step), b === 0 ? -1 : b * step, (b + 1) * step, b % 2 ? t.band : t.pale, Math.PI / 4);
  for (const at of [0.45, 0.8]) prism(out, 4, radius(MAST_HEIGHT * at) + 0.9, radius(MAST_HEIGHT * at) + 0.9, MAST_HEIGHT * at, MAST_HEIGHT * at + 0.4, t.cap, Math.PI / 4);
  prism(out, 4, 0.15, 0.08, MAST_HEIGHT, MAST_HEIGHT + ANTENNA, t.cap, Math.PI / 4);
}

function lighthouse(out: Builder, t: LandmarkTones) {
  prism(out, 8, 3.8, 3.6, -1.5, 1.2, t.stone, Math.PI / 8, t.stone_shade);
  const step = (LIGHTHOUSE_HEIGHT - 1.2) / LIGHTHOUSE_BANDS;
  const radius = (y: number) => 2.6 - (0.9 * (y - 1.2)) / (LIGHTHOUSE_HEIGHT - 1.2);
  for (let b = 0; b < LIGHTHOUSE_BANDS; b++) {
    const y0 = 1.2 + b * step;
    prism(out, 8, radius(y0), radius(y0 + step), y0, y0 + step, b % 2 ? t.band : t.pale, Math.PI / 8);
  }
  prism(out, 8, 2.5, 2.5, LIGHTHOUSE_HEIGHT, LIGHTHOUSE_HEIGHT + 0.4, t.cap, Math.PI / 8);
  const roof = LIGHTHOUSE_HEIGHT + 0.4 + LANTERN;
  prism(out, 8, 1.7, 0, roof, roof + 1.4, t.band, Math.PI / 8);
}

function turbine(out: Builder, t: LandmarkTones) {
  prism(out, 8, 1.3, 0.7, -1, TURBINE_HEIGHT, t.pale, 0);
  const { hw, hd, low, high } = NACELLE;
  out.top(hw, hd, TURBINE_HEIGHT + high, t.pale);
  out.walls(hw, hd, TURBINE_HEIGHT + low, TURBINE_HEIGHT + high, t.pale);
  out.quad([-hw, TURBINE_HEIGHT + low, -hd], [hw, TURBINE_HEIGHT + low, -hd], [hw, TURBINE_HEIGHT + low, hd], [-hw, TURBINE_HEIGHT + low, hd], t.cap);
}

function arch(out: Builder, prop: Prop, heights: Float32Array, t: LandmarkTones) {
  const [fx, fz] = forward(prop);
  const half = prop.scale;
  const top = ARCH_CLEARANCE + ARCH_THICK;
  for (const side of [-1, 1]) {
    const lx = side * half;
    const ground = sample(heights, prop.x + fz * lx, prop.z - fx * lx) - prop.y;
    const lean = side * 0.5;
    prism(out, 6, ARCH_LEG * 1.25, ARCH_LEG * 0.95, ground - 1, top - 0.5, t.stone, hash(Math.round(prop.x), side, 7) * Math.PI, t.stone_shade, lx, 0);
    prism(out, 5, ARCH_LEG * 1.4, ARCH_LEG * 1.1, ground - 1, ground + 1.6, t.stone_shade, hash(Math.round(prop.z), side, 9) * Math.PI, t.stone, lx + lean, 0.4);
  }
  const reach = half + ARCH_LEG * 1.3;
  slab(out, -reach, reach, ARCH_LEG, ARCH_CLEARANCE, top, t.stone, t.stone_shade);
  slab(out, -reach * 0.55, reach * 0.4, ARCH_LEG * 0.8, top, top + 1.1, t.stone_shade, t.stone);
}

export function landmark_mesh(out: Builder, prop: Prop, heights: Float32Array, tones: LandmarkTones) {
  const [fx, fz] = forward(prop);
  out.at({ x: prop.x, y: prop.y, z: prop.z, fx, fz });
  if (prop.kind === PropKind.MAST) mast(out, tones);
  else if (prop.kind === PropKind.LIGHTHOUSE) lighthouse(out, tones);
  else if (prop.kind === PropKind.TURBINE) turbine(out, tones);
  else if (prop.kind === PropKind.ARCH) arch(out, prop, heights, tones);
}

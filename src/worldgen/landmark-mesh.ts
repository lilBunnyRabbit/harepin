import { sample } from "./field";
import { ARCH_CLEARANCE, ARCH_LEG, ARCH_THICK, LIGHTHOUSE_HEIGHT, MAST_HEIGHT, TURBINE_HEIGHT } from "./landmarks";
import type { Builder, Rgb, V3 } from "./mesh";
import { hash } from "./noise";
import { HEADINGS, reach, two_arms } from "./scatter";
import { PropKind, type Prop } from "./types";

export interface LandmarkTones {
  pale: Rgb;
  band: Rgb;
  cap: Rgb;
  stone: Rgb;
  stone_shade: Rgb;
  plant: Rgb;
  plant_shade: Rgb;
}

const MAST_BANDS = 6;
const MAST_BASE = 3;
const MAST_TOP = 1;
const ANTENNA = 5;
const LANTERN = 2;
const NACELLE = { half: 0.9, ahead: 2.4, back: 1.4, tail: 2.0 };
const MAST_DECKS = [0.45, 0.8];
const DECK = { out: 0.8, corbel: 0.6, rim: 0.35 };
export const HUB_AHEAD = 2.6;
/** Wind pump at scale 1, metres: legs this far off the centre, platform top, fan hub height, fan radius and how far ahead it turns. */
const PUMP = { legs: 0.75, top: 8.3, hub: 9.6, fan: 1.8, ahead: 0.6, blades: 14 };
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
        y: p.y + TURBINE_HEIGHT + HUB_RISE + NACELLE.half + 0.2,
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

export function prism(out: Builder, sides: number, r0: number, r1: number, y0: number, y1: number, rgb: Rgb, phase = 0, shade?: Rgb, cx = 0, cz = 0) {
  band(out, sides, r0, r1, y0, y1, rgb, phase, shade, cx, cz);
  if (r1 <= 0) return;
  for (let k = 0; k < sides; k++) {
    const [ax, az] = ring(sides, r1, k, phase);
    const [bx, bz] = ring(sides, r1, k + 1, phase);
    out.tri([cx, y1, cz], [cx + bx, y1, cz + bz], [cx + ax, y1, cz + az], shade ?? rgb);
  }
}

export function band(out: Builder, sides: number, r0: number, r1: number, y0: number, y1: number, rgb: Rgb, phase = 0, shade?: Rgb, cx = 0, cz = 0) {
  for (let k = 0; k < sides; k++) {
    const [ax0, az0] = ring(sides, r0, k, phase);
    const [bx0, bz0] = ring(sides, r0, k + 1, phase);
    const [ax1, az1] = ring(sides, r1, k, phase);
    const [bx1, bz1] = ring(sides, r1, k + 1, phase);
    out.quad([cx + bx0, y0, cz + bz0], [cx + ax0, y0, cz + az0], [cx + ax1, y1, cz + az1], [cx + bx1, y1, cz + bz1], shade && k % 2 ? shade : rgb);
  }
}

interface Section {
  at: V3;
  n: number;
  b: number;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

function sweep(out: Builder, path: readonly Section[], side: V3, sides: number, phase: number, rgb: Rgb, shade: Rgb, tip?: V3) {
  const rings = path.map((s, i) => {
    const t = unit(sub(path[Math.min(path.length - 1, i + 1)].at, path[Math.max(0, i - 1)].at));
    const n = unit(cross(side, t));
    return Array.from({ length: sides }, (_, k): V3 => {
      const a = phase + (k / sides) * Math.PI * 2;
      const u = Math.cos(a) * s.n;
      const v = Math.sin(a) * s.b;
      return [s.at[0] + n[0] * u + side[0] * v, s.at[1] + n[1] * u + side[1] * v, s.at[2] + n[2] * u + side[2] * v];
    });
  });
  for (let i = 0; i + 1 < rings.length; i++)
    for (let k = 0; k < sides; k++) {
      const j = (k + 1) % sides;
      out.quad(rings[i][k], rings[i][j], rings[i + 1][j], rings[i + 1][k], k % 2 ? shade : rgb);
    }
  if (!tip) return;
  const last = rings[rings.length - 1];
  for (let k = 0; k < sides; k++) out.tri(tip, last[k], last[(k + 1) % sides], k % 2 ? shade : rgb);
}

function mast(out: Builder, t: LandmarkTones) {
  const step = MAST_HEIGHT / MAST_BANDS;
  const radius = (y: number) => MAST_BASE + ((MAST_TOP - MAST_BASE) * y) / MAST_HEIGHT;
  const tone = (y: number) => (Math.floor(y / step) % 2 ? t.band : t.pale);
  for (let b = 0; b < MAST_BANDS; b++) (b < MAST_BANDS - 1 ? band : prism)(out, 4, radius(b * step), radius((b + 1) * step), b === 0 ? -1 : b * step, (b + 1) * step, tone(b * step), Math.PI / 4);
  for (const at of MAST_DECKS) {
    const y = MAST_HEIGHT * at;
    const r = radius(y) + DECK.out;
    band(out, 4, radius(y - DECK.corbel), r, y - DECK.corbel, y, tone(y), Math.PI / 4);
    prism(out, 4, r, r, y, y + DECK.rim, tone(y), Math.PI / 4);
  }
  prism(out, 4, 0.15, 0.08, MAST_HEIGHT, MAST_HEIGHT + ANTENNA, t.cap, Math.PI / 4);
}

const SEA_LIGHT_PHASE = Math.PI / 8;
/** Tower rings above the stone foot, [height, radius]: it leaves the foot at the solid's radius and flares in to a slim neck. */
const SEA_LIGHT_RINGS: readonly (readonly [number, number])[] = [
  [1.2, 2.6],
  [5.6, 2.15],
  [10.2, 1.9],
  [14.8, 1.75],
  [19.2, 1.7],
];
const GALLERY = 2.5;
const CAGE = 1.5;

// A door or window: a dark pane just proud of the tower's front face, leaning with it.
function opening(out: Builder, hw: number, y0: number, y1: number, r0: number, r1: number, rgb: Rgb) {
  const [, z0] = ring(8, r0, 1, SEA_LIGHT_PHASE);
  const [, z1] = ring(8, r1, 1, SEA_LIGHT_PHASE);
  out.quad([-hw, y0, z0 + 0.04], [hw, y0, z0 + 0.04], [hw, y1, z1 + 0.04], [-hw, y1, z1 + 0.04], rgb);
}

// The candy-stripe sea light: a battered stone foot, a striped tower flaring into it, a gallery on a corbel with a rail,
// a caged lantern under a pointed roof with a finial.
function lighthouse(out: Builder, t: LandmarkTones) {
  const rings = SEA_LIGHT_RINGS;
  const neck = rings[rings.length - 1];
  prism(out, 8, 3.8, 2.75, -1.5, rings[0][0], t.stone, SEA_LIGHT_PHASE, t.stone_shade);
  for (let b = 0; b < rings.length - 1; b++) prism(out, 8, rings[b][1], rings[b + 1][1], rings[b][0], rings[b + 1][0], b % 2 ? t.band : t.pale, SEA_LIGHT_PHASE);
  opening(out, 0.55, 1.2, 3.4, 2.6, 2.37, t.cap);
  opening(out, 0.3, 8, 9.3, 2.03, 1.95, t.cap);
  opening(out, 0.3, 15.6, 16.8, 1.74, 1.72, t.cap);
  const deck = LIGHTHOUSE_HEIGHT + 0.4;
  prism(out, 8, neck[1], GALLERY, neck[0], LIGHTHOUSE_HEIGHT, t.pale, SEA_LIGHT_PHASE);
  prism(out, 8, GALLERY, GALLERY, LIGHTHOUSE_HEIGHT, deck, t.cap, SEA_LIGHT_PHASE);
  for (let k = 0; k < 8; k++) {
    const [ax, az] = ring(8, GALLERY - 0.05, k, SEA_LIGHT_PHASE);
    const [bx, bz] = ring(8, GALLERY - 0.05, k + 1, SEA_LIGHT_PHASE);
    plate(out, [ax, deck, az], [bx, deck, bz], [bx, deck + 0.7, bz], [ax, deck + 0.7, az], t.cap);
  }
  for (let k = 0; k < 4; k++) {
    const [cx, cz] = ring(4, CAGE, k, SEA_LIGHT_PHASE);
    prism(out, 4, 0.08, 0.08, deck, deck + LANTERN + 0.05, t.cap, SEA_LIGHT_PHASE + (k * Math.PI) / 2, undefined, cx, cz);
  }
  const roof = deck + LANTERN;
  prism(out, 8, 1.9, 0, roof, roof + 1.5, t.band, SEA_LIGHT_PHASE);
  prism(out, 4, 0.07, 0.04, roof + 1.4, roof + 2.4, t.cap, 0);
}

function turbine(out: Builder, t: LandmarkTones) {
  band(out, 8, 1.3, 0.7, -1, TURBINE_HEIGHT, t.pale, 0);
  const { half, ahead, back, tail } = NACELLE;
  const y = TURBINE_HEIGHT + HUB_RISE;
  const r = half / Math.cos(Math.PI / 8);
  const path: Section[] = [
    { at: [0, y, ahead], n: 0.62, b: 0.55 },
    { at: [0, y, ahead - 0.8], n: r, b: r },
    { at: [0, y, -back], n: r, b: r },
  ];
  sweep(out, path, [1, 0, 0], 8, Math.PI / 8, t.pale, t.pale, [0, y + 0.1, -tail]);
}

// The span's flat underside is the solid's bottom, its legs the solids' circles.
function arch(out: Builder, prop: Prop, heights: Float32Array, t: LandmarkTones) {
  const [fx, fz] = forward(prop);
  const half = prop.scale;
  const span = ARCH_THICK / 2 / Math.cos(Math.PI / 6);
  const mid = ARCH_CLEARANCE + ARCH_THICK / 2;
  const leg = (side: number): Section[] => {
    const lx = side * half;
    const ground = sample(heights, prop.x + fz * lx, prop.z - fx * lx) - prop.y;
    const swell = 1 + hash(Math.round(prop.x), side, 7) * 0.15;
    return [
      { at: [side * (half + 0.7), ground - 1, 0], n: ARCH_LEG * 1.4 * swell, b: ARCH_LEG * 1.3 },
      { at: [side * (half + 0.35), ground + 1.2, 0], n: ARCH_LEG * 1.15 * swell, b: ARCH_LEG * 1.1 },
      { at: [lx, (ground + ARCH_CLEARANCE) / 2 + 0.8, 0], n: ARCH_LEG * 0.9, b: ARCH_LEG * 0.9 },
      { at: [side * (half - 0.55), ARCH_CLEARANCE + 0.9, 0], n: ARCH_LEG * 1.05, b: ARCH_LEG },
      { at: [side * half * 0.45, mid, 0], n: span, b: ARCH_LEG },
    ];
  };
  const path = [...leg(-1), ...leg(1).reverse()];
  sweep(out, path, [0, 0, 1], 6, Math.PI / 6, t.stone, t.stone_shade);
}

// Drawn to its solid parts (scatter.ts) at scale 1: a saguaro of tree-crown green with one or two arms.
/** Base height, below the prop's own ground, that keeps the whole footprint buried on a slope. */
const FOOTING = 0.3;

function footing(prop: Prop, heights: Float32Array): number {
  const r = reach(prop);
  let low = 0;
  for (const [dx, dz] of HEADINGS) low = Math.min(low, sample(heights, prop.x + dx * r, prop.z + dz * r) - prop.y);
  return low - FOOTING;
}

function cactus(out: Builder, s: number, two: boolean, base: number, t: LandmarkTones) {
  const up = (x: number, y0: number, y1: number, top: number, r: number): Section[] => [
    { at: [x, y0, 0], n: r, b: r },
    { at: [x, y1, 0], n: r * 0.92, b: r * 0.92 },
    { at: [x, top - r * 0.75, 0], n: r * 0.72, b: r * 0.72 },
  ];
  const limb = (path: Section[], top: number) => {
    const end = path[path.length - 1].at;
    sweep(out, path, [0, 0, 1], 6, 0, t.plant, t.plant_shade, [end[0], top, 0]);
  };
  limb(up(0, base, 3.6 * s, 4.6 * s, 0.45 * s), 4.6 * s);
  const arm = (side: number, x: number, y: number, top: number, r: number) => {
    const elbow: Section[] = [
      { at: [side * 0.15 * s, y, 0], n: r * 0.95, b: r * 0.95 },
      { at: [side * (x - 0.33) * s, y + 0.08 * s, 0], n: r, b: r },
      { at: [side * (x - 0.03) * s, y + 0.45 * s, 0], n: r, b: r },
    ];
    limb([...elbow, { at: [side * x * s, top - r * 0.75, 0], n: r * 0.8, b: r * 0.8 }], top);
  };
  arm(1, 0.95, 1.7 * s, 3.5 * s, 0.3 * s);
  if (two) arm(-1, 0.95, 1.2 * s, 2.8 * s, 0.27 * s);
}

export interface Rock {
  sides: number;
  phase: number;
  /** [height, radius, x, z] from the foot up, centres in the prop's frame. */
  rings: readonly (readonly [number, number, number, number])[];
  crown: V3;
  lumps: readonly number[];
}

/** The boulder's body and its side lobe, drawn to the solid parts in scatter.ts and never past their radii. */
export function boulder_rocks(s: number, roll: number, base: number): Rock[] {
  const lumps = (sides: number, salt: number) => Array.from({ length: sides }, (_, k) => 0.8 + 0.2 * hash(k, salt, Math.round(roll * 1000)));
  return [
    {
      sides: 7,
      phase: roll * Math.PI,
      rings: [
        [base, 1.45 * s, 0, 0],
        [0.45 * s, 1.6 * s, 0.04 * s, 0],
        [1.1 * s, 1.12 * s, 0.14 * s, -0.08 * s],
      ],
      crown: [0.28 * s, 1.5 * s, -0.12 * s],
      lumps: lumps(7, 1),
    },
    {
      sides: 5,
      phase: roll * 5,
      rings: [
        [base, 0.62 * s, 1.5 * s, 0.4 * s],
        [0.3 * s, 0.7 * s, 1.52 * s, 0.4 * s],
        [0.62 * s, 0.46 * s, 1.42 * s, 0.36 * s],
      ],
      crown: [1.32 * s, 0.8 * s, 0.32 * s],
      lumps: lumps(5, 2),
    },
  ];
}

export function rock(out: Builder, r: Rock, rgb: Rgb, shade: Rgb, from = 0, grow = 1, lift = 0) {
  const at = (i: number, k: number): V3 => {
    const [y, radius, cx, cz] = r.rings[i];
    const a = r.phase + (k / r.sides) * Math.PI * 2;
    const w = radius * r.lumps[k % r.sides] * grow;
    return [cx + Math.cos(a) * w, y + lift, cz + Math.sin(a) * w];
  };
  for (let i = from; i + 1 < r.rings.length; i++)
    for (let k = 0; k < r.sides; k++) out.quad(at(i, k + 1), at(i, k), at(i + 1, k), at(i + 1, k + 1), k % 2 ? shade : rgb);
  const top = r.rings.length - 1;
  const crown: V3 = [r.crown[0], r.crown[1] + lift, r.crown[2]];
  for (let k = 0; k < r.sides; k++) out.tri(crown, at(top, k + 1), at(top, k), k % 2 ? shade : rgb);
}

function boulder(out: Builder, s: number, roll: number, base: number, t: LandmarkTones) {
  for (const r of boulder_rocks(s, roll, base)) rock(out, r, t.stone, t.stone_shade);
}

// A hoodoo: a tapering column of alternating stone bands under a wider cap rock.
function spire(out: Builder, s: number, roll: number, base: number, t: LandmarkTones) {
  const phase = roll * Math.PI;
  prism(out, 6, 2.4 * s, 1.7 * s, base, 5 * s, t.stone, phase, t.stone_shade);
  prism(out, 6, 1.7 * s, 1.1 * s, 5 * s, 10 * s, t.stone_shade, phase, t.stone);
  prism(out, 5, 1.1 * s, 0.8 * s, 10 * s, 11.6 * s, t.stone, phase);
  prism(out, 6, 1.7 * s, 1.4 * s, 11.6 * s, 13 * s, t.stone_shade, phase + 0.4, t.stone);
}

function tank(out: Builder, base: number, t: LandmarkTones) {
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) prism(out, 4, 0.14, 0.14, base, 3.3, t.cap, Math.PI / 4, undefined, cx, cz);
  prism(out, 8, 1.8, 1.8, 3.2, 5.6, t.pale, Math.PI / 8, t.band);
  prism(out, 8, 1.95, 0, 5.6, 6.4, t.band, Math.PI / 8);
}

/** Both faces of a thin flat part: fan blades, braces and the tail vane are seen from either side. */
export function plate(out: Builder, a: V3, b: V3, c: V3, d: V3, rgb: Rgb) {
  out.quad(a, b, c, d, rgb);
  out.quad(d, c, b, a, rgb);
}

// Drawn to its solid part (scatter.ts): a four-leg tower, a platform, a many-bladed fan facing forward and a tail vane behind.
function wind_pump(out: Builder, s: number, base: number, t: LandmarkTones) {
  const { legs, top, hub, fan, blades } = PUMP;
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) prism(out, 4, 0.09 * s, 0.07 * s, base, top * s, t.cap, Math.PI / 4, undefined, cx * legs * s, cz * legs * s);
  for (const y of [top * 0.33, top * 0.66])
    for (const side of [-1, 1]) {
      const e = legs * s;
      plate(out, [-e, y * s, side * e], [e, y * s, side * e], [e, (y + 0.12) * s, side * e], [-e, (y + 0.12) * s, side * e], t.cap);
      plate(out, [side * e, y * s, -e], [side * e, y * s, e], [side * e, (y + 0.12) * s, e], [side * e, (y + 0.12) * s, -e], t.cap);
    }
  prism(out, 4, (legs + 0.25) * s, (legs + 0.25) * s, top * s, (top + 0.15) * s, t.cap, Math.PI / 4);
  prism(out, 6, 0.3 * s, 0.25 * s, (top + 0.15) * s, (hub + 0.35) * s, t.band, 0);
  const z = PUMP.ahead * s;
  for (let k = 0; k < blades; k++) {
    const [c, n] = ring(blades, 1, k, 0);
    const at = (r: number, w: number): [V3, V3] => [
      [(c * r - n * w) * s, (hub + n * r + c * w) * s, z],
      [(c * r + n * w) * s, (hub + n * r - c * w) * s, z],
    ];
    const [a, b] = at(0.3, 0.08);
    const [d, e] = at(fan, 0.22);
    plate(out, a, b, e, d, t.pale);
  }
  plate(out, [0, (hub - 0.1) * s, -0.2 * s], [0, (hub - 0.1) * s, -1.4 * s], [0, (hub - 0.5) * s, -2.8 * s], [0, (hub + 0.1) * s, -1.4 * s], t.band);
  plate(out, [0, (hub + 0.1) * s, -1.4 * s], [0, (hub - 0.5) * s, -2.8 * s], [0, (hub + 0.9) * s, -2.8 * s], [0, (hub + 0.1) * s, -1.4 * s], t.band);
}

export function landmark_mesh(out: Builder, prop: Prop, heights: Float32Array, tones: LandmarkTones) {
  const [fx, fz] = forward(prop);
  out.at({ x: prop.x, y: prop.y, z: prop.z, fx, fz });
  if (prop.kind === PropKind.MAST) mast(out, tones);
  else if (prop.kind === PropKind.LIGHTHOUSE) lighthouse(out, tones);
  else if (prop.kind === PropKind.TURBINE) turbine(out, tones);
  else if (prop.kind === PropKind.ARCH) arch(out, prop, heights, tones);
  else if (prop.kind === PropKind.CACTUS) cactus(out, prop.scale, two_arms(prop), footing(prop, heights), tones);
  else if (prop.kind === PropKind.BOULDER) boulder(out, prop.scale, prop.angle, footing(prop, heights), tones);
  else if (prop.kind === PropKind.SPIRE) spire(out, prop.scale, prop.angle, footing(prop, heights), tones);
  else if (prop.kind === PropKind.TANK) tank(out, footing(prop, heights), tones);
  else if (prop.kind === PropKind.WIND_PUMP) wind_pump(out, prop.scale, footing(prop, heights), tones);
}

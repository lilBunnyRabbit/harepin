import type { Rgb } from "./mesh";
import { PAD_HALF, rail_open } from "./sky";
import { DECK_STRIDE, type Deck } from "./types";

const THICK = 0.4;
// About 75% of a car's height, as a toy track wall stands next to its car; the outside of a bank stands taller still.
const RAIL_HIGH = 1;
const BANK_RAIL = 0.3;
/** Bank (rad) at which the outside rail reaches its full extra BANK_RAIL. */
const BANK_FULL = 0.35;
/** Where a rail stops for an open section it rounds down to the deck over this many metres, so the gap is seen coming. */
const CAP = 6;
const RAIL_WIDE = 0.3;
/** Track joints every SEGMENT metres: a seam plate SEAM long, a step darker; side faces drew as black bars from the chase camera. */
const SEGMENT = 9;
const SEAM = 0.25;
const SEAM_HIGH = 0.01;
/** The rail's top folds inward over the deck by LIP, LIP_DROP deep. */
const LIP = 0.1;
const LIP_DROP = 0.12;
/** Chevrons down a boost pad, pointing the way to drive: one every PITCH metres, arms BAR thick, tips DEPTH ahead. */
const CHEVRON_PITCH = 3;
const CHEVRON_BAR = 0.6;
const CHEVRON_DEPTH = 2.2;
const CHEVRON_HALF = PAD_HALF - 1;
const PAD_LIFT = 0.01;
const CHEVRON_LIFT = 0.03;

export interface DeckTones {
  deck: Rgb;
  side: Rgb;
  rail: Rgb;
  joint: Rgb;
  pad: Rgb;
  chevron: Rgb;
}

export interface DeckLayer {
  positions: number[];
  colors: number[];
}

type V = [number, number, number];

function xz(p: V): [number, number] {
  return [p[0], p[2]];
}

function push(layer: DeckLayer, rgb: Rgb, ...points: V[]) {
  for (const p of points) {
    layer.positions.push(p[0], p[1], p[2]);
    layer.colors.push(rgb[0], rgb[1], rgb[2]);
  }
}

function quad(layer: DeckLayer, rgb: Rgb, a: V, b: V, c: V, d: V) {
  push(layer, rgb, a, b, c, a, c, d);
}

export function deck_layers(deck: Deck, tones: DeckTones, chunk_of: (x: number, z: number) => number, surface: DeckLayer[], marks: DeckLayer[]) {
  const line = deck.line;
  const n = line.length / DECK_STRIDE;
  const f = (i: number, k: number) => line[(i % n) * DECK_STRIDE + k];
  const at = (i: number, u: number, lift: number): V => {
    const tx = f(i, 3);
    const tz = f(i, 4);
    const slope = Math.tan(f(i, 5));
    return [f(i, 0) + tz * u, f(i, 1) + u * slope + lift, f(i, 2) - tx * u];
  };
  const cap = (s: number, side: number) => {
    if (rail_open(deck.open, s, side)) return 0;
    let d = CAP;
    for (const o of deck.open) if (o.side === 0 || o.side === side) d = Math.min(d, Math.abs(s - o.s0), Math.abs(s - o.s1));
    return Math.sqrt(1 - (1 - d / CAP) ** 2);
  };
  const rail_high = (i: number, side: number) => (RAIL_HIGH + BANK_RAIL * Math.min(1, Math.max(0, side * f(i, 5)) / BANK_FULL)) * cap(f(i, 8), side);
  for (let i = 0; i < n; i++) {
    const j = i + 1;
    if (!f(i, 7) || !f(j, 7)) continue;
    const layer = surface[chunk_of(f(i, 0), f(i, 2))];
    const h = f(i, 6);
    const hj = f(j, 6);
    quad(layer, tones.deck, at(i, -h, 0), at(i, h, 0), at(j, hj, 0), at(j, -hj, 0));
    quad(layer, tones.side, at(i, -h - RAIL_WIDE, -THICK), at(j, -hj - RAIL_WIDE, -THICK), at(j, hj + RAIL_WIDE, -THICK), at(i, h + RAIL_WIDE, -THICK));
    for (const side of [-1, 1]) {
      const inner_i = side * h;
      const inner_j = side * hj;
      const lip_i = side * (h - LIP);
      const lip_j = side * (hj - LIP);
      const outer_i = side * (h + RAIL_WIDE);
      const outer_j = side * (hj + RAIL_WIDE);
      const top_i = rail_high(i, side);
      const top_j = rail_high(j, side);
      if (top_i === 0 && top_j === 0) {
        quad(layer, tones.side, at(i, side * h, 0), at(j, side * hj, 0), at(j, side * hj, -THICK), at(i, side * h, -THICK));
        continue;
      }
      const low_i = Math.max(0, top_i - LIP_DROP);
      const low_j = Math.max(0, top_j - LIP_DROP);
      quad(layer, tones.rail, at(i, inner_i, 0), at(j, inner_j, 0), at(j, inner_j, low_j), at(i, inner_i, low_i));
      quad(layer, tones.rail, at(i, lip_i, low_i), at(j, lip_j, low_j), at(j, inner_j, low_j), at(i, inner_i, low_i));
      quad(layer, tones.rail, at(i, lip_i, low_i), at(j, lip_j, low_j), at(j, lip_j, top_j), at(i, lip_i, top_i));
      quad(layer, tones.rail, at(i, lip_i, top_i), at(j, lip_j, top_j), at(j, outer_j, top_j), at(i, outer_i, top_i));
      quad(layer, tones.side, at(i, outer_i, top_i), at(j, outer_j, top_j), at(j, outer_j, -THICK), at(i, outer_i, -THICK));
    }
  }
  const index_at = (s: number) => {
    let lo = 0;
    let hi = n - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (f(mid, 8) <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const along = (s: number, u: number, lift: number): V => {
    const i = index_at(s);
    const a = at(i, u, lift);
    const b = at(i + 1, u, lift);
    const t = (s - f(i, 8)) / (f(i + 1, 8) - f(i, 8));
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };
  for (const pad of deck.pads) {
    const layer = marks[chunk_of(...xz(along(pad.s0, 0, 0)))];
    const cuts = [pad.s0];
    for (let i = index_at(pad.s0) + 1; f(i, 8) < pad.s1; i++) cuts.push(f(i, 8));
    cuts.push(pad.s1);
    for (let k = 0; k + 1 < cuts.length; k++) quad(layer, tones.pad, along(cuts[k], -PAD_HALF, PAD_LIFT), along(cuts[k], PAD_HALF, PAD_LIFT), along(cuts[k + 1], PAD_HALF, PAD_LIFT), along(cuts[k + 1], -PAD_HALF, PAD_LIFT));
    for (let c = pad.s0 + (CHEVRON_PITCH - CHEVRON_DEPTH - CHEVRON_BAR) / 2; c + CHEVRON_DEPTH + CHEVRON_BAR <= pad.s1; c += CHEVRON_PITCH) {
      const p = (s: number, u: number) => along(s, u, CHEVRON_LIFT);
      const tip = c + CHEVRON_DEPTH;
      quad(layer, tones.chevron, p(c, -CHEVRON_HALF), p(tip, 0), p(tip + CHEVRON_BAR, 0), p(c + CHEVRON_BAR, -CHEVRON_HALF));
      quad(layer, tones.chevron, p(tip, 0), p(c, CHEVRON_HALF), p(c + CHEVRON_BAR, CHEVRON_HALF), p(tip + CHEVRON_BAR, 0));
    }
  }
  for (let i = 0; i < n; i++) {
    const s = f(i, 8);
    const next = f(i + 1, 8);
    if (next < s || Math.floor(s / SEGMENT) === Math.floor(next / SEGMENT) || !f(i, 7) || !f(i + 1, 7)) continue;
    const layer = marks[chunk_of(f(i, 0), f(i, 2))];
    const h = f(i, 6) + RAIL_WIDE;
    const tx = f(i, 3) * SEAM;
    const tz = f(i, 4) * SEAM;
    const shift = (p: V, lift: number): V => [p[0] + tx, p[1] + lift, p[2] + tz];
    for (const [u0, u1, base] of [[-h + RAIL_WIDE, h - RAIL_WIDE, 0], [-h, -h + RAIL_WIDE + 0.001, rail_high(i, -1)], [h - RAIL_WIDE - 0.001, h, rail_high(i, 1)]].filter((seam, k) => k === 0 || seam[2] > 0)) {
      const a1 = at(i, u0, base + SEAM_HIGH);
      const b1 = at(i, u1, base + SEAM_HIGH);
      quad(layer, tones.joint, a1, b1, shift(b1, 0), shift(a1, 0));
    }
  }
}

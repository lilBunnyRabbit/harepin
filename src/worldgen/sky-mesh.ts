import type { Rgb } from "./mesh";
import { DECK_STRIDE, type Deck } from "./types";

const THICK = 0.4;
// About 75% of a car's height, as a toy track wall stands next to its car; the outside of a bank stands taller still.
const RAIL_HIGH = 1;
const BANK_RAIL = 0.3;
/** Bank (rad) at which the outside rail reaches its full extra BANK_RAIL. */
const BANK_FULL = 0.35;
const RAIL_WIDE = 0.3;
/** Track joints every SEGMENT metres: a seam plate SEAM long, a step darker; side faces drew as black bars from the chase camera. */
const SEGMENT = 9;
const SEAM = 0.25;
const SEAM_HIGH = 0.01;
/** The rail's top folds inward over the deck by LIP, LIP_DROP deep. */
const LIP = 0.1;
const LIP_DROP = 0.12;

export interface DeckTones {
  deck: Rgb;
  side: Rgb;
  rail: Rgb;
  joint: Rgb;
}

export interface DeckLayer {
  positions: number[];
  colors: number[];
}

type V = [number, number, number];

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
  const rail_high = (i: number, side: number) => RAIL_HIGH + BANK_RAIL * Math.min(1, Math.max(0, side * f(i, 5)) / BANK_FULL);
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
      quad(layer, tones.rail, at(i, inner_i, 0), at(j, inner_j, 0), at(j, inner_j, top_j - LIP_DROP), at(i, inner_i, top_i - LIP_DROP));
      quad(layer, tones.rail, at(i, lip_i, top_i - LIP_DROP), at(j, lip_j, top_j - LIP_DROP), at(j, inner_j, top_j - LIP_DROP), at(i, inner_i, top_i - LIP_DROP));
      quad(layer, tones.rail, at(i, lip_i, top_i - LIP_DROP), at(j, lip_j, top_j - LIP_DROP), at(j, lip_j, top_j), at(i, lip_i, top_i));
      quad(layer, tones.rail, at(i, lip_i, top_i), at(j, lip_j, top_j), at(j, outer_j, top_j), at(i, outer_i, top_i));
      quad(layer, tones.side, at(i, outer_i, top_i), at(j, outer_j, top_j), at(j, outer_j, -THICK), at(i, outer_i, -THICK));
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
    for (const [u0, u1, base] of [[-h + RAIL_WIDE, h - RAIL_WIDE, 0], [-h, -h + RAIL_WIDE + 0.001, rail_high(i, -1)], [h - RAIL_WIDE - 0.001, h, rail_high(i, 1)]]) {
      const a1 = at(i, u0, base + SEAM_HIGH);
      const b1 = at(i, u1, base + SEAM_HIGH);
      quad(layer, tones.joint, a1, b1, shift(b1, 0), shift(a1, 0));
    }
  }
}

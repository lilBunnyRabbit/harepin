import type { Rgb } from "./mesh";
import { DECK_STRIDE, type Deck } from "./types";

const THICK = 0.4;
const RAIL_HIGH = 0.7;
const RAIL_WIDE = 0.3;
const JOINT = 0.6;
const JOINT_LIFT = 0.02;

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
  const joints = new Set(deck.pieces.map((p) => p.s0));
  for (let i = 0; i < n; i++) {
    const j = i + 1;
    if (!f(i, 7) || !f(j, 7)) continue;
    const layer = surface[chunk_of(f(i, 0), f(i, 2))];
    const h = f(i, 6);
    const hj = f(j, 6);
    quad(layer, tones.deck, at(i, -h, 0), at(i, h, 0), at(j, hj, 0), at(j, -hj, 0));
    quad(layer, tones.side, at(i, -h, -THICK), at(j, -hj, -THICK), at(j, hj, -THICK), at(i, h, -THICK));
    for (const side of [-1, 1]) {
      const inner_i = side * h;
      const inner_j = side * hj;
      const outer_i = side * (h + RAIL_WIDE);
      const outer_j = side * (hj + RAIL_WIDE);
      quad(layer, tones.rail, at(i, inner_i, 0), at(j, inner_j, 0), at(j, inner_j, RAIL_HIGH), at(i, inner_i, RAIL_HIGH));
      quad(layer, tones.rail, at(i, inner_i, RAIL_HIGH), at(j, inner_j, RAIL_HIGH), at(j, outer_j, RAIL_HIGH), at(i, outer_i, RAIL_HIGH));
      quad(layer, tones.side, at(i, outer_i, RAIL_HIGH), at(j, outer_j, RAIL_HIGH), at(j, outer_j, -THICK), at(i, outer_i, -THICK));
    }
  }
  for (let i = 0; i < n; i++) {
    const s = f(i, 8);
    if (![...joints].some((js) => js >= s && js < s + 2) || !f(i, 7) || !f(i + 1, 7)) continue;
    const layer = marks[chunk_of(f(i, 0), f(i, 2))];
    const h = f(i, 6);
    const tx = f(i, 3) * JOINT;
    const tz = f(i, 4) * JOINT;
    const a = at(i, -h, JOINT_LIFT);
    const b = at(i, h, JOINT_LIFT);
    quad(layer, tones.joint, a, b, [b[0] + tx, b[1], b[2] + tz], [a[0] + tx, a[1], a[2] + tz]);
    for (const side of [-1, 1]) {
      const c = at(i, side * (h + RAIL_WIDE / 2), RAIL_HIGH + JOINT_LIFT);
      const w = RAIL_WIDE;
      quad(layer, tones.joint, [c[0] - f(i, 4) * w, c[1], c[2] + f(i, 3) * w], [c[0] + f(i, 4) * w, c[1], c[2] - f(i, 3) * w], [c[0] + f(i, 4) * w + tx, c[1], c[2] - f(i, 3) * w + tz], [c[0] - f(i, 4) * w + tx, c[1], c[2] + f(i, 3) * w + tz]);
    }
  }
}

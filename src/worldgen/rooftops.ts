import { hash } from "./noise";
import { DECK_STRIDE, DECK_THICK, Roof, type Building, type Lot } from "./types";

export const STREET_BELOW = 24;
const ROOF_MIN = 18;
const ROOF_MAX = 70;
const ROOF_TURN = 0.5;
const ROOF_MARGIN = 2;
/** Under the deck slab, so the roof never shares a plane with its underside. */
const ROOF_SINK = 0.05;
// A crossover's lower pass runs under the upper pass's roof run: its building would wall the lower deck in.
const HEADROOM = 4;
// The deck either side of a run, along the lap: a crossover's other pass is at least SEPARATION_ALONG away.
const NEAR = 40;
const STYLES = 3;
const SHOP_ODDS = 0.4;

export interface Roofs {
  lots: Lot[];
  buildings: Building[];
}

interface Box {
  x: number;
  z: number;
  fx: number;
  fz: number;
  hw: number;
  hd: number;
  top: number;
}

/** One building under every flat run of a deck `line`, all standing on one street STREET_BELOW under the lowest deck. */
export function roof_buildings(seed: number, line: Float64Array): Roofs {
  const n = line.length / DECK_STRIDE;
  const f = (i: number, field: number) => line[i * DECK_STRIDE + field];
  let low = Infinity;
  for (let i = 0; i < n; i++) low = Math.min(low, f(i, 1));
  const street = low - STREET_BELOW;
  const flat = (i: number) => i + 1 < n && f(i, 7) === 1 && f(i + 1, 7) === 1 && f(i + 1, 1) === f(i, 1);
  const out: Roofs = { lots: [], buildings: [] };
  let a = 0;
  while (a < n) {
    if (!flat(a)) {
      a++;
      continue;
    }
    const heading = Math.atan2(f(a, 3), f(a, 4));
    let b = a + 1;
    while (flat(b) && f(b + 1, 8) - f(a, 8) <= ROOF_MAX && Math.abs(turn(Math.atan2(f(b + 1, 3), f(b + 1, 4)) - heading)) <= ROOF_TURN) b++;
    if (f(b, 8) - f(a, 8) >= ROOF_MIN) {
      const box = roof_box(f, a, b);
      if (box && !blocks(f, n, box, a, b)) add(out, seed, box, street);
    }
    a = b;
  }
  return out;
}

function turn(dh: number): number {
  return Math.atan2(Math.sin(dh), Math.cos(dh));
}

function roof_box(f: (i: number, field: number) => number, a: number, b: number): Box | null {
  const dx = f(b, 0) - f(a, 0);
  const dz = f(b, 2) - f(a, 2);
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return null;
  const fx = dx / len;
  const fz = dz / len;
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  let top = Infinity;
  for (let i = a; i <= b; i++) {
    const half = f(i, 6) + ROOF_MARGIN;
    const tx = f(i, 3);
    const tz = f(i, 4);
    for (const side of [-1, 1]) {
      const px = f(i, 0) + side * tz * half;
      const pz = f(i, 2) - side * tx * half;
      const u = (px - f(a, 0)) * fx + (pz - f(a, 2)) * fz;
      const v = (px - f(a, 0)) * fz - (pz - f(a, 2)) * fx;
      [u0, u1, v0, v1] = [Math.min(u0, u), Math.max(u1, u), Math.min(v0, v), Math.max(v1, v)];
    }
    top = Math.min(top, f(i, 1) - DECK_THICK - ROOF_SINK - f(i, 6) * Math.abs(Math.sin(f(i, 5))));
  }
  u0 -= ROOF_MARGIN;
  u1 += ROOF_MARGIN;
  const um = (u0 + u1) / 2;
  const vm = (v0 + v1) / 2;
  return { x: f(a, 0) + fx * um + fz * vm, z: f(a, 2) + fz * um - fx * vm, fx, fz, hw: (v1 - v0) / 2, hd: (u1 - u0) / 2, top };
}

function blocks(f: (i: number, field: number) => number, n: number, box: Box, a: number, b: number): boolean {
  const length = f(n - 1, 8);
  const sa = f(a, 8);
  const sb = f(b, 8);
  for (let i = 0; i < n; i++) {
    const d = Math.max(0, sa - f(i, 8), f(i, 8) - sb);
    if (Math.min(d, length - (sb - sa) - d) < NEAR) continue;
    const half = f(i, 6);
    const dx = f(i, 0) - box.x;
    const dz = f(i, 2) - box.z;
    if (Math.abs(dx * box.fx + dz * box.fz) >= box.hd + half || Math.abs(dx * box.fz - dz * box.fx) >= box.hw + half) continue;
    if (f(i, 1) < box.top + HEADROOM) return true;
  }
  return false;
}

function add(out: Roofs, seed: number, box: Box, street: number) {
  const id = out.lots.length;
  const angle = Math.atan2(box.fx, box.fz);
  const kind = hash(id, 1, seed + 71) < SHOP_ODDS ? "shop" : "house";
  out.lots.push({ id, town: 0, edge: 0, side: 1, x: box.x, y: street, z: box.z, w: 2 * box.hw, d: 2 * box.hd, fx: box.fx, fz: box.fz, angle, kind });
  out.buildings.push({ lot: id, x: box.x, y: street, z: box.z, hw: box.hw, hd: box.hd, fx: box.fx, fz: box.fz, angle, height: box.top - street, style: Math.floor(hash(id, 2, seed + 71) * STYLES), roof: Roof.FLAT });
}

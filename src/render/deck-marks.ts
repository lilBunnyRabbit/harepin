import * as THREE from "three";
import { linear } from "../theme/palette";
import type { Lab } from "../theme/theme";
import { deck_strips } from "../worldgen/sky-mesh";
import { DECK_STRIDE, type Deck } from "../worldgen/types";

const LIFT = 0.03;
const STACK = 0.012;

export interface DeckBand {
  from: number;
  to: number;
  tone: Lab;
  /** `from` and `to` are shares of the half-width, -1 the right edge and 1 the left; with `high`, -1 is a bank's low edge and 1 its top. */
  high?: boolean;
  dash?: number;
  gap?: number;
}

type V = [number, number, number];
type P = [number, number];

function cut(polygon: P[], a: number, b: number, keep: 1 | -1): P[] {
  const side = ([t, w]: P) => keep * (w - a - (b - a) * t);
  const out: P[] = [];
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) out.push(p);
    if (sp * sq < 0) {
      const k = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
    }
  });
  return out;
}

// Paint lies on the deck's own triangles (the split in `worldgen/sky-mesh.ts`): on the ruled surface it sinks into a twisting quad.
export function deck_marks(deck: Deck, bands: readonly DeckBand[], where: (bank: number) => boolean): THREE.Mesh {
  const line = deck.line;
  const n = line.length / DECK_STRIDE;
  const f = (i: number, k: number) => line[(i % n) * DECK_STRIDE + k];
  let lift = LIFT;
  const at = (i: number, share: number): V => {
    const u = share * f(i, 6);
    return [f(i, 0) + f(i, 4) * u, f(i, 1) + u * Math.tan(f(i, 5)) + lift, f(i, 2) - f(i, 3) * u];
  };
  const positions: number[] = [];
  const colors: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = i + 1;
    if (!f(i, 7) || !f(j, 7) || f(j, 8) < f(i, 8)) continue;
    const bank = (f(i, 5) + f(j, 5)) / 2;
    if (!where(bank)) continue;
    const strips = deck_strips(f(i, 5), f(j, 5), f(i, 6), f(j, 6));
    const s0 = f(i, 8);
    const s1 = f(j, 8);
    for (const [order, band] of bands.entries()) {
      // A later band lies over an earlier one where they overlap.
      lift = LIFT + order * STACK;
      const flip = band.high && bank < 0 ? -1 : 1;
      const lo = Math.min(band.from * flip, band.to * flip);
      const hi = Math.max(band.from * flip, band.to * flip);
      let t0 = 0;
      let t1 = 1;
      if (band.dash) {
        const period = band.dash + (band.gap ?? band.dash);
        const phase = s0 % period;
        if (phase >= band.dash) continue;
        t1 = Math.min(1, (band.dash - phase) / (s1 - s0));
      }
      const rgb = linear(band.tone);
      for (let k = 0; k < strips; k++) {
        const a = -1 + (2 * k) / strips;
        const b = -1 + (2 * (k + 1)) / strips;
        const w0 = Math.max(a, lo);
        const w1 = Math.min(b, hi);
        if (w1 <= w0) continue;
        const ia = at(i, a);
        const ib = at(i, b);
        const ja = at(j, a);
        const jb = at(j, b);
        const rect: P[] = [[t0, w0], [t0, w1], [t1, w1], [t1, w0]];
        const place = (origin: V, across: V, along: V) => ([t, w]: P): V => {
          const c = (w - a) / (b - a);
          return [origin[0] + across[0] * c + along[0] * t, origin[1] + across[1] * c + along[1] * t, origin[2] + across[2] * c + along[2] * t];
        };
        const sub = (p: V, q: V): V => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
        const faces: [P[], (p: P) => V][] = [
          [cut(rect, a, b, 1), place(ia, sub(ib, ia), sub(jb, ib))],
          [cut(rect, a, b, -1), place(ia, sub(jb, ja), sub(ja, ia))],
        ];
        for (const [polygon, to_world] of faces) {
          const points = polygon.map(to_world);
          for (let v = 1; v + 1 < points.length; v++) {
            for (const p of [points[0], points[v], points[v + 1]]) {
              positions.push(p[0], p[1], p[2]);
              colors.push(rgb[0], rgb[1], rgb[2]);
            }
          }
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
  mesh.receiveShadow = true;
  return mesh;
}

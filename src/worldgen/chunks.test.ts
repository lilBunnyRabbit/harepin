/// <reference types="bun" />
import { expect, test } from "bun:test";
import { CHUNKS, Roads } from "./chunks";
import { sample } from "./field";
import { hash } from "./noise";
import { N, type RoadPoint } from "./types";

const HALF = 6;
const LIFT = 0.03;
const RADIUS = 40;
const STEP = 2;
const FLAT_BELOW = N / 2 + 3;

// Bumps on one side of the ring, a tilted plane on the other: the ring crosses from cut cells into flat ones and back.
function bumpy(): Float32Array {
  return Float32Array.from({ length: (N + 1) * (N + 1) }, (_, k) => {
    const i = k % (N + 1);
    const j = Math.floor(k / (N + 1));
    return i < FLAT_BELOW ? 0.05 * i + 0.03 * j : hash(i, j, 11) * 2;
  });
}

function ring(): RoadPoint[] {
  const count = Math.round((2 * Math.PI * RADIUS) / STEP);
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * 2 * Math.PI;
    return { x: RADIUS * Math.cos(a) + 13.7, y: 0, z: RADIUS * Math.sin(a) - 9.3, tx: -Math.sin(a), tz: Math.cos(a) };
  });
}

function drape_ring() {
  const heights = bumpy();
  const road = ring();
  const layer = { positions: [] as number[], colors: [] as number[] };
  new Roads(heights).strip(Array(CHUNKS * CHUNKS).fill(layer), road, true, -HALF, HALF, LIFT, () => true, [0, 0, 0]);
  return { heights, road, positions: Float32Array.from(layer.positions) };
}

test("a road ring on bumpy ground has no cracks: only its two rims are unshared edges", () => {
  const { road, positions: p } = drape_ring();
  const key = (v: number) => `${p[v * 3]},${p[v * 3 + 1]},${p[v * 3 + 2]}`;
  const uses = new Map<string, { a: number; b: number; count: number }>();
  for (let t = 0; t < p.length / 9; t++)
    for (let e = 0; e < 3; e++) {
      const a = t * 3 + e;
      const b = t * 3 + ((e + 1) % 3);
      const id = [key(a), key(b)].sort().join("|");
      const edge = uses.get(id);
      if (edge) edge.count++;
      else uses.set(id, { a, b, count: 1 });
    }
  let open = 0;
  for (const { a, b, count } of uses.values()) if (count === 1) open += Math.hypot(p[b * 3] - p[a * 3], p[b * 3 + 2] - p[a * 3 + 2]);
  const rim = (side: number) =>
    road.reduce((sum, a, i) => {
      const b = road[(i + 1) % road.length];
      return sum + Math.hypot(b.x - b.tz * side - (a.x - a.tz * side), b.z + b.tx * side - (a.z + a.tx * side));
    }, 0);
  expect(open).toBeCloseTo(rim(HALF) + rim(-HALF), 2);
});

test("a road ring lies exactly its lift above the ground everywhere, not only at its vertices", () => {
  const { heights, positions: p } = drape_ring();
  let worst = 0;
  for (let o = 0; o < p.length; o += 9)
    for (const [u, v] of [
      [1 / 3, 1 / 3],
      [0.5, 0.25],
      [0.25, 0.5],
      [0.1, 0.1],
    ]) {
      const w = 1 - u - v;
      const x = p[o] * u + p[o + 3] * v + p[o + 6] * w;
      const y = p[o + 1] * u + p[o + 4] * v + p[o + 7] * w;
      const z = p[o + 2] * u + p[o + 5] * v + p[o + 8] * w;
      worst = Math.max(worst, Math.abs(y - LIFT - sample(heights, x, z)));
    }
  expect(worst).toBeLessThan(1e-3);
});

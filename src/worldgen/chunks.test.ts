/// <reference types="bun" />
import { expect, test } from "bun:test";
import { CHUNKS } from "./chunk-grid";
import { road_junctions, road_layers, type RoadTones } from "./road-layers";
import { Roads } from "./roads";
import { sample } from "./field";
import { hash } from "./noise";
import { N, SIDEWALK, SPUR_HALF, STREET_HALF, type RoadGraph, type RoadPoint } from "./types";

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

const SPUR = 40;
const TONES = { asphalt: [0, 0, 0], sidewalk: [0, 0, 1], line: [0, 1, 0], edge_line: [1, 0, 0] } satisfies RoadTones;

// A spur meeting the ring fixture head-on at its point 0, the way `Router` brings every spur in along the ring normal.
function junction_surface() {
  const heights = bumpy();
  const road = ring();
  const at = road[0];
  const spur: RoadPoint[] = Array.from({ length: SPUR }, (_, i) => ({ x: at.x + (SPUR - 1 - i) * STEP, y: 0, z: at.z, tx: -1, tz: 0 }));
  const graph: RoadGraph = {
    nodes: [
      { id: 0, x: at.x, z: at.z, y: 0, kind: "junction" },
      { id: 1, x: spur[0].x, z: spur[0].z, y: 0, kind: "end" },
    ],
    edges: [
      { id: 0, a: 0, b: 0, kind: "highway", half: HALF, closed: true, points: road },
      { id: 1, a: 1, b: 0, kind: "highway", half: SPUR_HALF, closed: false, points: spur },
    ],
  };
  const roads = road_layers({ road, graph, circuit: [0] }, heights, TONES);
  const positions = Float32Array.from(roads.surface.flatMap((layer) => layer.positions));
  return { at, positions, patched: road_junctions({ road, graph, circuit: [0] }).patched.length };
}

function inside(p: Float32Array, t: number, x: number, z: number): boolean {
  const o = t * 9;
  const side = (a: number, b: number) => (p[o + b * 3] - p[o + a * 3]) * (z - p[o + a * 3 + 2]) - (p[o + b * 3 + 2] - p[o + a * 3 + 2]) * (x - p[o + a * 3]);
  const s0 = side(0, 1);
  const s1 = side(1, 2);
  const s2 = side(2, 0);
  return (s0 >= 0 && s1 >= 0 && s2 >= 0) || (s0 <= 0 && s1 <= 0 && s2 <= 0);
}

function near(p: Float32Array, x: number, z: number, reach: number): number[] {
  const out: number[] = [];
  for (let t = 0; t < p.length / 9; t++) if (Math.hypot(p[t * 9] - x, p[t * 9 + 2] - z) < reach) out.push(t);
  return out;
}

test("a spur meets the ring through one patch: no edge is open with asphalt on both sides of it", () => {
  const { at, positions: p, patched } = junction_surface();
  expect(patched).toBe(1);
  const tris = near(p, at.x, at.z, 40);
  const key = (v: number) => `${p[v * 3]},${p[v * 3 + 1]},${p[v * 3 + 2]}`;
  const uses = new Map<string, { a: number; b: number; count: number }>();
  for (const t of tris)
    for (let e = 0; e < 3; e++) {
      const a = t * 3 + e;
      const b = t * 3 + ((e + 1) % 3);
      const id = [key(a), key(b)].sort().join("|");
      const edge = uses.get(id);
      if (edge) edge.count++;
      else uses.set(id, { a, b, count: 1 });
    }
  const covered = (x: number, z: number) => tris.some((t) => inside(p, t, x, z));
  let cracks = 0;
  for (const { a, b, count } of uses.values()) {
    if (count !== 1) continue;
    const mx = (p[a * 3] + p[b * 3]) / 2;
    const mz = (p[a * 3 + 2] + p[b * 3 + 2]) / 2;
    if (Math.hypot(mx - at.x, mz - at.z) > 30) continue;
    const len = Math.hypot(p[b * 3] - p[a * 3], p[b * 3 + 2] - p[a * 3 + 2]) || 1;
    const nx = (-(p[b * 3 + 2] - p[a * 3 + 2]) / len) * 0.01;
    const nz = ((p[b * 3] - p[a * 3]) / len) * 0.01;
    if (covered(mx + nx, mz + nz) && covered(mx - nx, mz - nz)) cracks++;
  }
  expect(cracks).toBe(0);
});

test("a junction patch and the strips it trims face up and never overlap", () => {
  const { at, positions: p } = junction_surface();
  const tris = near(p, at.x, at.z, 40);
  for (const t of tris) {
    const o = t * 9;
    expect((p[o + 5] - p[o + 2]) * (p[o + 6] - p[o]) - (p[o + 3] - p[o]) * (p[o + 8] - p[o + 2])).toBeGreaterThanOrEqual(-1e-6);
  }
  let worst = 0;
  for (let i = -60; i <= 60; i++)
    for (let j = -60; j <= 60; j++) {
      const x = at.x + i * 0.4137 + 0.0731;
      const z = at.z + j * 0.4093 + 0.0419;
      worst = Math.max(worst, tris.filter((t) => inside(p, t, x, z)).length);
    }
  expect(worst).toBe(1);
});

const ARM = 30;
const SIDE_CLEAR = 9;

// Four town streets meeting square on the flat side of the fixture, each from the crossing outward.
function town_crossroads(arms: number) {
  const heights = bumpy();
  const at = { x: -12.3, z: 4.1 };
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ].slice(0, arms);
  const graph: RoadGraph = { nodes: [{ id: 0, x: at.x, z: at.z, y: 0, kind: "junction" }], edges: [] };
  dirs.forEach(([tx, tz], e) => {
    const points = Array.from({ length: ARM + 1 }, (_, k) => ({ x: at.x + tx * k * STEP, y: 0, z: at.z + tz * k * STEP, tx, tz }));
    graph.nodes.push({ id: e + 1, x: points[ARM].x, z: points[ARM].z, y: 0, kind: "end" });
    graph.edges.push({ id: e, a: 0, b: e + 1, kind: "street", half: STREET_HALF, closed: false, points });
  });
  // The circuit sits far off: no spur reaches this node, so only the street corners can patch it.
  const road = ring().map((p) => ({ ...p, x: p.x + 400 }));
  const roads = road_layers({ road, graph, circuit: [] }, heights, TONES);
  const positions = Float32Array.from(roads.surface.flatMap((layer) => layer.positions));
  return { at, positions, junctions: road_junctions({ road, graph, circuit: [] }) };
}

// Asphalt or sidewalk where a real corner has it: either street's band, or the corner square outside its curb's sidewalk.
function paved(dx: number, dz: number, arms: number): boolean {
  const reach = STREET_HALF + SIDEWALK;
  const ax = Math.abs(dx);
  const az = Math.abs(dz);
  const on_x = Math.abs(dz) <= reach && (dx >= -reach || arms > 2);
  const on_z = Math.abs(dx) <= reach && (dz >= -reach || arms > 3);
  if (on_x || on_z) return true;
  const quadrant = (dx > 0 || arms > 2) && (dz > 0 || arms > 3);
  return quadrant && ax < SIDE_CLEAR && az < SIDE_CLEAR && Math.hypot(ax - SIDE_CLEAR, az - SIDE_CLEAR) > SIDE_CLEAR - reach;
}

for (const arms of [2, 3, 4])
  test(`a town ${["L", "T", "crossroads"][arms - 2]} gets curbed corners: faces up, no overlap, sidewalk round every corner without a gap`, () => {
    const { at, positions: p, junctions } = town_crossroads(arms);
    expect(junctions.patched.length).toBe(1);
    expect(junctions.patched[0].patch.minor).toEqual([]);
    // An L's outside corner stays square, with its own sidewalk round it.
    expect(junctions.patched[0].patch.curbs.length).toBe(arms === 3 ? 2 : arms);
    const tris = near(p, at.x, at.z, 30);
    for (const t of tris) {
      const o = t * 9;
      expect((p[o + 5] - p[o + 2]) * (p[o + 6] - p[o]) - (p[o + 3] - p[o]) * (p[o + 8] - p[o + 2])).toBeGreaterThanOrEqual(-1e-6);
    }
    let worst = 0;
    let wrong = 0;
    for (let i = -50; i <= 50; i++)
      for (let j = -50; j <= 50; j++) {
        const dx = i * 0.3137 + 0.0131;
        const dz = j * 0.3093 + 0.0219;
        const count = tris.filter((t) => inside(p, t, at.x + dx, at.z + dz)).length;
        worst = Math.max(worst, count);
        // Facets of the 4° fillet steps sit up to a few centimetres off the true circle.
        const fuzzy = [-0.06, 0.06].some((e) => paved(dx + e, dz + e, arms) !== paved(dx - e, dz - e, arms));
        if (!fuzzy && Math.abs(dx) < 14 && Math.abs(dz) < 14 && (count > 0) !== paved(dx, dz, arms)) wrong++;
      }
    expect(worst).toBe(1);
    expect(wrong).toBe(0);
  });

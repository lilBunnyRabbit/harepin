/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { extent } from "./chunk-grid";
import { MAINLAND_SIZE, plan_mainland } from "./mainland";
import { Roads } from "./roads";
import { KERB_OUT, ring_mouths, road_junctions, road_layers, roadside_clear } from "./road-layers";
import { ROAD_HALF, STREET_HALF } from "./types";

const POST_OFF = ROAD_HALF + 1.6;
// Room qa7ml: the circuit kinks where a road between towns meets a town's street, and the kerb folded over it there.
const KINKED = 3516535473;

function inside(outline: readonly { x: number; z: number }[], x: number, z: number): boolean {
  let hit = false;
  for (let a = 0, b = outline.length - 1; a < outline.length; b = a++) {
    const p = outline[a];
    const q = outline[b];
    if (p.z > z !== q.z > z && x < ((q.x - p.x) * (z - p.z)) / (q.z - p.z) + p.x) hit = !hit;
  }
  return hit;
}

// The mainland circuit drives about half its edges from b to a.
for (const seed of [...sweep(3), KINKED])
  test(`mainland ${seed}: the circuit's asphalt stops only under a junction patch, and no curb or post stands in one or folds back`, () => {
    const { data } = plan_mainland(seed);
    const junctions = road_junctions(data);
    const outlines = junctions.patched.map((j) => j.patch.outline);
    const covered = (x: number, z: number) => outlines.some((o) => inside(o, x, z));
    const { road } = data;
    const n = road.length;
    expect([...junctions.ring_at.values()].some((span) => !span.forward)).toBe(true);
    ring_mouths(data, junctions).forEach((v, s) => {
      if (!v) return;
      const a = road[s];
      const b = road[(s + 1) % n];
      expect(covered((a.x + b.x) / 2, (a.z + b.z) / 2)).toBe(true);
    });
    const clear = roadside_clear(data, junctions);
    road.forEach((p, s) => {
      if (clear.has(s)) return;
      for (const off of [-POST_OFF, -KERB_OUT, 0, KERB_OUT, POST_OFF]) expect(covered(p.x - p.tz * off, p.z + p.tx * off)).toBe(false);
      const q = road[(s + 1) % n];
      if (clear.has((s + 1) % n)) return;
      for (const off of [-KERB_OUT, KERB_OUT]) {
        const ahead = (q.x - q.tz * off - (p.x - p.tz * off)) * p.tx + (q.z + q.tx * off - (p.z + p.tx * off)) * p.tz;
        expect(ahead).toBeGreaterThan(0);
      }
    });
  });

const reach = ({ x, z, patch }: { x: number; z: number; patch: { outline: readonly { x: number; z: number }[] } }) => Math.max(...patch.outline.map((q) => Math.hypot(q.x - x, q.z - z)));

function area(outline: readonly { x: number; z: number }[]): number {
  let twice = 0;
  for (let a = 0, b = outline.length - 1; a < outline.length; b = a++) twice += outline[b].x * outline[a].z - outline[a].x * outline[b].z;
  return Math.abs(twice / 2);
}

// A town's corners are 4-6 m curbs: a circuit crossing in town took the highway's 8 m fillet and spread its patch to 0.9.
const TOWN_PATCH_SHARE = 0.65;
const RING_RANK = 2;

for (const seed of [...sweep(3), KINKED])
  test(`mainland ${seed}: a town crossing's patch stays small next to its roads' widths, and no two patches overlap`, () => {
    const { patched } = road_junctions(plan_mainland(seed).data);
    for (const j of patched) {
      if (!j.arms.every((arm) => arm.half === STREET_HALF || arm.rank === RING_RANK)) continue;
      const widths = j.arms.reduce((sum, arm) => sum + 2 * arm.clear, 0);
      expect(area(j.patch.outline)).toBeLessThanOrEqual(TOWN_PATCH_SHARE * widths * widths);
    }
    for (const a of patched)
      for (const b of patched) {
        if (a === b || Math.hypot(a.x - b.x, a.z - b.z) > reach(a) + reach(b)) continue;
        expect(a.patch.outline.some((q) => inside(b.patch.outline, q.x, q.z))).toBe(false);
      }
  });

// Shallowest angle two roads may leave one node at: under it no patch fits and the roads lie over each other.
const SHALLOWEST = (35 * Math.PI) / 180;
// Marks a patch keeps of its own (corner edge lines, give-way dashes) hug its rim; anything deeper crosses the junction.
const RIM_BAND = 1;
const KERB_CELL = 8;
const FLAT = { vertex: () => 0, height: () => 0 };
const TONES = { asphalt: [0, 0, 0], sidewalk: [0, 0, 1], line: [1, 0, 0], edge_line: [0, 1, 0] } satisfies Record<string, [number, number, number]>;

function crosses(a: { x: number; z: number }, b: { x: number; z: number }, c: { x: number; z: number }, d: { x: number; z: number }): boolean {
  const side = (p: typeof a, q: typeof a, r: typeof a) => Math.sign((q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

function rim_distance(outline: readonly { x: number; z: number }[], x: number, z: number): number {
  let best = Infinity;
  for (let a = 0, b = outline.length - 1; a < outline.length; b = a++) {
    const p = outline[b];
    const q = outline[a];
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (z - p.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(p.x + dx * t - x, p.z + dz * t - z));
  }
  return best;
}

for (const seed of [...sweep(3), KINKED])
  test(`mainland ${seed}: roads meet square, each patch rim is simple, and no kerb or marking crosses another road`, () => {
    const { data } = plan_mainland(seed);
    const { graph } = data;
    for (const node of graph.nodes) {
      const ways = graph.edges.flatMap((e) => {
        const n = e.points.length;
        return [...(e.a === node.id ? [Math.atan2(e.points[1].z - e.points[0].z, e.points[1].x - e.points[0].x)] : []), ...(e.b === node.id ? [Math.atan2(e.points[n - 2].z - e.points[n - 1].z, e.points[n - 2].x - e.points[n - 1].x)] : [])];
      });
      for (let a = 0; a < ways.length; a++)
        for (let b = a + 1; b < ways.length; b++) {
          const gap = Math.abs(ways[a] - ways[b]);
          expect(Math.min(gap, 2 * Math.PI - gap)).toBeGreaterThanOrEqual(SHALLOWEST);
        }
    }

    const junctions = road_junctions(data);
    for (const { patch } of junctions.patched) {
      const o = patch.outline;
      for (let a = 0; a < o.length; a++)
        for (let b = a + 2; b < o.length; b++) {
          if (a === 0 && b === o.length - 1) continue;
          expect(crosses(o[a], o[a + 1], o[b], o[(b + 1) % o.length])).toBe(false);
        }
    }

    const cells = new Map<string, { x: number; z: number; half: number }[]>();
    const cell = (x: number, z: number) => `${Math.floor(x / KERB_CELL)},${Math.floor(z / KERB_CELL)}`;
    for (const e of graph.edges.filter((e) => !junctions.ring_at.has(e.id)))
      for (const q of e.points) cells.set(cell(q.x, q.z), [...(cells.get(cell(q.x, q.z)) ?? []), { x: q.x, z: q.z, half: e.half }]);
    const clear = roadside_clear(data, junctions);
    let kerbed = 0;
    data.road.forEach((p, s) => {
      if (clear.has(s)) return;
      for (const off of [-KERB_OUT, KERB_OUT]) {
        const x = p.x - p.tz * off;
        const z = p.z + p.tx * off;
        for (let i = -1; i <= 1; i++)
          for (let j = -1; j <= 1; j++) for (const q of cells.get(cell(x + i * KERB_CELL, z + j * KERB_CELL)) ?? []) if (Math.hypot(q.x - x, q.z - z) < q.half - 0.5) kerbed++;
      }
    });
    expect(kerbed).toBe(0);

    const roads = road_layers(data, new Roads(FLAT, extent(MAINLAND_SIZE)), TONES, junctions);
    const boxes = junctions.patched.map(({ patch }) => {
      const xs = patch.outline.map((q) => q.x);
      const zs = patch.outline.map((q) => q.z);
      return { outline: patch.outline, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    });
    let crossing = 0;
    for (const { positions } of roads.marks)
      for (let t = 0; t < positions.length; t += 9) {
        const x = (positions[t] + positions[t + 3] + positions[t + 6]) / 3;
        const z = (positions[t + 2] + positions[t + 5] + positions[t + 8]) / 3;
        for (const b of boxes) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && inside(b.outline, x, z) && rim_distance(b.outline, x, z) > RIM_BAND) crossing++;
      }
    expect(crossing).toBe(0);
  }, 60_000);

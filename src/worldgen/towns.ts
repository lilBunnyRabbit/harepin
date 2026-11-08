import { mulberry32, sub } from "../rng";
import { sample } from "./field";
import { length } from "./noise";
import { STREET_HALF, ROAD_HALF, type RoadEdge, type RoadNode, type RoadPoint, type Town } from "./types";

const TOWN_MIN = 3;
const TOWN_MAX = 6;
const TOWN_TRIES = 900;
const TOWN_SPREAD = 820;
const TOWN_GAP = 140;
const RING_CLEAR = 30;
const RING_REACH = 260;
const TOWN_RELIEF = 18;
const BLOCK_MIN = 45;
const BLOCK_SPAN = 25;
const STREET_GRADE = 0.14;
const STREET_RING_CLEAR = ROAD_HALF + STREET_HALF + 14;
const STEP = 2;

const SYLLABLES = ["har", "pin", "bun", "lop", "dell", "war", "ren", "burr", "ow", "clo", "ver", "thim", "ble", "fen", "brook", "hol", "low", "mead"];

function town_name(next: () => number): string {
  const count = 2 + Math.floor(next() * 2);
  let name = "";
  for (let i = 0; i < count; i++) name += SYLLABLES[Math.floor(next() * SYLLABLES.length)];
  return name[0].toUpperCase() + name.slice(1);
}

export function ring_distance(road: RoadPoint[], x: number, z: number): number {
  let best = Infinity;
  for (const p of road) best = Math.min(best, (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z));
  return Math.sqrt(best);
}

export function place_towns(seed: number, heights: Float32Array, road: RoadPoint[]): Town[] {
  const next = mulberry32(sub(seed, "towns"));
  const target = TOWN_MIN + Math.floor(next() * (TOWN_MAX - TOWN_MIN + 1));
  const towns: Town[] = [];
  for (let attempt = 0; attempt < TOWN_TRIES && towns.length < target; attempt++) {
    const x = (next() * 2 - 1) * TOWN_SPREAD;
    const z = (next() * 2 - 1) * TOWN_SPREAD;
    const radius = 90 + next() * 50;
    let ux = next() - 0.5;
    let uz = next() - 0.5;
    if (x * x + z * z > TOWN_SPREAD * TOWN_SPREAD || ux * ux + uz * uz < 0.01) continue;
    const h = sample(heights, x, z);
    if (h < 5 || h > 60) continue;
    let low = h;
    let high = h;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        const y = sample(heights, x + a * radius * 0.7, z + b * radius * 0.7);
        low = Math.min(low, y);
        high = Math.max(high, y);
      }
    if (high - low > TOWN_RELIEF || low < 3) continue;
    if (towns.some((t) => length(t.x - x, t.z - z) < t.radius + radius + TOWN_GAP)) continue;
    const ring = ring_distance(road, x, z);
    if (ring < radius + RING_CLEAR || ring > radius + RING_REACH) continue;
    const len = Math.sqrt(ux * ux + uz * uz);
    ux /= len;
    uz /= len;
    towns.push({ id: towns.length, x, z, radius, ux, uz, angle: Math.atan2(ux, uz), name: town_name(next) });
  }
  return towns;
}

export interface Streets {
  nodes: RoadNode[];
  edges: RoadEdge[];
  /** Node closest to the ring, where the highway spur starts. */
  gate: number;
}

export function town_streets(seed: number, town: Town, heights: Float32Array, road: RoadPoint[], first_node: number, first_edge: number): Streets | null {
  const next = mulberry32(sub(seed, `streets:${town.id}`));
  const block = BLOCK_MIN + next() * BLOCK_SPAN;
  const k = Math.ceil(town.radius / block);
  const vx = -town.uz;
  const vz = town.ux;
  const slot = new Map<number, number>();
  const nodes: RoadNode[] = [];
  const key = (i: number, j: number) => (i + 64) * 128 + (j + 64);
  for (let i = -k; i <= k; i++)
    for (let j = -k; j <= k; j++) {
      const x = town.x + town.ux * i * block + vx * j * block;
      const z = town.z + town.uz * i * block + vz * j * block;
      if (length(x - town.x, z - town.z) > town.radius) continue;
      const y = sample(heights, x, z);
      if (y < 3.5 || ring_distance(road, x, z) < STREET_RING_CLEAR) continue;
      slot.set(key(i, j), nodes.length);
      nodes.push({ id: 0, x, z, y, kind: "junction" });
    }
  const links: [number, number][] = [];
  for (let i = -k; i <= k; i++)
    for (let j = -k; j <= k; j++) {
      const a = slot.get(key(i, j));
      if (a === undefined) continue;
      for (const [di, dj] of [
        [1, 0],
        [0, 1],
      ]) {
        const b = slot.get(key(i + di, j + dj));
        if (b === undefined) continue;
        const na = nodes[a];
        const nb = nodes[b];
        if (Math.abs(na.y - nb.y) / block > STREET_GRADE) continue;
        if (ring_distance(road, (na.x + nb.x) / 2, (na.z + nb.z) / 2) < STREET_RING_CLEAR) continue;
        links.push([a, b]);
      }
    }
  if (!links.length) return null;

  let centre = 0;
  nodes.forEach((n, i) => {
    if (length(n.x - town.x, n.z - town.z) < length(nodes[centre].x - town.x, nodes[centre].z - town.z)) centre = i;
  });
  const reached = new Set([centre]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [a, b] of links)
      if (reached.has(a) !== reached.has(b)) {
        reached.add(a);
        reached.add(b);
        grew = true;
      }
  }
  const kept = links.filter(([a]) => reached.has(a));
  if (!kept.length) return null;

  const remap = new Map<number, number>();
  const out_nodes: RoadNode[] = [];
  for (const i of [...reached].sort((a, b) => a - b)) {
    remap.set(i, first_node + out_nodes.length);
    out_nodes.push({ ...nodes[i], id: first_node + out_nodes.length });
  }
  const degree = new Map<number, number>();
  const edges: RoadEdge[] = kept.map(([a, b], e) => {
    const na = nodes[a];
    const nb = nodes[b];
    const ia = remap.get(a) ?? -1;
    const ib = remap.get(b) ?? -1;
    degree.set(ia, (degree.get(ia) ?? 0) + 1);
    degree.set(ib, (degree.get(ib) ?? 0) + 1);
    const len = length(nb.x - na.x, nb.z - na.z);
    const tx = (nb.x - na.x) / len;
    const tz = (nb.z - na.z) / len;
    const steps = Math.max(1, Math.round(len / STEP));
    const points: RoadPoint[] = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      points.push({ x: na.x + (nb.x - na.x) * t, y: na.y + (nb.y - na.y) * t, z: na.z + (nb.z - na.z) * t, tx, tz });
    }
    return { id: first_edge + e, a: ia, b: ib, kind: "street", half: STREET_HALF, closed: false, points };
  });
  for (const node of out_nodes) {
    const d = degree.get(node.id) ?? 0;
    node.kind = d <= 1 ? "end" : "junction";
  }
  const centre_id = remap.get(centre) ?? first_node;
  out_nodes[centre_id - first_node].kind = "town";

  let gate = out_nodes[0].id;
  let gate_ring = Infinity;
  for (const node of out_nodes) {
    const d = ring_distance(road, node.x, node.z);
    if (d < gate_ring) {
      gate_ring = d;
      gate = node.id;
    }
  }
  return { nodes: out_nodes, edges, gate };
}

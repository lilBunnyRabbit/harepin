import { mulberry32, sub } from "../rng";
import { sample } from "./field";
import { length } from "./noise";
import { ISLAND, type TownRecipe } from "./recipe";
import type { Sampler } from "./route";
import { STREET_HALF, ROAD_HALF, type RoadEdge, type RoadNode, type RoadPoint, type Town } from "./types";

const TOWN_TRIES = 900;
const TOWN_SPREAD = 820;
const TOWN_GAP = 140;
const RING_CLEAR = 30;
const RING_REACH = 260;
const TOWN_RELIEF = 18;
const TOWN_GRADE = 0.05;
const TOWN_FLOOR = 4;
export const CORE = 1.15;
const STREET_RING_CLEAR = ROAD_HALF + STREET_HALF + 14;
const STEP = 2;
/** A strip village's main street follows the contour where the ground climbs at least this across it; flatter keeps the seeded axis. */
const CONTOUR_SLOPE = 0.02;
const CONTOUR_PROBE = 20;
/** A strip village's plateau reaches this far past its lanes, across the street, for the lots behind them. */
const STRIP_BACK = 6;
/** Deepest cut or fill a strip's plateau may need against the best plane it can tilt to. */
const STRIP_GAP = 12;

const SYLLABLES = ["har", "pin", "bun", "lop", "dell", "war", "ren", "burr", "ow", "clo", "ver", "thim", "ble", "fen", "brook", "hol", "low", "mead"];

export function town_name(next: () => number): string {
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

// Along the level line through (x, z), so a strip village's main street stays flat on a valley side.
function contour(heights: Float32Array, x: number, z: number, ux: number, uz: number): [number, number] {
  const gx = sample(heights, x + CONTOUR_PROBE, z) - sample(heights, x - CONTOUR_PROBE, z);
  const gz = sample(heights, x, z + CONTOUR_PROBE) - sample(heights, x, z - CONTOUR_PROBE);
  return length(gx, gz) < CONTOUR_SLOPE * 2 * CONTOUR_PROBE ? [ux, uz] : [-gz, gx];
}

function box_relief(heights: Float32Array, x: number, z: number, radius: number): { low: number; high: number } {
  let low = Infinity;
  let high = -Infinity;
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++) {
      const y = sample(heights, x + a * radius * 0.7, z + b * radius * 0.7);
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
  return { low, high };
}

/** Widest band a strip village of this recipe can level either side of its street. */
function strip_band(shape: TownRecipe): number {
  return shape.block.min + shape.block.span + STRIP_BACK;
}

/** Ground points over a strip's whole plateau: its core along the street, `band` either side across it. */
function strip_lattice(height: Sampler, x: number, z: number, core: number, ax: number, az: number, band: number): Ground[] {
  const out: Ground[] = [];
  for (let a = -4; a <= 4; a++)
    for (let b = -2; b <= 2; b++) {
      const across = (b / 2) * band;
      const along = (a / 4) * Math.sqrt(Math.max(0, core * core - across * across));
      const px = x + ax * along - az * across;
      const pz = z + az * along + ax * across;
      out.push({ x: px, z: pz, y: height(px, pz) });
    }
  return out;
}

// The deepest cut or fill the plane a strip would tilt to needs anywhere on its plateau.
function strip_gap(heights: Float32Array, x: number, z: number, radius: number, ux: number, uz: number, band: number): number {
  const len = length(ux, uz);
  const core = radius * CORE;
  const lattice = strip_lattice((px, pz) => sample(heights, px, pz), x, z, core, ux / len, uz / len, band);
  const plane: Plane = { x, z, core, y: 0, gx: 0, gz: 0 };
  fit_plane(lattice, plane);
  let gap = 0;
  for (const p of lattice) gap = Math.max(gap, Math.abs(p.y - town_level(plane, p.x, p.z)));
  return gap;
}

/** True when a point lies on the town's levelled core: inside `core` and, for a strip village, within `band` of its street. */
export function on_core(town: Town, x: number, z: number): boolean {
  if (length(x - town.x, z - town.z) > town.core) return false;
  return town.band === undefined || Math.abs((x - town.x) * town.uz - (z - town.z) * town.ux) <= town.band;
}

export function place_towns(seed: number, heights: Float32Array, road: RoadPoint[], shape: TownRecipe = ISLAND.towns): Town[] {
  const next = mulberry32(sub(seed, "towns"));
  const target = shape.min + Math.floor(next() * (shape.max - shape.min + 1));
  const towns: Town[] = [];
  for (let attempt = 0; attempt < TOWN_TRIES && towns.length < target; attempt++) {
    const x = (next() * 2 - 1) * TOWN_SPREAD;
    const z = (next() * 2 - 1) * TOWN_SPREAD;
    const radius = 90 + next() * 50;
    let ux = next() - 0.5;
    let uz = next() - 0.5;
    if (x * x + z * z > TOWN_SPREAD * TOWN_SPREAD || ux * ux + uz * uz < 0.01) continue;
    const h = sample(heights, x, z);
    if (h < 5 || h > shape.top) continue;
    if (shape.layout === "strip") [ux, uz] = contour(heights, x, z, ux, uz);
    if (shape.layout === "strip") {
      if (strip_gap(heights, x, z, radius, ux, uz, strip_band(shape)) > STRIP_GAP) continue;
    } else {
      const { low, high } = box_relief(heights, x, z, radius);
      if (high - low > TOWN_RELIEF || low < 3) continue;
    }
    if (towns.some((t) => length(t.x - x, t.z - z) < t.radius + radius + TOWN_GAP)) continue;
    const ring = ring_distance(road, x, z);
    if (ring < radius + RING_CLEAR || ring > radius + RING_REACH) continue;
    const len = Math.sqrt(ux * ux + uz * uz);
    ux /= len;
    uz /= len;
    towns.push({ id: towns.length, x, z, radius, ux, uz, angle: Math.atan2(ux, uz), name: town_name(next), y: h, gx: 0, gz: 0, core: radius * CORE, block: shape.block.min });
  }
  return towns;
}

interface Ground {
  x: number;
  z: number;
  y: number;
}

type Plane = Pick<Town, "x" | "z" | "core" | "y" | "gx" | "gz">;

export function town_level(town: Plane, x: number, z: number): number {
  return town.y + town.gx * (x - town.x) + town.gz * (z - town.z);
}

// The whole town sits on one least-squares plane through its street nodes, tilted at most TOWN_GRADE: every crossing
// agrees on its height and every lot on a block shares the ground, so pads never fight each other.
function fit_plane(nodes: readonly Ground[], town: Plane) {
  let sxx = 0, sxz = 0, szz = 0, sx = 0, sz = 0, sy = 0, sxy = 0, szy = 0;
  for (const n of nodes) {
    const x = n.x - town.x;
    const z = n.z - town.z;
    sxx += x * x;
    sxz += x * z;
    szz += z * z;
    sx += x;
    sz += z;
    sy += n.y;
    sxy += x * n.y;
    szy += z * n.y;
  }
  const count = nodes.length;
  const cxx = sxx - (sx * sx) / count;
  const cxz = sxz - (sx * sz) / count;
  const czz = szz - (sz * sz) / count;
  const cxy = sxy - (sx * sy) / count;
  const czy = szy - (sz * sy) / count;
  const det = cxx * czz - cxz * cxz;
  let gx = det > 1e-6 ? (cxy * czz - czy * cxz) / det : 0;
  let gz = det > 1e-6 ? (czy * cxx - cxy * cxz) / det : 0;
  const grade = length(gx, gz);
  if (grade > TOWN_GRADE) {
    gx *= TOWN_GRADE / grade;
    gz *= TOWN_GRADE / grade;
  }
  const y = sy / count - gx * (sx / count) - gz * (sz / count);
  town.gx = gx;
  town.gz = gz;
  town.y = Math.max(y, TOWN_FLOOR + length(gx, gz) * town.core);
}

export interface Streets {
  nodes: RoadNode[];
  edges: RoadEdge[];
  /** Node closest to the ring, where the highway spur starts. */
  gate: number;
}

export function town_streets(seed: number, town: Town, height: Sampler, road: RoadPoint[], first_node: number, first_edge: number, shape: TownRecipe = ISLAND.towns): Streets | null {
  const next = mulberry32(sub(seed, `streets:${town.id}`));
  const block = shape.block.min + next() * shape.block.span;
  town.block = block;
  if (shape.layout === "strip") town.band = block + STRIP_BACK;
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
      if (shape.layout === "strip" && j !== 0 && (i !== 0 || Math.abs(j) > 1)) continue;
      const y = height(x, z);
      if (y < 3.5 || ring_distance(road, x, z) < STREET_RING_CLEAR) continue;
      slot.set(key(i, j), nodes.length);
      nodes.push({ id: 0, x, z, y, kind: "junction" });
    }
  if (nodes.length < 3) return null;
  // A strip's plane fits the ground its plateau levels, the one its site was checked against, not just its few nodes.
  fit_plane(town.band === undefined ? nodes : strip_lattice(height, town.x, town.z, town.core, town.ux, town.uz, town.band), town);
  for (const n of nodes) n.y = town_level(town, n.x, n.z);
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

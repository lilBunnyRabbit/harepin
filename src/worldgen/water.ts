import { Heap } from "./heap";
import { smoothstep } from "./noise";
import type { PlanGrid } from "./plan-grid";
import type { WaterRecipe } from "./recipe";
import type { RoadEdge, Town } from "./types";

/** Water stands this far under the lowest ground across the channel, so a river sits in its banks instead of brimming. */
const DROP = 0.6;
/**
 * Deepest a channel may cut through a rise to keep its surface flowing downhill. A river that would cut deeper (out of a
 * basin that did not become a lake) rises below that rise instead, so it never stands as a slab over the basin floor.
 */
export const MAX_CUT = 10;
/** A river's channel shorter than this, metres, is dropped. */
const RIVER_LENGTH = 500;
/** Metres of water over a ford's road surface: a wade, never a reset. */
export const FORD_DEPTH = 0.3;
const FORD_APRON = 6;
/** Where a road runs beside a river without crossing it, the water stays this far under the road. */
const ROAD_DRY = 0.4;
const STEP = 6;
const TOWN_CLEAR = 60;
const RIVER_MIN = 16;
/**
 * Past the channel the ground is lowered by its height over the water, at most BANK_CUT, easing out over FLAT +
 * `BANK_RUN` metres per metre lowered: the road banks' rule, so a deep cut opens out instead of standing as a wall, and
 * a valley wall far above the river is only trimmed at its foot. BANK_CUT covers the deepest cut a river makes.
 */
const BANK_FLAT = 2;
const BANK_RUN = 4;
const BANK_CUT = 12;
const BANK_CAP = BANK_FLAT + BANK_CUT * BANK_RUN;
/** Ground up to this far over the water reads as wet shore. */
export const WET_RISE = 0.6;
export const SEA_LEVEL = 0;
const BUCKET = 32;
const NONE = -Infinity;

export interface RiverPoint {
  x: number;
  z: number;
  level: number;
  half: number;
  depth: number;
}

/** Planned water on a world's plan grid: filled basins and river channels, replayed per tile and read at runtime. */
export interface Water {
  origin: number;
  cell: number;
  n: number;
  lake_of: Int16Array<ArrayBuffer>;
  lakes: number[];
  rivers: RiverPoint[][];
}

/** Priority flood from the sea and the map's rim: filled heights, the vertex each one drains to, and the order it filled. */
function flood(grid: PlanGrid) {
  const m = grid.n + 1;
  const h = grid.heights;
  const filled = new Float32Array(m * m);
  const parent = new Int32Array(m * m).fill(-1);
  const queued = new Uint8Array(m * m);
  const order = new Int32Array(m * m);
  const heap = new Heap();
  for (let k = 0; k < m * m; k++) {
    const i = k % m;
    const j = (k - i) / m;
    if (h[k] < 0 || i === 0 || j === 0 || i === m - 1 || j === m - 1) {
      filled[k] = h[k];
      queued[k] = 1;
      heap.push(k, h[k]);
    }
  }
  let count = 0;
  while (heap.size) {
    const v = heap.pop();
    order[count++] = v;
    const i = v % m;
    const j = (v - i) / m;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const a = i + di;
        const b = j + dj;
        if (a < 0 || b < 0 || a >= m || b >= m) continue;
        const u = b * m + a;
        if (queued[u]) continue;
        queued[u] = 1;
        filled[u] = Math.max(h[u], filled[v]);
        parent[u] = v;
        heap.push(u, filled[u]);
      }
  }
  const area = new Float32Array(m * m).fill(1);
  for (let idx = count - 1; idx >= 0; idx--) {
    const v = order[idx];
    if (parent[v] >= 0) area[parent[v]] += area[v];
  }
  return { filled, parent, area };
}

interface Segment {
  ax: number;
  az: number;
  ay: number;
  bx: number;
  bz: number;
  by: number;
  half: number;
}

const ROAD_BUCKET = 64;
const ROAD_PAD = 80;

/** Road segments binned on a coarse grid, so a river or lake point checks only the few near it. */
class Roads {
  private readonly bins = new Map<number, Segment[]>();

  constructor(edges: readonly RoadEdge[], private readonly pad: number) {
    for (const edge of edges) {
      const count = edge.closed ? edge.points.length : edge.points.length - 1;
      for (let s = 0; s < count; s++) {
        const a = edge.points[s];
        const b = edge.points[(s + 1) % edge.points.length];
        const seg = { ax: a.x, az: a.z, ay: a.y, bx: b.x, bz: b.z, by: b.y, half: edge.half };
        const r = edge.half + pad;
        for (let j = this.cell(Math.min(a.z, b.z) - r); j <= this.cell(Math.max(a.z, b.z) + r); j++)
          for (let i = this.cell(Math.min(a.x, b.x) - r); i <= this.cell(Math.max(a.x, b.x) + r); i++) {
            const key = i * 4096 + j;
            const bin = this.bins.get(key);
            if (bin) bin.push(seg);
            else this.bins.set(key, [seg]);
          }
      }
    }
  }

  private cell(v: number): number {
    return Math.floor(v / ROAD_BUCKET) + 2048;
  }

  /** Segments that may lie within the pad of (x, z). */
  near(x: number, z: number): readonly Segment[] {
    return this.bins.get(this.cell(x) * 4096 + this.cell(z)) ?? [];
  }

  /** Lowest road surface within `reach` of a road's side, or Infinity when no road is that close. */
  lowest(x: number, z: number, reach: number): number {
    if (reach > this.pad) throw new Error(`road reach ${reach} past the bins' pad ${this.pad}`);
    let low = Infinity;
    for (const s of this.near(x, z)) {
      const dx = s.bx - s.ax;
      const dz = s.bz - s.az;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz || 1)));
      const ox = x - (s.ax + dx * t);
      const oz = z - (s.az + dz * t);
      if (Math.sqrt(ox * ox + oz * oz) - s.half < reach) low = Math.min(low, s.ay + (s.by - s.ay) * t);
    }
    return low;
  }
}

function crosses(ax: number, az: number, bx: number, bz: number, s: Segment): number | null {
  const o = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  const d1 = o(ax, az, bx, bz, s.ax, s.az);
  const d2 = o(ax, az, bx, bz, s.bx, s.bz);
  const d3 = o(s.ax, s.az, s.bx, s.bz, ax, az);
  const d4 = o(s.ax, s.az, s.bx, s.bz, bx, bz);
  if (d1 * d2 >= 0 || d3 * d4 >= 0) return null;
  return d3 / (d3 - d4);
}

function near_town(towns: readonly Town[], x: number, z: number, clear: number): boolean {
  return towns.some((t) => (t.x - x) * (t.x - x) + (t.z - z) * (t.z - z) < (t.radius + clear) * (t.radius + clear));
}

function soften(path: RiverPoint[]): RiverPoint[] {
  const mix = (a: RiverPoint, b: RiverPoint, w: number): RiverPoint => ({
    x: a.x + (b.x - a.x) * w,
    z: a.z + (b.z - a.z) * w,
    level: a.level + (b.level - a.level) * w,
    half: a.half + (b.half - a.half) * w,
    depth: a.depth + (b.depth - a.depth) * w,
  });
  const out = [path[0]];
  for (let i = 0; i < path.length - 1; i++) out.push(mix(path[i], path[i + 1], 0.25), mix(path[i], path[i + 1], 0.75));
  out.push(path[path.length - 1]);
  return out;
}

function resample(path: RiverPoint[]): RiverPoint[] {
  const out: RiverPoint[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const steps = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dz * dz) / STEP));
    for (let s = 0; s < steps; s++) {
      const w = s / steps;
      out.push({ x: a.x + dx * w, z: a.z + dz * w, level: a.level + (b.level - a.level) * w, half: a.half + (b.half - a.half) * w, depth: a.depth + (b.depth - a.depth) * w });
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

// Fords: where a road crosses, the water stands FORD_DEPTH over the lowest road inside the channel, so an oblique or
// sloped crossing wades at its low side and stays dry up the slope; where a road only runs beside the channel, the
// water stays under it. Either way no road lies in deep water.
function ford(river: RiverPoint[], roads: Roads) {
  const fords: { x: number; z: number; reach: number }[] = [];
  for (let i = 0; i < river.length - 1; i++) {
    const a = river[i];
    const b = river[i + 1];
    for (const s of roads.near(a.x, a.z)) {
      const t = crosses(a.x, a.z, b.x, b.z, s);
      if (t === null) continue;
      fords.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, reach: s.half + FORD_APRON + a.half });
    }
  }
  for (const p of river) {
    const low = roads.lowest(p.x, p.z, p.half + STEP);
    if (low === Infinity) continue;
    const crossing = fords.some((f) => (f.x - p.x) * (f.x - p.x) + (f.z - p.z) * (f.z - p.z) < f.reach * f.reach);
    p.level = crossing ? low + FORD_DEPTH : Math.min(p.level, low - ROAD_DRY);
  }
}

function downhill(river: RiverPoint[]) {
  for (let i = 1; i < river.length; i++) river[i].level = Math.min(river[i].level, river[i - 1].level);
}

/** Lowest land across the channel at a point: its centre and both banks, before any carving. */
function floor(p: RiverPoint, next: RiverPoint, height: (x: number, z: number) => number): number {
  const dx = next.x - p.x;
  const dz = next.z - p.z;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  const nx = (-dz / len) * p.half;
  const nz = (dx / len) * p.half;
  let low = height(p.x, p.z);
  for (const w of [-1, -0.5, 0.5, 1]) low = Math.min(low, height(p.x + nx * w, p.z + nz * w));
  return low;
}

// The surface follows the lowest land across the channel, never rising downstream. Where that would mean cutting more
// than MAX_CUT through a rise, the river starts below the rise; null when what is left is too short.
function channel(river: RiverPoint[], height: (x: number, z: number) => number): RiverPoint[] | null {
  const ground = river.map((p, i) => Math.max(0, floor(p, river[i + 1] ?? river[i - 1], height) - DROP));
  let from = 0;
  for (;;) {
    let level = Infinity;
    let cut = -1;
    for (let i = from; i < river.length; i++) {
      level = Math.min(level, ground[i]);
      river[i].level = level;
      if (ground[i] - level > MAX_CUT) cut = i;
    }
    if (cut < 0) break;
    from = cut + 1;
  }
  const kept = river.slice(from);
  let length = 0;
  for (let i = 1; i < kept.length; i++) {
    const dx = kept[i].x - kept[i - 1].x;
    const dz = kept[i].z - kept[i - 1].z;
    length += Math.sqrt(dx * dx + dz * dz);
  }
  return length < RIVER_LENGTH ? null : kept;
}

/** Plans lakes in the plan grid's basins and rivers down its biggest drainage paths, clear of towns and roads' decks. */
export function plan_water(grid: PlanGrid, shape: WaterRecipe, edges: readonly RoadEdge[], towns: readonly Town[], height: (x: number, z: number) => number): Water {
  const m = grid.n + 1;
  const h = grid.heights;
  const { origin } = grid.ext;
  const { cell } = grid;
  const { filled, parent, area } = flood(grid);
  const roads = new Roads(edges, ROAD_PAD);
  const px = (k: number) => origin + (k % m) * cell;
  const pz = (k: number) => origin + Math.floor(k / m) * cell;

  const lake_of = new Int16Array(m * m).fill(-1);
  const lakes: number[] = [];
  const seen = new Uint8Array(m * m);
  for (let k = 0; k < m * m && lakes.length < shape.lakes.count; k++) {
    if (seen[k] || filled[k] - h[k] <= 0 || h[k] < 0) continue;
    const members: number[] = [];
    const stack = [k];
    seen[k] = 1;
    let deepest = 0;
    while (stack.length) {
      const v = stack.pop() as number;
      members.push(v);
      deepest = Math.max(deepest, filled[v] - h[v]);
      const i = v % m;
      const j = (v - i) / m;
      for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
        if (a < 0 || b < 0 || a >= m || b >= m) continue;
        const u = b * m + a;
        if (seen[u] || filled[u] - h[u] <= 0) continue;
        seen[u] = 1;
        stack.push(u);
      }
    }
    if (deepest < shape.lakes.depth || members.length < shape.lakes.min || members.length > shape.lakes.max) continue;
    const level = filled[k] - DROP;
    // A lake keeps one plan cell of rim: the fine ground between its vertices still meets the level there.
    const rim = cell * 2;
    if (members.some((v) => near_town(towns, px(v), pz(v), TOWN_CLEAR + rim) || roads.lowest(px(v), pz(v), rim + 8) < Infinity)) continue;
    const id = lakes.length;
    lakes.push(level);
    for (const v of members) {
      const i = v % m;
      const j = (v - i) / m;
      for (let b = Math.max(0, j - 1); b <= Math.min(m - 1, j + 1); b++)
        for (let a = Math.max(0, i - 1); a <= Math.min(m - 1, i + 1); a++) if (lake_of[b * m + a] < 0) lake_of[b * m + a] = id;
    }
  }

  const mouths: number[] = [];
  for (let k = 0; k < m * m; k++) if (h[k] >= 0 && parent[k] >= 0 && h[parent[k]] < 0 && area[k] >= shape.rivers.head) mouths.push(k);
  mouths.sort((a, b) => area[b] - area[a] || a - b);
  const children = new Int32Array(m * m).fill(-1);
  // Upstream step: the neighbour draining here with the most area above it, ties to the lower index.
  for (let k = 0; k < m * m; k++) {
    const p = parent[k];
    if (p < 0) continue;
    const c = children[p];
    if (c < 0 || area[k] > area[c]) children[p] = k;
  }
  const rivers: RiverPoint[][] = [];
  const taken = new Uint8Array(m * m);
  const top = shape.rivers.width;
  for (const mouth of mouths) {
    if (rivers.length >= shape.rivers.count) break;
    const stem: number[] = [parent[mouth], mouth];
    for (let v = children[mouth]; v >= 0 && area[v] >= shape.rivers.head; v = children[v]) {
      if (near_town(towns, px(v), pz(v), TOWN_CLEAR) || taken[v]) break;
      stem.push(v);
    }
    if (stem.length < RIVER_MIN) continue;
    for (const v of stem) taken[v] = 1;
    const peak = area[mouth];
    const path = stem.reverse().map((v): RiverPoint => {
      const share = Math.sqrt(Math.min(1, area[v] / peak));
      return { x: px(v), z: pz(v), level: 0, half: top[0] + (top[1] - top[0]) * share, depth: shape.rivers.depth[0] + (shape.rivers.depth[1] - shape.rivers.depth[0]) * share };
    });
    const river = channel(resample(soften(soften(path))), height);
    if (!river) continue;
    ford(river, roads);
    downhill(river);
    rivers.push(river);
  }
  return { origin, cell, n: grid.n, lake_of, lakes, rivers };
}

const INDEXES = new WeakMap<Water, WaterIndex>();

/** One index per plan, shared by every tile, the map and the sim. */
export function water_index(water: Water): WaterIndex {
  let index = INDEXES.get(water);
  if (!index) INDEXES.set(water, (index = new WaterIndex(water)));
  return index;
}

/** Cuts river channels into a tile's heights and lays the wet shore under and beside all water. */
export function soak(index: WaterIndex, heights: Float32Array, surface: Uint8Array, k: number, x: number, z: number, wet: number) {
  heights[k] = index.carve(x, z, heights[k]);
  if (heights[k] < index.level(x, z) + WET_RISE) surface[k] = wet;
}

/** Bucketed river segments over a Water, for point queries in tiles, maps and the sim; no allocation per query. */
export class WaterIndex {
  private readonly start: Int32Array;
  private readonly items: Int32Array;
  private readonly side: number;
  private readonly flat: RiverPoint[] = [];
  private readonly link: Uint8Array;
  readonly reach: number;

  constructor(readonly water: Water) {
    const size = water.n * water.cell;
    this.side = Math.ceil(size / BUCKET);
    for (const river of water.rivers) for (const p of river) this.flat.push(p);
    this.link = new Uint8Array(this.flat.length);
    let at = 0;
    let reach = 0;
    for (const river of water.rivers) {
      for (let i = 0; i < river.length; i++) {
        this.link[at + i] = i < river.length - 1 ? 1 : 0;
        reach = Math.max(reach, river[i].half + BANK_CAP);
      }
      at += river.length;
    }
    this.reach = reach;
    const lists: number[][] = Array.from({ length: this.side * this.side }, () => []);
    for (let s = 0; s < this.flat.length; s++) {
      if (!this.link[s]) continue;
      const a = this.flat[s];
      const b = this.flat[s + 1];
      const i0 = this.bucket(Math.min(a.x, b.x) - reach);
      const i1 = this.bucket(Math.max(a.x, b.x) + reach);
      const j0 = this.bucket(Math.min(a.z, b.z) - reach);
      const j1 = this.bucket(Math.max(a.z, b.z) + reach);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) lists[j * this.side + i].push(s);
    }
    this.start = new Int32Array(lists.length + 1);
    for (let b = 0; b < lists.length; b++) this.start[b + 1] = this.start[b] + lists[b].length;
    this.items = Int32Array.from(lists.flat());
  }

  private bucket(v: number): number {
    return Math.max(0, Math.min(this.side - 1, Math.floor((v - this.water.origin) / BUCKET)));
  }

  /** Water surface at (x, z), lake or river; -Infinity where there is none. */
  level(x: number, z: number): number {
    const { water } = this;
    const m = water.n + 1;
    const i = Math.round((x - water.origin) / water.cell);
    const j = Math.round((z - water.origin) / water.cell);
    let level = NONE;
    if (i >= 0 && j >= 0 && i < m && j < m) {
      const lake = water.lake_of[j * m + i];
      if (lake >= 0) level = water.lakes[lake];
    }
    return Math.max(level, this.river(x, z));
  }

  /**
   * Ground `h` at (x, z) after the rivers: the channel's bed inside its half width, eased banks past it. The lowest of
   * every segment in reach, not the nearest one's, so where the nearest changes at a bend the ground does not step.
   */
  carve(x: number, z: number, h: number): number {
    const b = this.bucket(z) * this.side + this.bucket(x);
    let out = h;
    let surface = Infinity;
    let deepest = 0;
    for (let k = this.start[b]; k < this.start[b + 1]; k++) {
      const s = this.items[k];
      const a = this.flat[s];
      const c = this.flat[s + 1];
      const dx = c.x - a.x;
      const dz = c.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      const ox = x - (a.x + dx * t);
      const oz = z - (a.z + dz * t);
      const d = Math.sqrt(ox * ox + oz * oz);
      if (d >= this.reach) continue;
      const level = a.level + (c.level - a.level) * t;
      const half = a.half + (c.half - a.half) * t;
      if (d < half) {
        const depth = a.depth + (c.depth - a.depth) * t;
        out = Math.min(out, level - depth * (1 - (d / half) * (d / half)));
        if (level < surface) {
          surface = level;
          deepest = depth;
        }
        continue;
      }
      if (h <= level) continue;
      const cut = Math.min(h - level, BANK_CUT);
      const span = BANK_FLAT + cut * BANK_RUN;
      if (d < half + span) out = Math.min(out, h - cut * (1 - smoothstep(half, half + span, d)));
    }
    // Inside a channel, a lower reach's bank (the next loop of a meander) never digs past that channel's own depth.
    return surface === Infinity ? out : Math.max(out, surface - deepest);
  }

  // Lowest surface of every segment whose channel holds (x, z): where channels overlap at a bend the lower one wins,
  // so the water never stands deeper than a channel over the bed `carve` cut there.
  private river(x: number, z: number): number {
    const b = this.bucket(z) * this.side + this.bucket(x);
    let level = Infinity;
    for (let k = this.start[b]; k < this.start[b + 1]; k++) {
      const s = this.items[k];
      const a = this.flat[s];
      const c = this.flat[s + 1];
      const dx = c.x - a.x;
      const dz = c.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      const ox = x - (a.x + dx * t);
      const oz = z - (a.z + dz * t);
      const half = a.half + (c.half - a.half) * t;
      if (ox * ox + oz * oz < half * half) level = Math.min(level, a.level + (c.level - a.level) * t);
    }
    return level === Infinity ? NONE : level;
  }
}

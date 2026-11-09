import { sample, up } from "./field";
import { roof_rise } from "./lots";
import { Builder, bounding_sphere, turned, type Rgb, type Sphere } from "./mesh";
import { deck_layers, type DeckTones } from "./sky-mesh";
import { fbm, hash } from "./noise";
import { CELL, N, ORIGIN, ROAD_HALF, Roof, SIDEWALK, SIZE, type RoadPoint, type WorldData } from "./types";

export const CHUNK = 256;
export const CHUNKS = SIZE / CHUNK;
const CHUNK_CELLS = CHUNK / CELL;
export const JITTER_LEVELS = 64;
const ROCK_HALF = 3;
const ROCK = 6;
const SNOW = 7;
// Deep enough to hide the crack where a half-res chunk edge skips the odd vertices of its full-res neighbour.
const SKIRT = 6;
export const SMALL_BUILDING = 6;

const SURFACE_LIFT = 0.025;
// Spurs sit a hair above streets and sidewalks so their mouth covers the street's sidewalk at the town gate.
const SPUR_LIFT = 0.035;
const RING_LIFT = 0.03;
const MARK_LIFT = 0.045;
const MARK_HALF = 0.15;
const EDGE_INSET = 0.3;
const EDGE_WIDTH = 0.25;
const DASH = 6;
const DASH_ON = 3;
const SPUR_MARK_CLEAR = 8;
const SPUR_MOUTH = 30;
const MOUTH_CLEAR = 5;
const REACH_MARGIN = 0.8;
/** A cell whose two halves differ by at most this (m, corner sums) counts as one plane: road pieces skip its diagonal. */
const FLAT_CELL = 0.001;

const SHOPFRONT_LOW = 0.5;
const SHOPFRONT_HIGH = 2.8;
const SHOPFRONT_INSET = 0.8;
const FACADE_OUT = 0.03;
const PANE = 2.4;
const MULLION = 0.2;
const PAD_LIFT = 0.06;
const LINE_LIFT = 0.09;
const LINE_HALF = 0.06;

/** Linear RGB, resolved from the palette on the main thread: the palette reads theme tokens from the DOM. */
export interface MeshTones {
  /** Base-major, JITTER_LEVELS lightness steps per base: grass, dry, sand, those three half-way to rock, rock, snow. */
  terrain: Float32Array;
  asphalt: Rgb;
  sidewalk: Rgb;
  line: Rgb;
  edge_line: Rgb;
  walls: Rgb[];
  roofs: Rgb[];
  roof_flat: Rgb;
  deck: DeckTones;
}

export interface Soup {
  positions: Float32Array<ArrayBuffer>;
  colors: Float32Array<ArrayBuffer>;
  sphere: Sphere;
}

export interface ChunkBuffers {
  index: number;
  x0: number;
  z0: number;
  /** `index` holds the full-res triangles first, then the half-res ones; both include the edge skirt. */
  terrain: (Soup & { index: Uint16Array<ArrayBuffer>; full: number }) | null;
  /** Surface vertices first, then `marks`, which draw with a stronger polygon offset. */
  road: (Soup & { surface: number }) | null;
  /** Buildings of SMALL_BUILDING and up come first: a far chunk draws only the first `big` vertices. */
  buildings: (Soup & { big: number }) | null;
  glass: { positions: Float32Array<ArrayBuffer>; big: number; sphere: Sphere } | null;
  parking: Soup | null;
}

interface Layer {
  positions: number[];
  colors: number[];
}

export function chunk_of(x: number, z: number): number {
  const i = Math.max(0, Math.min(CHUNKS - 1, Math.floor((x - ORIGIN) / CHUNK)));
  const j = Math.max(0, Math.min(CHUNKS - 1, Math.floor((z - ORIGIN) / CHUNK)));
  return j * CHUNKS + i;
}

function jitter(i: number, j: number): number {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h) - 0.5;
}

export function terrain_colors(data: WorldData, lut: Float32Array): Float32Array {
  const { heights, seed } = data.terrain;
  const colors = new Float32Array((N + 1) * (N + 1) * 3);
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i;
      const x = ORIGIN + i * CELL;
      const z = ORIGIN + j * CELL;
      const y = heights[k];
      const ny = up(heights, x, z);
      let base = y < 2.2 ? 2 : fbm(x / 140, z / 140, seed + 21, 3) > 0.55 ? 1 : 0;
      if (ny < 0.8 || y > 120) base = ny < 0.7 || y > 135 ? ROCK : base + ROCK_HALF;
      if (y > 165) base = SNOW;
      const level = Math.min(JITTER_LEVELS - 1, Math.floor((jitter(i, j) + 0.5) * JITTER_LEVELS));
      colors.set(lut.subarray((base * JITTER_LEVELS + level) * 3, (base * JITTER_LEVELS + level) * 3 + 3), k * 3);
    }
  return colors;
}

function terrain_chunk(data: WorldData, all_colors: Float32Array, ci: number, cj: number): ChunkBuffers["terrain"] {
  const heights = data.terrain.heights;
  const side = CHUNK_CELLS + 1;
  const skirt_start = side * side;
  const count = skirt_start + 4 * side;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const put = (v: number, i: number, j: number, drop: number) => {
    const gi = ci * CHUNK_CELLS + i;
    const gj = cj * CHUNK_CELLS + j;
    const k = gj * (N + 1) + gi;
    positions.set([ORIGIN + gi * CELL, heights[k] - drop, ORIGIN + gj * CELL], v * 3);
    colors.set(all_colors.subarray(k * 3, k * 3 + 3), v * 3);
  };
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) put(j * side + i, i, j, 0);
  // Each edge walked so the skirt faces out of the chunk: +x along the low-z edge, +z along the high-x edge, and so on.
  const edges: [number, number][][] = [[], [], [], []];
  for (let t = 0; t < side; t++) {
    edges[0].push([t, 0]);
    edges[1].push([CHUNK_CELLS, t]);
    edges[2].push([CHUNK_CELLS - t, CHUNK_CELLS]);
    edges[3].push([0, CHUNK_CELLS - t]);
  }
  edges.forEach((edge, e) => edge.forEach(([i, j], t) => put(skirt_start + e * side + t, i, j, SKIRT)));

  const index: number[] = [];
  const surface = (step: number) => {
    for (let j = 0; j < CHUNK_CELLS; j += step)
      for (let i = 0; i < CHUNK_CELLS; i += step) {
        const a = j * side + i;
        const b = a + step;
        const c = a + step * side;
        const d = c + step;
        index.push(a, c, b, b, c, d);
      }
    edges.forEach((edge, e) => {
      for (let t = 0; t + step < side; t += step) {
        const p0 = edge[t][1] * side + edge[t][0];
        const p1 = edge[t + step][1] * side + edge[t + step][0];
        const s0 = skirt_start + e * side + t;
        const s1 = s0 + step;
        index.push(p0, p1, s0, p1, s1, s0);
      }
    });
  };
  surface(1);
  const full = index.length;
  surface(2);
  return { positions, colors, index: Uint16Array.from(index), full, sphere: bounding_sphere(positions.subarray(0, skirt_start * 3)) };
}

export class Roads {
  readonly surface: Layer[] = Array.from({ length: CHUNKS * CHUNKS }, () => ({ positions: [], colors: [] }));
  readonly marks: Layer[] = Array.from({ length: CHUNKS * CHUNKS }, () => ({ positions: [], colors: [] }));

  constructor(private readonly heights: Float32Array) {}

  strip(layers: Layer[], road: RoadPoint[], closed: boolean, from: number, to: number, lift: number, keep: (s: number) => boolean, rgb: Rgb) {
    const segments = closed ? road.length : road.length - 1;
    const reach = offset_reach(road, closed);
    for (let s = 0; s < segments; s++) {
      if (!keep(s)) continue;
      const a = road[s];
      const b = road[(s + 1) % road.length];
      const ra = reach[s];
      const rb = reach[(s + 1) % road.length];
      const layer = layers[chunk_of(a.x, a.z)];
      this.quad(layer, a, b, ra, rb, from, to, lift, rgb);
    }
  }

  private quad(layer: Layer, a: RoadPoint, b: RoadPoint, ra: Reach, rb: Reach, from: number, to: number, lift: number, rgb: Rgb) {
    const at = (p: RoadPoint, r: Reach, side: number): Point => {
      const d = Math.max(r[0], Math.min(r[1], side));
      return [p.x - p.tz * d, p.z + p.tx * d];
    };
    const a0 = at(a, ra, from);
    const a1 = at(a, ra, to);
    const b0 = at(b, rb, from);
    const b1 = at(b, rb, to);
    this.draped(layer, [a0, a1, b0], lift, rgb);
    this.draped(layer, [b0, a1, b1], lift, rgb);
  }

  // Terrain is linear only inside each half cell, so a road triangle spanning a crease would cut under a ridge or float
  // over a dip. Cutting it along every cell edge and diagonal it crosses lays it exactly on the ground the car drives on.
  // Every triangle is cut, however flat: one left whole beside a cut neighbour leaves a T-junction crack along their
  // shared edge, and its sag, deeper than the gap between asphalt and marks, sank lane marks under the asphalt.
  // Whether a cut happens depends only on the terrain, never on the road triangle, so neighbours always agree: a diagonal
  // is skipped only where its cell is flat, and then by every piece in that cell.
  private draped(layer: Layer, triangle: Point[], lift: number, rgb: Rgb) {
    let pieces = [triangle];
    for (const [ux, uz] of GRID_LINES) {
      const along = triangle.map(([x, z]) => (ux * x + uz * z - ORIGIN) / CELL);
      for (let k = Math.floor(Math.min(...along)) + 1; k < Math.max(...along); k++) pieces = pieces.flatMap((piece) => split(piece, ux, uz, ORIGIN + k * CELL));
    }
    pieces = pieces.flatMap((piece) => {
      const [i, j] = cell_of(piece);
      const k = j * (N + 1) + i;
      const h = this.heights;
      if (Math.abs(h[k] + h[k + N + 2] - h[k + 1] - h[k + N + 1]) <= FLAT_CELL) return [piece];
      return split(piece, 1, 1, 2 * ORIGIN + (i + j + 1) * CELL);
    });
    for (const piece of pieces)
      for (let i = 1; i < piece.length - 1; i++)
        for (const [x, z] of [piece[0], piece[i], piece[i + 1]]) {
          layer.positions.push(x, sample(this.heights, x, z) + lift, z);
          layer.colors.push(rgb[0], rgb[1], rgb[2]);
        }
  }
}

type Point = [number, number];

/** Cell columns and rows, ux * x + uz * z = ORIGIN + k * CELL. Each cell's diagonal runs x + z = 2 * ORIGIN + (i + j + 1) * CELL. */
const GRID_LINES: [number, number][] = [
  [1, 0],
  [0, 1],
];

/** The cell a piece already cut along the grid lines sits in, from its centroid. */
function cell_of(piece: Point[]): [number, number] {
  const x = piece.reduce((sum, p) => sum + p[0], 0) / piece.length;
  const z = piece.reduce((sum, p) => sum + p[1], 0) / piece.length;
  const clamp = (v: number) => Math.max(0, Math.min(N - 1, Math.floor((v - ORIGIN) / CELL)));
  return [clamp(x), clamp(z)];
}

function split(piece: Point[], ux: number, uz: number, line: number): Point[][] {
  const side = piece.map(([x, z]) => ux * x + uz * z - line);
  if (side.every((v) => v >= 0) || side.every((v) => v <= 0)) return [piece];
  const below: Point[] = [];
  const above: Point[] = [];
  piece.forEach((p, i) => {
    const j = (i + 1) % piece.length;
    const q = piece[j];
    if (side[i] <= 0) below.push(p);
    if (side[i] >= 0) above.push(p);
    if ((side[i] < 0 && side[j] > 0) || (side[i] > 0 && side[j] < 0)) {
      const cut = crossing(p, q, side[i], side[j]);
      below.push(cut);
      above.push(cut);
    }
  });
  return [below, above].filter((part) => part.length >= 3);
}

// Both triangles on a shared edge walk it in opposite directions; interpolating from the same end gives them the
// bit-identical vertex, so the cut leaves no hairline gap.
function crossing(p: Point, q: Point, sp: number, sq: number): Point {
  if (p[0] > q[0] || (p[0] === q[0] && p[1] > q[1])) return crossing(q, p, sq, sp);
  const t = sp / (sp - sq);
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
}

/** Lowest and highest side offset a point's ribbon vertices may take. */
type Reach = [number, number];

// On a bend tighter than the ribbon's half width the inner offsets of two neighbouring points cross and the strip folds
// into bow-ties. A quad keeps its winding while each end's offset stays ahead of the other end's offset line:
// t_a . (b + d_b n_b - a) > 0 and t_b . (a + d_a n_a - b) < 0. Each point takes the tighter bound, with a margin.
function offset_reach(road: RoadPoint[], closed: boolean): Reach[] {
  const n = road.length;
  const reach: Reach[] = road.map(() => [-Infinity, Infinity]);
  // Keeps d * k > -REACH_MARGIN * c.
  const bound = (r: Reach, k: number, c: number) => {
    if (Math.abs(k) < 1e-9) return;
    const limit = Math.max(0, REACH_MARGIN * c) / k;
    if (k > 0) r[0] = Math.min(0, Math.max(r[0], -limit));
    else r[1] = Math.max(0, Math.min(r[1], -limit));
  };
  const segments = closed ? n : n - 1;
  for (let s = 0; s < segments; s++) {
    const a = road[s];
    const b = road[(s + 1) % n];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    bound(reach[(s + 1) % n], a.tx * -b.tz + a.tz * b.tx, a.tx * dx + a.tz * dz);
    bound(reach[s], -(b.tx * -a.tz + b.tz * a.tx), b.tx * dx + b.tz * dz);
  }
  return reach;
}

// Streets run node to node; stretching each end by its half width fills the crossing square.
function extended(points: RoadPoint[], by: number): RoadPoint[] {
  const a = points[0];
  const b = points[points.length - 1];
  return [{ ...a, x: a.x - a.tx * by, z: a.z - a.tz * by }, ...points, { ...b, x: b.x + b.tx * by, z: b.z + b.tz * by }];
}

function nearest_index(road: RoadPoint[], x: number, z: number): number {
  let best = 0;
  let dist = Infinity;
  road.forEach((p, i) => {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}

function road_layers(data: WorldData, tones: MeshTones): Roads {
  const out = new Roads(data.terrain.heights);
  const { road, graph } = data;
  const n = road.length;
  const spurs = graph.edges.filter((e) => e.kind === "highway" && !e.closed);
  const mouths = graph.nodes.filter((node) => node.kind === "junction" && spurs.some((e) => e.b === node.id)).map((node) => nearest_index(road, node.x, node.z));
  const clear_of_mouths = (s: number) => mouths.every((m) => Math.abs(((s - m + n * 1.5) % n) - n / 2) > MOUTH_CLEAR);
  out.strip(out.surface, road, true, -ROAD_HALF, ROAD_HALF, RING_LIFT, () => true, tones.asphalt);
  out.strip(out.marks, road, true, -MARK_HALF, MARK_HALF, MARK_LIFT, (s) => s % DASH < DASH_ON, tones.line);
  out.strip(out.marks, road, true, ROAD_HALF - 0.55, ROAD_HALF - 0.3, MARK_LIFT, clear_of_mouths, tones.edge_line);
  out.strip(out.marks, road, true, -ROAD_HALF + 0.3, -ROAD_HALF + 0.55, MARK_LIFT, clear_of_mouths, tones.edge_line);

  // Spurs only come near streets where they leave their town's gate.
  const gates = spurs.flatMap((e) => e.points.slice(0, SPUR_MOUTH));
  const under_spur = (p: RoadPoint, reach: number) => gates.some((q) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < reach * reach);
  const edge_lines = (points: RoadPoint[], half: number, keep: (s: number) => boolean) => {
    for (const side of [-1, 1]) {
      const at = side * (half - EDGE_INSET - EDGE_WIDTH / 2);
      out.strip(out.marks, points, false, at - EDGE_WIDTH / 2, at + EDGE_WIDTH / 2, MARK_LIFT, keep, tones.edge_line);
    }
  };
  for (const edge of graph.edges) {
    if (edge.closed) continue;
    const { points, half } = edge;
    const last = points.length - 1;
    if (edge.kind === "highway") {
      out.strip(out.surface, points, false, -half, half, SPUR_LIFT, () => true, tones.asphalt);
      const open = (s: number) => s > SPUR_MARK_CLEAR && s < last - SPUR_MARK_CLEAR;
      out.strip(out.marks, points, false, -MARK_HALF, MARK_HALF, MARK_LIFT, (s) => open(s) && s % DASH < DASH_ON, tones.line);
      edge_lines(points, half, open);
      continue;
    }
    // Sidewalks start at the crossing street's edge, so two sidewalks only ever overlap in the same colour at a block corner.
    out.strip(out.surface, extended(points, half), false, -half, half, SURFACE_LIFT, () => true, tones.asphalt);
    const step = Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z) || 1;
    const ends = Math.ceil(half / step);
    const clear = Math.ceil((half + SIDEWALK) / step);
    const near_spur = points.map((p) => under_spur(p, half + SIDEWALK + 6));
    const walkway = (s: number) => s >= ends && s < last - ends;
    const marked = (s: number) => s >= clear && s < last - clear && !near_spur[s] && !near_spur[s + 1];
    out.strip(out.surface, points, false, -half - SIDEWALK, -half, SURFACE_LIFT, walkway, tones.sidewalk);
    out.strip(out.surface, points, false, half, half + SIDEWALK, SURFACE_LIFT, walkway, tones.sidewalk);
    edge_lines(points, half, marked);
    out.strip(out.marks, points, false, -MARK_HALF, MARK_HALF, MARK_LIFT, (s) => marked(s) && s % DASH < DASH_ON, tones.line);
  }
  return out;
}

interface Town {
  big: Builder;
  small: Builder;
  glass_big: Builder;
  glass_small: Builder;
  parking: Builder;
}

function shopfront(out: Builder, hw: number, hd: number) {
  const w = hw - SHOPFRONT_INSET;
  const z = hd + FACADE_OUT;
  const panes = Math.max(1, Math.round((2 * w + MULLION) / (PANE + MULLION)));
  const pane = (2 * w - (panes - 1) * MULLION) / panes;
  const none: Rgb = [0, 0, 0];
  for (let p = 0; p < panes; p++) {
    const x0 = -w + p * (pane + MULLION);
    const x1 = x0 + pane;
    out.quad([x0, SHOPFRONT_LOW, z], [x1, SHOPFRONT_LOW, z], [x1, SHOPFRONT_HIGH, z], [x0, SHOPFRONT_HIGH, z], none);
  }
}

function town_builders(data: WorldData, tones: MeshTones): Map<number, Town> {
  const towns = new Map<number, Town>();
  const ground = (x: number, z: number) => sample(data.terrain.heights, x, z);
  const of = (x: number, z: number) => {
    const key = chunk_of(x, z);
    let town = towns.get(key);
    if (!town) {
      town = { big: new Builder(), small: new Builder(), glass_big: new Builder(), glass_small: new Builder(), parking: new Builder(undefined, ground) };
      towns.set(key, town);
    }
    return town;
  };
  const seed = data.terrain.seed;
  for (const b of data.buildings) {
    const wall = tones.walls[b.style % tones.walls.length];
    const roof = tones.roofs[Math.floor(hash(b.lot, 0, seed + 81) * tones.roofs.length)];
    const rise = roof_rise(b);
    const town = of(b.x, b.z);
    const big = b.height + rise >= SMALL_BUILDING;
    const out = (big ? town.big : town.small).at(b);
    out.walls(b.hw, b.hd, -1, b.height, wall);
    if (data.lots[b.lot].kind === "shop") shopfront((big ? town.glass_big : town.glass_small).at(b), b.hw, b.hd);
    if (b.roof === Roof.GABLE) out.gable(b.hw, b.hd, b.height, rise, roof, wall);
    else if (b.roof === Roof.CROSS) out.at(turned(b)).gable(b.hd, b.hw, b.height, rise, roof, wall);
    else if (b.roof === Roof.HIP) {
      if (b.hw >= b.hd) out.hip(b.hw, b.hd, b.height, rise, roof);
      else out.at(turned(b)).hip(b.hd, b.hw, b.height, rise, roof);
    } else out.top(b.hw, b.hd, b.height, tones.roof_flat);
  }
  for (const lot of data.parking) {
    const frame = data.lots[lot.lot];
    const out = of(frame.x, frame.z).parking.at(frame);
    out.top(lot.size.w / 2, lot.size.d / 2, PAD_LIFT, tones.asphalt);
    for (const bay of lot.bays) {
      const z0 = bay.z - bay.l / 2;
      const z1 = bay.z + bay.l / 2;
      for (const x of [bay.x - bay.w / 2, bay.x + bay.w / 2])
        out.quad([x - LINE_HALF, LINE_LIFT, z1], [x + LINE_HALF, LINE_LIFT, z1], [x + LINE_HALF, LINE_LIFT, z0], [x - LINE_HALF, LINE_LIFT, z0], tones.line);
    }
  }
  return towns;
}

function soup(layers: Layer[]): Soup | null {
  const positions = Float32Array.from(layers.flatMap((l) => l.positions));
  if (!positions.length) return null;
  return { positions, colors: Float32Array.from(layers.flatMap((l) => l.colors)), sphere: bounding_sphere(positions) };
}

function sky_chunks(data: WorldData, tones: MeshTones): ChunkBuffers[] {
  const surface: Layer[] = Array.from({ length: CHUNKS * CHUNKS }, () => ({ positions: [], colors: [] }));
  const marks: Layer[] = Array.from({ length: CHUNKS * CHUNKS }, () => ({ positions: [], colors: [] }));
  if (data.deck) deck_layers(data.deck, tones.deck, chunk_of, surface, marks);
  const chunks: ChunkBuffers[] = [];
  for (let cj = 0; cj < CHUNKS; cj++)
    for (let ci = 0; ci < CHUNKS; ci++) {
      const index = cj * CHUNKS + ci;
      const road = soup([surface[index], marks[index]]);
      if (!road) continue;
      chunks.push({ index, x0: ORIGIN + ci * CHUNK, z0: ORIGIN + cj * CHUNK, terrain: null, road: { ...road, surface: surface[index].positions.length / 3 }, buildings: null, glass: null, parking: null });
    }
  return chunks;
}

export function build_chunks(data: WorldData, tones: MeshTones): ChunkBuffers[] {
  if (data.kind === "sky") return sky_chunks(data, tones);
  const colors = terrain_colors(data, tones.terrain);
  const roads = road_layers(data, tones);
  const towns = town_builders(data, tones);
  const chunks: ChunkBuffers[] = [];
  for (let cj = 0; cj < CHUNKS; cj++)
    for (let ci = 0; ci < CHUNKS; ci++) {
      const index = cj * CHUNKS + ci;
      const surface = roads.surface[index];
      const road = soup([surface, roads.marks[index]]);
      const town = towns.get(index);
      const buildings = town && soup([town.big, town.small]);
      const glass = town && soup([town.glass_big, town.glass_small]);
      chunks.push({
        index,
        x0: ORIGIN + ci * CHUNK,
        z0: ORIGIN + cj * CHUNK,
        terrain: terrain_chunk(data, colors, ci, cj),
        road: road && { ...road, surface: surface.positions.length / 3 },
        buildings: town && buildings ? { ...buildings, big: town.big.vertices } : null,
        glass: town && glass ? { positions: glass.positions, sphere: glass.sphere, big: town.glass_big.vertices } : null,
        parking: (town && soup([town.parking])) ?? null,
      });
    }
  return chunks;
}

export function chunk_transfers(chunks: ChunkBuffers[]): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const c of chunks) {
    if (c.terrain) out.push(c.terrain.positions.buffer, c.terrain.colors.buffer, c.terrain.index.buffer);
    for (const part of [c.road, c.buildings, c.parking]) if (part) out.push(part.positions.buffer, part.colors.buffer);
    if (c.glass) out.push(c.glass.positions.buffer);
  }
  return out;
}

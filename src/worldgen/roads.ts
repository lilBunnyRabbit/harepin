import { sample } from "./field";
import { CHUNK, COMPACT, chunk_of, type Extent } from "./chunk-grid";
import type { Patch, PatchPoint, Reach, RimPoint } from "./junction";
import type { Rgb } from "./mesh";
import { Pieces, split } from "./pieces";
import { CELL, N, ORIGIN, type RoadPoint } from "./types";

const REACH_MARGIN = 0.8;
/** A cell whose two halves differ by at most this (m, corner sums) counts as one plane: road pieces skip its diagonal. */
const FLAT_CELL = 0.001;
const GIVE_WAY_DASH = 0.6;
const GIVE_WAY_GAP = 0.3;

/** Ground the road drapes over: heights at lattice vertices (cells counted from ORIGIN) and between them. */
export interface LatticeGround {
  vertex(i: number, j: number): number;
  height(x: number, z: number): number;
}

export function grid_ground(heights: Float32Array): LatticeGround {
  return { vertex: (i, j) => heights[j * (N + 1) + i], height: (x, z) => sample(heights, x, z) };
}

export interface Layer {
  positions: number[];
  colors: number[];
}

/** Height above the ground: `y` at (x, z), changing by gx, gz per metre. */
interface Lift {
  y: number;
  gx: number;
  gz: number;
  x: number;
  z: number;
}

function level(y: number): Lift {
  return { y, gx: 0, gz: 0, x: 0, z: 0 };
}

// Anchored at `a`, a rim point: along a mouth both ends share the arm's lift and the plane drifts from it only by rounding.
function plane(a: PatchPoint, b: PatchPoint, c: PatchPoint): Lift {
  if (a.lift === b.lift && a.lift === c.lift) return level(a.lift);
  const bx = b.x - a.x;
  const bz = b.z - a.z;
  const cx = c.x - a.x;
  const cz = c.z - a.z;
  const det = bx * cz - bz * cx || 1;
  const db = b.lift - a.lift;
  const dc = c.lift - a.lift;
  return { y: a.lift, gx: (db * cz - dc * bz) / det, gz: (dc * bx - db * cx) / det, x: a.x, z: a.z };
}

/** A ribbon's centre line with its offset reach and each segment's chunk, the part of `strip` that is the same every chunk. */
export interface StripLine {
  readonly points: RoadPoint[];
  readonly reach: Reach[];
  readonly ext: Extent;
  /** Chunk of each segment's start point. */
  readonly chunks: Int32Array;
  /** Every segment in order, and per chunk the segments starting in it, in order. */
  readonly order: Int32Array;
  readonly bins: Map<number, number[]>;
}

export function strip_line(points: RoadPoint[], closed: boolean, ext: Extent): StripLine {
  const segments = Math.max(0, closed ? points.length : points.length - 1);
  const chunks = new Int32Array(segments);
  const order = new Int32Array(segments);
  const bins = new Map<number, number[]>();
  for (let s = 0; s < segments; s++) {
    const chunk = chunk_of(points[s].x, points[s].z, ext);
    chunks[s] = chunk;
    order[s] = s;
    const bin = bins.get(chunk);
    if (bin) bin.push(s);
    else bins.set(chunk, [s]);
  }
  return { points, reach: offset_reach(points, closed), ext, chunks, order, bins };
}

export class Roads {
  readonly surface: Layer[];
  readonly marks: Layer[];

  private pieces = new Pieces();
  private cut = new Pieces();
  private readonly lo: number;
  private readonly hi: number;

  /** With `only`, everything binned to another chunk is skipped: a streamed world meshes one chunk at a time. */
  constructor(
    private readonly ground: LatticeGround,
    readonly ext: Extent = COMPACT,
    private readonly only: number | null = null,
  ) {
    this.surface = Array.from({ length: ext.side * ext.side }, () => ({ positions: [], colors: [] }));
    this.marks = Array.from({ length: ext.side * ext.side }, () => ({ positions: [], colors: [] }));
    this.lo = ext.lattice * (CHUNK / CELL);
    this.hi = this.lo + ext.n - 1;
  }

  /** The chunk (x, z) bins to, or -1 when this builder skips it. */
  chunk(x: number, z: number): number {
    const index = chunk_of(x, z, this.ext);
    return this.only === null || index === this.only ? index : -1;
  }

  strip(layers: Layer[], road: RoadPoint[], closed: boolean, from: number, to: number, lift: number, keep: (s: number) => boolean, rgb: Rgb) {
    this.strip_line(layers, strip_line(road, closed, this.ext), from, to, lift, keep, rgb);
  }

  /** `strip` over a line binned ahead: a one-chunk builder walks only the segments that start in its chunk. */
  strip_line(layers: Layer[], line: StripLine, from: number, to: number, lift: number, keep: (s: number) => boolean, rgb: Rgb) {
    if (line.ext !== this.ext) throw new Error("strip line binned for another extent");
    const { points: road, reach } = line;
    const flat = level(lift);
    const segments = this.only === null ? line.order : line.bins.get(this.only);
    if (!segments) return;
    for (let k = 0; k < segments.length; k++) {
      const s = segments[k];
      if (!keep(s)) continue;
      const a = road[s];
      const b = road[(s + 1) % road.length];
      this.quad(layers[line.chunks[s]], a, b, reach[s], reach[(s + 1) % road.length], from, to, flat, rgb);
    }
  }

  private quad(layer: Layer, a: RoadPoint, b: RoadPoint, ra: Reach, rb: Reach, from: number, to: number, lift: Lift, rgb: Rgb) {
    const a0 = Math.max(ra[0], Math.min(ra[1], from));
    const a1 = Math.max(ra[0], Math.min(ra[1], to));
    const b0 = Math.max(rb[0], Math.min(rb[1], from));
    const b1 = Math.max(rb[0], Math.min(rb[1], to));
    const a0x = a.x - a.tz * a0;
    const a0z = a.z + a.tx * a0;
    const a1x = a.x - a.tz * a1;
    const a1z = a.z + a.tx * a1;
    const b0x = b.x - b.tz * b0;
    const b0z = b.z + b.tx * b0;
    this.draped(layer, a0x, a0z, a1x, a1z, b0x, b0z, lift, rgb);
    this.draped(layer, b0x, b0z, a1x, a1z, b.x - b.tz * b1, b.z + b.tx * b1, lift, rgb);
  }

  /** A fan from the patch centre to its rim; lift eases between the arms' lifts so each mouth meets its strip flush. */
  patch(layer: Layer, patch: Patch, rgb: Rgb) {
    const { centre: c, outline } = patch;
    for (let q = 0; q < outline.length; q++) {
      const a = outline[(q + 1) % outline.length];
      const b = outline[q];
      this.draped(layer, c.x, c.z, a.x, a.z, b.x, b.z, plane(b, a, c), rgb);
    }
  }

  rim_line(layer: Layer, line: RimPoint[], from: number, to: number, lift: number, rgb: Rgb) {
    const flat = level(lift);
    for (let q = 0; q + 1 < line.length; q++) {
      const a = line[q];
      const b = line[q + 1];
      const a0x = a.x + a.wx * from;
      const a0z = a.z + a.wz * from;
      const b0x = b.x + b.wx * from;
      const b0z = b.z + b.wz * from;
      const a1x = a.x + a.wx * to;
      const a1z = a.z + a.wz * to;
      this.up(layer, a0x, a0z, a1x, a1z, b0x, b0z, flat, rgb);
      this.up(layer, b0x, b0z, a1x, a1z, b.x + b.wx * to, b.z + b.wz * to, flat, rgb);
    }
  }

  give_way(layer: Layer, p: RoadPoint, half: number, out: number, width: number, lift: number, rgb: Rgb) {
    const flat = level(lift);
    const dashes = Math.max(1, Math.round((2 * half + GIVE_WAY_GAP) / (GIVE_WAY_DASH + GIVE_WAY_GAP)));
    const dash = (2 * half - (dashes - 1) * GIVE_WAY_GAP) / dashes;
    const at = (side: number, ahead: number): [number, number] => [p.x - p.tz * side + p.tx * ahead, p.z + p.tx * side + p.tz * ahead];
    for (let d = 0; d < dashes; d++) {
      const s0 = -half + d * (dash + GIVE_WAY_GAP);
      const s1 = s0 + dash;
      const [ax, az] = at(s0, out);
      const [bx, bz] = at(s1, out);
      const [cx, cz] = at(s0, out + width);
      const [ex, ez] = at(s1, out + width);
      this.up(layer, ax, az, bx, bz, cx, cz, flat, rgb);
      this.up(layer, cx, cz, bx, bz, ex, ez, flat, rgb);
    }
  }

  private up(layer: Layer, ax: number, az: number, bx: number, bz: number, cx: number, cz: number, lift: Lift, rgb: Rgb) {
    if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) >= 0) this.draped(layer, ax, az, bx, bz, cx, cz, lift, rgb);
    else this.draped(layer, ax, az, cx, cz, bx, bz, lift, rgb);
  }

  // Terrain is linear only inside each half cell, so a road triangle spanning a crease would cut under a ridge or float
  // over a dip. Cutting it along every cell edge and diagonal it crosses lays it exactly on the ground the car drives on.
  // Every triangle is cut, however flat: one left whole beside a cut neighbour leaves a T-junction crack along their
  // shared edge, and its sag, deeper than the gap between asphalt and marks, sank lane marks under the asphalt.
  // Whether a cut happens depends only on the terrain, never on the road triangle, so neighbours always agree: a diagonal
  // is skipped only where its cell is flat, and then by every piece in that cell.
  private draped(layer: Layer, ax: number, az: number, bx: number, bz: number, cx: number, cz: number, lift: Lift, rgb: Rgb) {
    this.pieces.clear();
    this.pieces.begin();
    this.pieces.push(ax, az);
    this.pieces.push(bx, bz);
    this.pieces.push(cx, cz);
    this.pieces.end();
    for (const [ux, uz] of GRID_LINES) {
      const pa = (ux * ax + uz * az - ORIGIN) / CELL;
      const pb = (ux * bx + uz * bz - ORIGIN) / CELL;
      const pc = (ux * cx + uz * cz - ORIGIN) / CELL;
      const top = Math.max(pa, pb, pc);
      for (let k = Math.floor(Math.min(pa, pb, pc)) + 1; k < top; k++) this.split_all(ux, uz, ORIGIN + k * CELL);
    }
    const { pieces, cut, ground: g, lo, hi } = this;
    cut.clear();
    for (let p = 0; p < pieces.length; p++) {
      const i = cell_column(pieces, p, 0, lo, hi);
      const j = cell_column(pieces, p, 1, lo, hi);
      if (Math.abs(g.vertex(i, j) + g.vertex(i + 1, j + 1) - g.vertex(i + 1, j) - g.vertex(i, j + 1)) <= FLAT_CELL) cut.copy(pieces, p);
      else split(pieces, p, cut, 1, 1, 2 * ORIGIN + (i + j + 1) * CELL);
    }
    for (let p = 0; p < cut.length; p++) {
      const s = cut.start[p];
      for (let i = 1; i < cut.count[p] - 1; i++) {
        this.lay(layer, cut.xz[s], cut.xz[s + 1], lift, rgb);
        this.lay(layer, cut.xz[s + 2 * i], cut.xz[s + 2 * i + 1], lift, rgb);
        this.lay(layer, cut.xz[s + 2 * i + 2], cut.xz[s + 2 * i + 3], lift, rgb);
      }
    }
  }

  private split_all(ux: number, uz: number, line: number) {
    const { pieces, cut } = this;
    cut.clear();
    for (let p = 0; p < pieces.length; p++) split(pieces, p, cut, ux, uz, line);
    this.pieces = cut;
    this.cut = pieces;
  }

  private lay(layer: Layer, x: number, z: number, lift: Lift, rgb: Rgb) {
    const up = lift.y + lift.gx * (x - lift.x) + lift.gz * (z - lift.z);
    layer.positions.push(x, this.ground.height(x, z) + up, z);
    layer.colors.push(rgb[0], rgb[1], rgb[2]);
  }
}

/** Cell columns and rows, ux * x + uz * z = ORIGIN + k * CELL. Each cell's diagonal runs x + z = 2 * ORIGIN + (i + j + 1) * CELL. */
const GRID_LINES: [number, number][] = [
  [1, 0],
  [0, 1],
];

/** The cell column (axis 0) or row (axis 1) a piece already cut along the grid lines sits in, from its centroid. */
function cell_column(pieces: Pieces, p: number, axis: 0 | 1, lo: number, hi: number): number {
  const s = pieces.start[p];
  const n = pieces.count[p];
  let sum = 0;
  for (let i = 0; i < n; i++) sum += pieces.xz[s + 2 * i + axis];
  return Math.max(lo, Math.min(hi, Math.floor((sum / n - ORIGIN) / CELL)));
}

// On a bend tighter than the ribbon's half width the inner offsets of two neighbouring points cross and the strip folds
// into bow-ties. A quad keeps its winding while each end's offset stays ahead of the other end's offset line:
// t_a . (b + d_b n_b - a) > 0 and t_b . (a + d_a n_a - b) < 0. Each point takes the tighter bound, with a margin.
export function offset_reach(road: RoadPoint[], closed: boolean): Reach[] {
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

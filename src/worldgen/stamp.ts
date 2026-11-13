import { harden, type BiomeCuts } from "./biomes";
import { carve } from "./canyon";
import { at, span_i, span_j, WHOLE, type Grid } from "./field";
import { smoothstep } from "./noise";
import type { Bank, TerrainRecipe } from "./recipe";
import { pad, type Crossing } from "./trails";
import { town_level } from "./towns";
import { FACE_REACH, shape_face } from "./switchback";
import { freeze_vertex, type FrozenLake } from "./ice";
import { lava_vertex, type LavaPool } from "./lava";
import { snow_vertex, type Parting, type SnowKit } from "./snow";
import { soak, water_index, type Water } from "./water";
import { CELL, ORIGIN, ROAD_HALF, SHOULDER, SurfaceId, type Canyon, type RoadEdge, type RoadPoint, type Terrain, type Town } from "./types";

// Past `core` plus two cells every vertex a lot corner can touch is fully on the plane; the plane then eases back to
// terrain over PLATEAU_BLEND.
const PLATEAU_EDGE = CELL * 2;
const PLATEAU_BLEND = 40;
/** A strip village's plateau eases back no steeper than this, so a cut or fill on a valley side blends over a wider run. */
const STRIP_EASE = 0.5;
const STRIP_BLEND_MAX = 120;
// A terrain triangle touching a road or pad has vertices up to CELL * sqrt(2) outside it; flattening that far keeps it
// under the surface mesh.
const FLAT = 6;
export const TRAIL_HALF = 4;
export const TRAIL_SHOULDER = 6;
/** Dirt reaches this far past the trail half: the surface grid is read at the nearest vertex, up to CELL / 2 away. */
const DIRT_MARGIN = 1.5;
/**
 * Metres past a junction patch's rim its distance still writes road_dist: a cell past every rule that reads road_dist
 * (up to ROAD_HALF + SHOULDER), so where the patch field gives way to the edges' lies beyond what any rule sees.
 */
const RIM_REACH = SHOULDER + CELL;
/** Most grade a mouth's ease from an earlier road's band height back to its own profile adds on top of it, over at least MOUTH_EASE_MIN. */
const MOUTH_GRADE = 0.03;
const MOUTH_EASE_MIN = 16;
const GROUP = 8;
// Past the bound by more than float32 rounding, a skipped distance could not tie a kept one once stored.
const BOUND_SLACK = 1e-6;
const BOUND_GAP = 1e-5;

/** `blend(i)` is the share of the way the ground moves to the line's height by segment i: 0 leaves it, 1 sets it. */
export interface TrailLine {
  points: readonly RoadPoint[];
  blend: (i: number) => number;
}

/**
 * One write to the ground grids, in the order generation made it. Each is a function of a vertex's position, its
 * own earlier values and these inputs, never of its neighbours', so replaying the list over any window of the grid
 * gives that window bit-identical to the whole-grid run.
 */
export type GroundOp =
  | { kind: "carve"; canyon: Canyon }
  | { kind: "face"; points: readonly RoadPoint[]; reach: number }
  | { kind: "plateau"; town: Town }
  | { kind: "edge"; edge: RoadEdge; bank: Bank | null }
  | { kind: "junction"; outline: readonly { x: number; z: number }[] }
  | { kind: "blend"; bank: Bank | null }
  | { kind: "pad"; crossing: Crossing }
  | { kind: "trail"; lines: { points: readonly RoadPoint[]; blend: number[] }[] }
  | { kind: "bank"; lines: readonly (readonly RoadPoint[])[]; half: number; bank: Bank }
  | { kind: "harden"; cuts: BiomeCuts; floor: number | null }
  | { kind: "water"; water: Water }
  | { kind: "snow"; kit: SnowKit; beach: number; parts: readonly Parting[] }
  | { kind: "ice"; lakes: readonly FrozenLake[]; seed: number }
  | { kind: "lava"; pools: readonly LavaPool[] }
  | { kind: "paint"; lines: readonly (readonly RoadPoint[])[]; half: number; surface: SurfaceId };

export type GroundBase = { kind: "terrain"; seed: number; shape: TerrainRecipe } | { kind: "flat"; height: number; road_dist: number };

export interface GroundPlan {
  base: GroundBase;
  ops: GroundOp[];
}

/** What an edge op works out from the edges alone, the same over every window a replay covers. */
export interface EdgeShape {
  /** How many edges were laid before it; a replay with another count works its own out. */
  laid: number;
  heights: Float64Array;
  /** Per segment, its x0, x1, z0, z1 box. */
  boxes: Float64Array;
}

/** Edge shapes one set of replays shares, so each is worked out once rather than once per window. */
export type EdgeShapes = Map<RoadEdge, EdgeShape>;

export class Stamp {
  private readonly road_height: Float32Array;
  readonly owner_dist: Float32Array;
  readonly edge_of: Int32Array;
  /** 1 where the owning edge is a town street, whose height is the town plane. */
  readonly street: Uint8Array;
  /** Every write so far, for `replay` over a tile; empty when not recording. */
  readonly ops: GroundOp[] = [];
  private bound = new Float64Array(0);
  private bound_mark = new Int32Array(0);
  private pass = 0;
  private readonly laid: RoadEdge[] = [];
  /** Per laid edge, the x0, x1, z0, z1 box of each GROUP of its segments. */
  private readonly laid_boxes: Float64Array[] = [];
  private readonly towns: Town[] = [];

  constructor(
    private readonly terrain: Terrain,
    private readonly grid: Grid = WHOLE,
    private readonly record = true,
    private readonly shapes: EdgeShapes | null = null,
  ) {
    this.road_height = new Float32Array(terrain.heights.length);
    this.edge_of = new Int32Array(terrain.heights.length).fill(-1);
    this.owner_dist = new Float32Array(terrain.heights.length).fill(1e9);
    this.street = new Uint8Array(terrain.heights.length);
  }

  replay(op: GroundOp) {
    if (op.kind === "carve") this.carve(op.canyon);
    else if (op.kind === "face") this.face(op.points, op.reach);
    else if (op.kind === "plateau") this.plateau(op.town);
    else if (op.kind === "edge") this.edge(op.edge, op.bank);
    else if (op.kind === "junction") this.junction(op.outline);
    else if (op.kind === "blend") this.blend(op.bank);
    else if (op.kind === "pad") this.pad(op.crossing);
    else if (op.kind === "trail") this.trail(op.lines.map(({ points, blend }) => ({ points, blend: (i) => blend[i] })));
    else if (op.kind === "bank") this.bank(op.lines, op.half, op.bank);
    else if (op.kind === "water") this.water(op.water);
    else if (op.kind === "snow") this.snow(op.kit, op.beach, op.parts);
    else if (op.kind === "ice") this.ice(op.lakes, op.seed);
    else if (op.kind === "lava") this.lava(op.pools);
    else if (op.kind === "paint") this.paint(op.lines, op.half, op.surface);
    else this.harden(op.cuts, op.floor);
  }

  private log(op: GroundOp) {
    if (this.record) this.ops.push(op);
  }

  carve(canyon: Canyon) {
    this.log({ kind: "carve", canyon });
    carve(this.terrain.heights, canyon, this.grid);
  }

  // A trail bank is shaped after the roads are laid: unguarded, it tilts any asphalt within its reach.
  face(points: readonly RoadPoint[], reach = FACE_REACH) {
    this.log({ kind: "face", points, reach });
    const { heights, road_dist } = this.terrain;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const p of points) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      z0 = Math.min(z0, p.z);
      z1 = Math.max(z1, p.z);
    }
    const [i0, i1] = span_i(this.grid, x0 - reach, x1 + reach);
    const [j0, j1] = span_j(this.grid, z0 - reach, z1 + reach);
    const kept: number[] = [];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = at(this.grid, i, j);
        if (road_guard(road_dist[k]) < 1) kept.push(k, heights[k]);
      }
    shape_face(heights, points, this.grid, reach);
    for (let n = 0; n < kept.length; n += 2) {
      const k = kept[n];
      heights[k] = kept[n + 1] + (heights[k] - kept[n + 1]) * road_guard(road_dist[k]);
    }
  }

  pad(crossing: Crossing) {
    this.log({ kind: "pad", crossing });
    pad(this.terrain, crossing, this.grid);
  }

  harden(cuts: BiomeCuts, floor: number | null) {
    this.log({ kind: "harden", cuts, floor });
    harden(cuts, this.terrain, this.grid, floor);
  }

  water(water: Water) {
    this.log({ kind: "water", water });
    const index = water_index(water);
    const { heights, surface } = this.terrain;
    const { grid } = this;
    for (let j = grid.j0; j <= grid.j1; j++)
      for (let i = grid.i0; i <= grid.i1; i++) soak(index, heights, surface, at(grid, i, j), ORIGIN + i * CELL, ORIGIN + j * CELL, SurfaceId.WET);
  }

  ice(lakes: readonly FrozenLake[], seed: number) {
    this.log({ kind: "ice", lakes, seed });
    const { heights, surface } = this.terrain;
    const { grid } = this;
    for (let j = grid.j0; j <= grid.j1; j++) for (let i = grid.i0; i <= grid.i1; i++) freeze_vertex(lakes, seed, heights, surface, at(grid, i, j), ORIGIN + i * CELL, ORIGIN + j * CELL);
  }

  lava(pools: readonly LavaPool[]) {
    this.log({ kind: "lava", pools });
    const { heights, surface } = this.terrain;
    const { grid } = this;
    for (let j = grid.j0; j <= grid.j1; j++) for (let i = grid.i0; i <= grid.i1; i++) lava_vertex(pools, heights, surface, at(grid, i, j), ORIGIN + i * CELL, ORIGIN + j * CELL);
  }

  /** Lays `surface` within `half` metres of the lines and a cell past them, as far as a nearest-vertex read reaches. Surface only. */
  paint(lines: readonly (readonly RoadPoint[])[], half: number, surface: SurfaceId) {
    this.log({ kind: "paint", lines, half, surface });
    const reach = half + CELL;
    for (const points of lines)
      for (let s = 0; s < points.length - 1; s++) {
        const a = points[s];
        const b = points[s + 1];
        const [i0, i1] = span_i(this.grid, Math.min(a.x, b.x) - reach, Math.max(a.x, b.x) + reach);
        const [j0, j1] = span_j(this.grid, Math.min(a.z, b.z) - reach, Math.max(a.z, b.z) + reach);
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len2 = dx * dx + dz * dz || 1;
        for (let j = j0; j <= j1; j++)
          for (let i = i0; i <= i1; i++) {
            const px = ORIGIN + i * CELL;
            const pz = ORIGIN + j * CELL;
            const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
            const ox = px - (a.x + dx * t);
            const oz = pz - (a.z + dz * t);
            if (ox * ox + oz * oz <= reach * reach) this.terrain.surface[at(this.grid, i, j)] = surface;
          }
      }
  }

  snow(kit: SnowKit, beach: number, parts: readonly Parting[]) {
    this.log({ kind: "snow", kit, beach, parts });
    const { heights, road_dist, surface } = this.terrain;
    const { grid } = this;
    for (let j = grid.j0; j <= grid.j1; j++)
      for (let i = grid.i0; i <= grid.i1; i++) {
        const k = at(grid, i, j);
        snow_vertex(kit, beach, parts, heights, road_dist, surface, this.street[k] === 1, k, ORIGIN + i * CELL, ORIGIN + j * CELL);
      }
  }

  plateau(town: Town) {
    this.log({ kind: "plateau", town });
    this.towns.push(town);
    if (town.band !== undefined) return this.strip_plateau(town, town.band);
    const { heights } = this.terrain;
    const full = town.core + PLATEAU_EDGE;
    const reach = full + PLATEAU_BLEND;
    const [i0, i1] = span_i(this.grid, town.x - reach, town.x + reach);
    const [j0, j1] = span_j(this.grid, town.z - reach, town.z + reach);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const x = ORIGIN + i * CELL;
        const z = ORIGIN + j * CELL;
        const d = Math.sqrt((x - town.x) * (x - town.x) + (z - town.z) * (z - town.z));
        if (d >= reach) continue;
        const k = at(this.grid, i, j);
        const w = 1 - smoothstep(full, reach, d);
        heights[k] += (town_level(town, x, z) - heights[k]) * w;
      }
  }

  // Levels the strip's core within its band of the street; past it the blend runs wider where the cut or fill is deeper.
  private strip_plateau(town: Town, band: number) {
    const { heights } = this.terrain;
    const reach = town.core + PLATEAU_EDGE + STRIP_BLEND_MAX;
    const [i0, i1] = span_i(this.grid, town.x - reach, town.x + reach);
    const [j0, j1] = span_j(this.grid, town.z - reach, town.z + reach);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const x = ORIGIN + i * CELL;
        const z = ORIGIN + j * CELL;
        const dx = x - town.x;
        const dz = z - town.z;
        const out = Math.max(Math.sqrt(dx * dx + dz * dz) - town.core, Math.abs(dx * town.uz - dz * town.ux) - band);
        const k = at(this.grid, i, j);
        const level = town_level(town, x, z);
        const blend = Math.min(STRIP_BLEND_MAX, Math.max(PLATEAU_BLEND, Math.abs(heights[k] - level) / STRIP_EASE));
        if (out >= PLATEAU_EDGE + blend) continue;
        heights[k] += (level - heights[k]) * (1 - smoothstep(PLATEAU_EDGE, PLATEAU_EDGE + blend, out));
      }
  }

  // Edges stamp in priority order (circuit, streets, spurs, roads between towns). A later edge never takes height over
  // another edge's flat band, so a spur meeting the sloped circuit merges into its surface instead of cutting a step
  // across it.
  // A group of segments is skipped at a vertex its box lies past that vertex's bound from: none of them could write it,
  // so the grids come out bit-identical to testing every segment over its whole box.
  edge(edge: RoadEdge, bank: Bank | null = null) {
    this.log({ kind: "edge", edge, bank });
    const before = this.laid.length;
    this.lay(edge);
    const { points, half } = edge;
    const reach = half + (bank ? Math.max(SHOULDER, bank.reach) : SHOULDER);
    const segments = edge.closed ? points.length : points.length - 1;
    let left = Infinity;
    let right = -Infinity;
    let low = Infinity;
    let high = -Infinity;
    for (const p of points) {
      left = Math.min(left, p.x);
      right = Math.max(right, p.x);
      low = Math.min(low, p.z);
      high = Math.max(high, p.z);
    }
    const [ei0, ei1] = span_i(this.grid, left - reach, right + reach);
    const [ej0, ej1] = span_j(this.grid, low - reach, high + reach);
    if (ei0 > ei1 || ej0 > ej1) return;
    const { heights, boxes: world } = this.shape(edge, before, segments);
    const boxes = new Int32Array(segments * 4);
    for (let s = 0; s < segments; s++) {
      const [i0, i1] = span_i(this.grid, world[s * 4] - reach, world[s * 4 + 1] + reach);
      const [j0, j1] = span_j(this.grid, world[s * 4 + 2] - reach, world[s * 4 + 3] + reach);
      boxes[s * 4] = i0;
      boxes[s * 4 + 1] = i1;
      boxes[s * 4 + 2] = j0;
      boxes[s * 4 + 3] = j1;
    }
    this.bound_edge(edge, boxes, segments);
    const { bound, bound_mark, pass } = this;
    for (let g = 0; g < segments; g += GROUP) {
      const last = Math.min(segments, g + GROUP);
      let x0 = Infinity;
      let x1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      let i0 = Infinity;
      let i1 = -Infinity;
      let j0 = Infinity;
      let j1 = -Infinity;
      for (let s = g; s < last; s++) {
        const a = points[s];
        const b = points[(s + 1) % points.length];
        x0 = Math.min(x0, a.x, b.x);
        x1 = Math.max(x1, a.x, b.x);
        z0 = Math.min(z0, a.z, b.z);
        z1 = Math.max(z1, a.z, b.z);
        const o = s * 4;
        if (boxes[o] > boxes[o + 1] || boxes[o + 2] > boxes[o + 3]) continue;
        i0 = Math.min(i0, boxes[o]);
        i1 = Math.max(i1, boxes[o + 1]);
        j0 = Math.min(j0, boxes[o + 2]);
        j1 = Math.max(j1, boxes[o + 3]);
      }
      for (let j = j0; j <= j1; j++) {
        const pz = ORIGIN + j * CELL;
        const oz = Math.max(z0 - pz, 0, pz - z1);
        for (let i = i0; i <= i1; i++) {
          const k = at(this.grid, i, j);
          const nearest = bound_mark[k] === pass ? bound[k] : this.held(edge, k);
          const radius = nearest + half - ROAD_HALF + Math.abs(nearest) * BOUND_SLACK + BOUND_GAP;
          if (radius > 0) {
            const ox = Math.max(x0 - ORIGIN - i * CELL, 0, ORIGIN + i * CELL - x1);
            if (ox * ox + oz * oz > radius * radius) continue;
          }
          const px = ORIGIN + i * CELL;
          for (let s = g; s < last; s++) {
            const o = s * 4;
            if (i < boxes[o] || i > boxes[o + 1] || j < boxes[o + 2] || j > boxes[o + 3]) continue;
            // The group's skip, per segment: a segment's box lies inside its group's, so the same bound holds.
            if (radius > 0) {
              const sx = Math.max(world[o] - px, 0, px - world[o + 1]);
              const sz = Math.max(world[o + 2] - pz, 0, pz - world[o + 3]);
              if (sx * sx + sz * sz > radius * radius) continue;
            }
            this.edge_vertex(edge, heights, s, i, j, k);
          }
        }
      }
    }
  }

  private shape(edge: RoadEdge, laid: number, segments: number): EdgeShape {
    const known = this.shapes?.get(edge);
    if (known && known.laid === laid) return known;
    const { points } = edge;
    const boxes = new Float64Array(segments * 4);
    for (let s = 0; s < segments; s++) {
      const a = points[s];
      const b = points[(s + 1) % points.length];
      boxes[s * 4] = Math.min(a.x, b.x);
      boxes[s * 4 + 1] = Math.max(a.x, b.x);
      boxes[s * 4 + 2] = Math.min(a.z, b.z);
      boxes[s * 4 + 3] = Math.max(a.z, b.z);
    }
    const shape = { laid, heights: this.mouths(edge, laid), boxes };
    this.shapes?.set(edge, shape);
    return shape;
  }

  // An earlier edge's flat band keeps its height under a later edge's mouth, while the mouth's own profile climbs on and
  // would stand a step at the band's rim. Each mouth instead meets the band's height at the rim and eases back to its
  // own profile. Works from the edges alone, never the grids, so a replay over any tile shapes it the same.
  private mouths(edge: RoadEdge, laid: number): Float64Array {
    const { points } = edge;
    const heights = Float64Array.from(points, (p) => p.y);
    if (edge.closed) return heights;
    const last = points.length - 1;
    const along = new Float64Array(points.length);
    for (let i = 1; i <= last; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dz = points[i].z - points[i - 1].z;
      along[i] = along[i - 1] + Math.sqrt(dx * dx + dz * dz);
    }
    // Inside a band each point takes the band's own height: a later road owns its asphalt off the earlier one's.
    const banded = new Float64Array(points.length).fill(NaN);
    const rim = (from: number, dir: number, stop: number) => {
      let at = -1;
      let band = 0;
      for (let i = from; i !== stop; i += dir) {
        const h = this.band_height(laid, points[i].x, points[i].z);
        if (h === null) break;
        at = i;
        band = h;
        banded[i] = h;
      }
      return { at, band };
    };
    // A road lying in a band end to end has one mouth, found from its start.
    const head = rim(0, 1, last + 1);
    const tail = rim(last, -1, head.at);
    // Each ease ends at the other mouth's rim, so neither moves the height the other meets.
    const mouths = [
      { ...head, run: (i: number) => along[i] - along[head.at], gap: along[tail.at < 0 ? last : tail.at] - along[head.at] },
      { ...tail, run: (i: number) => along[tail.at] - along[i], gap: along[tail.at] - along[Math.max(head.at, 0)] },
    ];
    for (const { at, band, run, gap } of mouths) {
      if (at < 0) continue;
      const step = band - points[at].y;
      // smoothstep's steepest is 1.5 times its mean.
      const ease = Math.max(CELL, Math.min(gap, Math.max(MOUTH_EASE_MIN, (1.5 * Math.abs(step)) / MOUTH_GRADE)));
      for (let i = 0; i <= last; i++) heights[i] += step * (1 - smoothstep(0, ease, run(i)));
    }
    for (let i = 0; i <= last; i++) if (!Number.isNaN(banded[i])) heights[i] = banded[i];
    return heights;
  }

  private lay(edge: RoadEdge) {
    const { points } = edge;
    const segments = edge.closed ? points.length : points.length - 1;
    const boxes = new Float64Array(Math.ceil(segments / GROUP) * 4);
    for (let s = 0; s < segments; s++) {
      const a = points[s];
      const b = points[(s + 1) % points.length];
      const o = Math.floor(s / GROUP) * 4;
      if (s % GROUP === 0) boxes.set([Infinity, -Infinity, Infinity, -Infinity], o);
      boxes[o] = Math.min(boxes[o], a.x, b.x);
      boxes[o + 1] = Math.max(boxes[o + 1], a.x, b.x);
      boxes[o + 2] = Math.min(boxes[o + 2], a.z, b.z);
      boxes[o + 3] = Math.max(boxes[o + 3], a.z, b.z);
    }
    this.laid.push(edge);
    this.laid_boxes.push(boxes);
  }

  /** The height of the nearest of the first `laid` edges whose flat band holds (x, z), or null past every band. */
  private band_height(laid: number, x: number, z: number): number | null {
    let best = ROAD_HALF + FLAT;
    let height: number | null = null;
    let street = false;
    for (let e = 0; e < laid; e++) {
      const { points, half, closed } = this.laid[e];
      const boxes = this.laid_boxes[e];
      const reach = best + half - ROAD_HALF;
      const segments = closed ? points.length : points.length - 1;
      for (let g = 0; g * 4 < boxes.length; g++) {
        const o = g * 4;
        if (x < boxes[o] - reach || x > boxes[o + 1] + reach || z < boxes[o + 2] - reach || z > boxes[o + 3] + reach) continue;
        for (let s = g * GROUP; s < Math.min(segments, (g + 1) * GROUP); s++) {
          const a = points[s];
          const b = points[(s + 1) % points.length];
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
          const ox = x - (a.x + dx * t);
          const oz = z - (a.z + dz * t);
          const d = Math.sqrt(ox * ox + oz * oz) - half + ROAD_HALF;
          if (d <= best) {
            best = d;
            height = a.y + (b.y - a.y) * t;
            street = this.laid[e].kind === "street";
          }
        }
      }
    }
    if (height === null || !street || !this.towns.length) return height;
    // A street's band is its town's plateau, which tilts across the street.
    const town = this.towns.reduce((a, b) => ((b.x - x) ** 2 + (b.z - z) ** 2 < (a.x - x) ** 2 + (a.z - z) ** 2 ? b : a));
    return town_level(town, x, z);
  }

  /** The distance below which `edge` would still write vertex k: past it the vertex keeps what it holds. */
  private held(edge: RoadEdge, k: number): number {
    const held = this.edge_of[k] !== edge.id && this.owner_dist[k] <= ROAD_HALF + FLAT;
    if (!held) return Math.max(this.terrain.road_dist[k], this.owner_dist[k]);
    return this.owner_dist[k] > ROAD_HALF ? Math.max(this.terrain.road_dist[k], ROAD_HALF) : this.terrain.road_dist[k];
  }

  // Each vertex's bound: what it holds, or the nearest of every GROUP-th segment whose box covers it when nearer.
  private bound_edge(edge: RoadEdge, boxes: Int32Array, segments: number) {
    const size = this.terrain.heights.length;
    if (this.bound.length !== size) {
      this.bound = new Float64Array(size);
      this.bound_mark = new Int32Array(size);
    }
    const pass = ++this.pass;
    const { bound, bound_mark } = this;
    const { points, half } = edge;
    for (let s = 0; s < segments; s += GROUP) {
      const a = points[s];
      const b = points[(s + 1) % points.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz || 1;
      const o = s * 4;
      for (let j = boxes[o + 2]; j <= boxes[o + 3]; j++)
        for (let i = boxes[o]; i <= boxes[o + 1]; i++) {
          const px = ORIGIN + i * CELL;
          const pz = ORIGIN + j * CELL;
          const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
          const ox = px - (a.x + dx * t);
          const oz = pz - (a.z + dz * t);
          const d = Math.sqrt(ox * ox + oz * oz) - half + ROAD_HALF;
          const k = at(this.grid, i, j);
          if (bound_mark[k] !== pass) {
            bound[k] = Math.min(d, this.held(edge, k));
            bound_mark[k] = pass;
          } else if (d < bound[k]) bound[k] = d;
        }
    }
  }

  private edge_vertex(edge: RoadEdge, heights: Float64Array, s: number, i: number, j: number, k: number) {
    const { road_dist } = this.terrain;
    const a = edge.points[s];
    const b = edge.points[(s + 1) % edge.points.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const px = ORIGIN + i * CELL;
    const pz = ORIGIN + j * CELL;
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
    const ox = px - (a.x + dx * t);
    const oz = pz - (a.z + dz * t);
    const d = Math.sqrt(ox * ox + oz * oz) - edge.half + ROAD_HALF;
    if (d < road_dist[k]) road_dist[k] = d;
    // An earlier edge's band holds the vertex, except where it is only that edge's shoulder and this edge's asphalt: a
    // road passing close by another would otherwise dip to the other's height in the middle of its own surface.
    const held = this.edge_of[k] !== edge.id && this.owner_dist[k] <= ROAD_HALF + FLAT && !(d <= ROAD_HALF && this.owner_dist[k] > ROAD_HALF);
    if (d < this.owner_dist[k] && !held) {
      this.owner_dist[k] = d;
      this.road_height[k] = heights[s] + (heights[(s + 1) % edge.points.length] - heights[s]) * t;
      this.edge_of[k] = edge.id;
      this.street[k] = edge.kind === "street" ? 1 : 0;
    }
  }

  // Fillets reach past every arm's surface, so their asphalt would grip like grass. Inside the outline and out to
  // RIM_REACH, road_dist follows the distance to the rim the way an edge's does to its side, so the field read between
  // vertices grips as asphalt up to the curb and keeps lots and trees as far from a curb as from a straight edge. The
  // ground there already lies within FLAT of an arm, so the arms' blend has levelled it.
  junction(outline: readonly { x: number; z: number }[]) {
    this.log({ kind: "junction", outline });
    const { road_dist } = this.terrain;
    const xs = outline.map((p) => p.x);
    const zs = outline.map((p) => p.z);
    const [i0, i1] = span_i(this.grid, Math.min(...xs) - RIM_REACH, Math.max(...xs) + RIM_REACH);
    const [j0, j1] = span_j(this.grid, Math.min(...zs) - RIM_REACH, Math.max(...zs) + RIM_REACH);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = at(this.grid, i, j);
        const x = ORIGIN + i * CELL;
        const z = ORIGIN + j * CELL;
        const d = rim_distance(outline, x, z);
        const signed = within(outline, x, z) ? ROAD_HALF - d : d < RIM_REACH ? ROAD_HALF + d : Infinity;
        if (signed < road_dist[k]) road_dist[k] = signed;
      }
  }

  blend(bank: Bank | null = null) {
    this.log({ kind: "blend", bank });
    const { heights } = this.terrain;
    const widest = bank ? Math.max(SHOULDER, bank.reach) : SHOULDER;
    for (let k = 0; k < heights.length; k++) {
      // Streets have a flat cross-section but the plateau under them tilts; the plateau is already the street surface.
      if (this.owner_dist[k] > ROAD_HALF + widest || this.street[k]) continue;
      // A bank widens with the height it closes, so a deep cut or tall fill eases out instead of standing as a wall.
      const span = bank ? Math.min(widest, Math.max(SHOULDER, FLAT + Math.abs(this.road_height[k] - heights[k]) * bank.run)) : SHOULDER;
      if (this.owner_dist[k] > ROAD_HALF + span) continue;
      const w = 1 - smoothstep(ROAD_HALF + FLAT, ROAD_HALF + span, this.owner_dist[k]);
      heights[k] += (this.road_height[k] - 0.05 - heights[k]) * w;
    }
  }

  /**
   * Brings the ground to the lines' heights: level `half` metres either side of a line, then held within a bank rising
   * one metre per `bank.run` metres out, so a cut or fill meets the dune at that slope and no steeper. Height only: the
   * surface and road distance stay.
   */
  bank(lines: readonly (readonly RoadPoint[])[], half: number, bank: Bank) {
    this.log({ kind: "bank", lines, half, bank });
    const { heights, road_dist } = this.terrain;
    const reach = half + bank.reach;
    // Every segment holds the ground inside its own wedge; the tightest of them wins, so where two stretches at different
    // heights pass near each other the bank stays as steep as one wedge, not a step between them.
    const lo = new Float32Array(heights.length).fill(-Infinity);
    const hi = new Float32Array(heights.length).fill(Infinity);
    // Within `half` of a line the nearest stretch alone sets the height: a line falling faster than its banks lean
    // would otherwise have its lower stretches drag its own bed down.
    const near = new Float32Array(heights.length).fill(Infinity);
    const level = new Float32Array(heights.length);
    const touched: number[] = [];
    for (const points of lines)
      for (let s = 0; s < points.length - 1; s++) {
        const a = points[s];
        const b = points[s + 1];
        const [i0, i1] = span_i(this.grid, Math.min(a.x, b.x) - reach, Math.max(a.x, b.x) + reach);
        const [j0, j1] = span_j(this.grid, Math.min(a.z, b.z) - reach, Math.max(a.z, b.z) + reach);
        if (i0 > i1 || j0 > j1) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len2 = dx * dx + dz * dz || 1;
        for (let j = j0; j <= j1; j++)
          for (let i = i0; i <= i1; i++) {
            const px = ORIGIN + i * CELL;
            const pz = ORIGIN + j * CELL;
            const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
            const ox = px - (a.x + dx * t);
            const oz = pz - (a.z + dz * t);
            const d = Math.sqrt(ox * ox + oz * oz);
            if (d >= reach) continue;
            const k = at(this.grid, i, j);
            const y = a.y + (b.y - a.y) * t;
            const lean = Math.max(0, d - half) / bank.run;
            if (hi[k] === Infinity) touched.push(k);
            lo[k] = Math.max(lo[k], y - lean);
            hi[k] = Math.min(hi[k], y + lean);
            if (d < near[k]) {
              near[k] = d;
              level[k] = y;
            }
          }
      }
    for (const k of touched) {
      const held = near[k] <= half ? level[k] : lo[k] > hi[k] ? (lo[k] + hi[k]) / 2 : Math.max(lo[k], Math.min(hi[k], heights[k]));
      heights[k] += (held - heights[k]) * road_guard(road_dist[k]);
    }
  }

  // Where lines overlap the nearest one owns a vertex, so a shared stretch is not blended twice.
  trail(lines: readonly TrailLine[]) {
    if (this.record) this.ops.push({ kind: "trail", lines: lines.map(({ points, blend }) => ({ points, blend: points.slice(1).map((_, i) => blend(i)) })) });
    const { heights, road_dist, surface } = this.terrain;
    const reach = TRAIL_HALF + TRAIL_SHOULDER;
    const dist = new Float32Array(heights.length).fill(Infinity);
    const target = new Float32Array(heights.length);
    const weight = new Float32Array(heights.length);
    const touched: number[] = [];
    for (const { points, blend } of lines)
      for (let s = 0; s < points.length - 1; s++) {
        const a = points[s];
        const b = points[s + 1];
        const [i0, i1] = span_i(this.grid, Math.min(a.x, b.x) - reach, Math.max(a.x, b.x) + reach);
        const [j0, j1] = span_j(this.grid, Math.min(a.z, b.z) - reach, Math.max(a.z, b.z) + reach);
        if (i0 > i1 || j0 > j1) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len2 = dx * dx + dz * dz || 1;
        const w = blend(s);
        for (let j = j0; j <= j1; j++)
          for (let i = i0; i <= i1; i++) {
            const px = ORIGIN + i * CELL;
            const pz = ORIGIN + j * CELL;
            const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
            const ox = px - (a.x + dx * t);
            const oz = pz - (a.z + dz * t);
            const d = Math.sqrt(ox * ox + oz * oz);
            const k = at(this.grid, i, j);
            if (d >= reach || d >= dist[k]) continue;
            if (dist[k] === Infinity) touched.push(k);
            dist[k] = d;
            target[k] = a.y + (b.y - a.y) * t;
            weight[k] = w;
          }
      }
    for (const k of touched) {
      heights[k] += (target[k] - heights[k]) * weight[k] * (1 - smoothstep(TRAIL_HALF, reach, dist[k])) * road_guard(road_dist[k]);
      if (dist[k] <= TRAIL_HALF + DIRT_MARGIN) surface[k] = SurfaceId.DIRT;
    }
  }
}

function road_guard(road_dist: number): number {
  return smoothstep(ROAD_HALF + FLAT, ROAD_HALF + SHOULDER, road_dist);
}

function within(outline: readonly { x: number; z: number }[], x: number, z: number): boolean {
  let inside = false;
  for (let a = 0, b = outline.length - 1; a < outline.length; b = a++) {
    const p = outline[a];
    const q = outline[b];
    if (p.z > z !== q.z > z && x < ((q.x - p.x) * (z - p.z)) / (q.z - p.z) + p.x) inside = !inside;
  }
  return inside;
}

function rim_distance(outline: readonly { x: number; z: number }[], x: number, z: number): number {
  let best = Infinity;
  for (let a = 0, b = outline.length - 1; a < outline.length; b = a++) {
    const p = outline[b];
    const q = outline[a];
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (z - p.z) * dz) / (dx * dx + dz * dz || 1)));
    const ox = x - (p.x + dx * t);
    const oz = z - (p.z + dz * t);
    best = Math.min(best, ox * ox + oz * oz);
  }
  return Math.sqrt(best);
}

import { harden, type BiomeCuts } from "./biomes";
import { carve } from "./canyon";
import { at, span_i, span_j, WHOLE, type Grid } from "./field";
import { smoothstep } from "./noise";
import type { Bank, TerrainRecipe } from "./recipe";
import { pad, type Crossing } from "./trails";
import { town_level } from "./towns";
import { soak, water_index, type Water } from "./water";
import { CELL, ORIGIN, ROAD_HALF, SHOULDER, SurfaceId, type Canyon, type RoadEdge, type RoadPoint, type Terrain, type Town } from "./types";

// Past `core` plus two cells every vertex a lot corner can touch is fully on the plane; the plane then eases back to
// terrain over PLATEAU_BLEND.
const PLATEAU_EDGE = CELL * 2;
const PLATEAU_BLEND = 40;
// A terrain triangle touching a road or pad has vertices up to CELL * sqrt(2) outside it; flattening that far keeps it
// under the surface mesh.
const FLAT = 6;
export const TRAIL_HALF = 4;
const TRAIL_SHOULDER = 6;
/** Dirt reaches this far past the trail half: the surface grid is read at the nearest vertex, up to CELL / 2 away. */
const DIRT_MARGIN = 1.5;
/**
 * Metres past a junction patch's rim its distance still writes road_dist: a cell past every rule that reads road_dist
 * (up to ROAD_HALF + SHOULDER), so where the patch field gives way to the edges' lies beyond what any rule sees.
 */
const RIM_REACH = SHOULDER + CELL;

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
  | { kind: "plateau"; town: Town }
  | { kind: "edge"; edge: RoadEdge; bank: Bank | null }
  | { kind: "junction"; outline: readonly { x: number; z: number }[] }
  | { kind: "blend"; bank: Bank | null }
  | { kind: "pad"; crossing: Crossing }
  | { kind: "trail"; lines: { points: readonly RoadPoint[]; blend: number[] }[] }
  | { kind: "harden"; cuts: BiomeCuts; floor: number | null }
  | { kind: "water"; water: Water };

export type GroundBase = { kind: "terrain"; seed: number; shape: TerrainRecipe } | { kind: "flat"; height: number; road_dist: number };

export interface GroundPlan {
  base: GroundBase;
  ops: GroundOp[];
}

export class Stamp {
  private readonly road_height: Float32Array;
  readonly owner_dist: Float32Array;
  readonly edge_of: Int32Array;
  /** 1 where the owning edge is a town street, whose height is the town plane. */
  readonly street: Uint8Array;
  /** Every write so far, for `replay` over a tile; empty when not recording. */
  readonly ops: GroundOp[] = [];

  constructor(
    private readonly terrain: Terrain,
    private readonly grid: Grid = WHOLE,
    private readonly record = true,
  ) {
    this.road_height = new Float32Array(terrain.heights.length);
    this.edge_of = new Int32Array(terrain.heights.length).fill(-1);
    this.owner_dist = new Float32Array(terrain.heights.length).fill(1e9);
    this.street = new Uint8Array(terrain.heights.length);
  }

  replay(op: GroundOp) {
    if (op.kind === "carve") this.carve(op.canyon);
    else if (op.kind === "plateau") this.plateau(op.town);
    else if (op.kind === "edge") this.edge(op.edge, op.bank);
    else if (op.kind === "junction") this.junction(op.outline);
    else if (op.kind === "blend") this.blend(op.bank);
    else if (op.kind === "pad") this.pad(op.crossing);
    else if (op.kind === "trail") this.trail(op.lines.map(({ points, blend }) => ({ points, blend: (i) => blend[i] })));
    else if (op.kind === "water") this.water(op.water);
    else this.harden(op.cuts, op.floor);
  }

  private log(op: GroundOp) {
    if (this.record) this.ops.push(op);
  }

  carve(canyon: Canyon) {
    this.log({ kind: "carve", canyon });
    carve(this.terrain.heights, canyon, this.grid);
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

  plateau(town: Town) {
    this.log({ kind: "plateau", town });
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

  // Edges stamp in priority order (circuit, streets, spurs, roads between towns). A later edge never takes height over
  // another edge's flat band, so a spur meeting the sloped circuit merges into its surface instead of cutting a step
  // across it.
  edge(edge: RoadEdge, bank: Bank | null = null) {
    this.log({ kind: "edge", edge, bank });
    const { road_dist } = this.terrain;
    const { points, half } = edge;
    const reach = half + (bank ? Math.max(SHOULDER, bank.reach) : SHOULDER);
    const segments = edge.closed ? points.length : points.length - 1;
    for (let s = 0; s < segments; s++) {
      const a = points[s];
      const b = points[(s + 1) % points.length];
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
          const d = Math.sqrt(ox * ox + oz * oz) - half + ROAD_HALF;
          const k = at(this.grid, i, j);
          if (d < road_dist[k]) road_dist[k] = d;
          const owned = this.edge_of[k] !== edge.id && this.owner_dist[k] <= ROAD_HALF + FLAT;
          if (d < this.owner_dist[k] && !owned) {
            this.owner_dist[k] = d;
            this.road_height[k] = a.y + (b.y - a.y) * t;
            this.edge_of[k] = edge.id;
            this.street[k] = edge.kind === "street" ? 1 : 0;
          }
        }
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
      const guard = smoothstep(ROAD_HALF + FLAT, ROAD_HALF + SHOULDER, road_dist[k]);
      heights[k] += (target[k] - heights[k]) * weight[k] * (1 - smoothstep(TRAIL_HALF, reach, dist[k])) * guard;
      if (dist[k] <= TRAIL_HALF + DIRT_MARGIN) surface[k] = SurfaceId.DIRT;
    }
  }
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

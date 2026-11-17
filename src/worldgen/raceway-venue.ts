import { hypot } from "../sim-math";
import { sample } from "./field";
import { BAY, BAY_DEPTH, GRAVEL_NEAR, lane_edges, MODULE, PIT_FRONT, runs, side_index, STAND_FRONT, stand_depth, WALL, type Layout } from "./raceway-layout";
import { CELL, type RoadPoint, type Solid } from "./types";

export const WALL_HEIGHT = 1.1;
export const WALL_HALF = 0.25;
export const RAIL_HEIGHT = 0.85;
const RAIL_HALF = 0.15;
export const TYRE_HEIGHT = 1.1;
export const TYRE_HALF = 0.42;
/** Road points a barrier box spans: 4 m, a chord a centimetre off the tightest railed bend. */
const SPAN = 2;
const OVERLAP = 0.1;
export const STAND_BASE = 1.2;
export const STAND_RISE = 0.8;
export const STAND_BACK = 1.4;
export const BAY_HEIGHT = 4.4;
export const GANTRY_HEIGHT = 9.8;
const GANTRY_POST = 0.7;
/** Metres past a piece that stay clear of trees: a crown's reach and the tree grid's cell. */
const CLEAR = 6;
/** Share of its width from which the lane is laid as firm ground: narrower, the paint would cover more verge than lane. */
const LANE_FIRM = 0.5;

export type Disc = readonly [x: number, z: number, radius: number];

const offset = (p: RoadPoint, off: number): [number, number] => [p.x - p.tz * off, p.z + p.tx * off];

function box_on(heights: Float32Array, x: number, z: number, hw: number, hd: number, fx: number, fz: number, top: number): Extract<Solid, { kind: "box" }> {
  let low = sample(heights, x, z);
  const middle = low;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) low = Math.min(low, sample(heights, x + sx * hw * fz + sz * hd * fx, z - sx * hw * fx + sz * hd * fz));
  return { kind: "box", x, y: low, z, hw, hd, cos: fz, sin: fx, height: top + middle - low };
}

/** A run of barrier as the pieces it is built and drawn in: pairs of road points SPAN apart, the last pair what is left. */
export function spans(run: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < run.length - 1; k += SPAN) out.push([run[k], run[Math.min(k + SPAN, run.length - 1)]]);
  return out;
}

function chain(road: readonly RoadPoint[], heights: Float32Array, line: Float32Array, side: number, half: number, height: number, out: Solid[], soft: boolean) {
  for (const run of runs(line))
    for (const [a, b] of spans(run)) {
      const [ax, az] = offset(road[a], side * line[a]);
      const [bx, bz] = offset(road[b], side * line[b]);
      const length = hypot(bx - ax, bz - az);
      const box = box_on(heights, (ax + bx) / 2, (az + bz) / 2, half, length / 2 + OVERLAP, (bx - ax) / length, (bz - az) / length, height);
      out.push(soft ? { ...box, soft: true } : box);
    }
}

export function venue_solids(road: readonly RoadPoint[], layout: Layout, heights: Float32Array): Solid[] {
  const n = road.length;
  const at = (s: number) => road[((s % n) + n) % n];
  const out: Solid[] = [];
  for (const side of [-1, 1]) {
    const i = side_index(side);
    chain(road, heights, layout.concrete[i], side, WALL_HALF, WALL_HEIGHT, out, false);
    chain(road, heights, layout.armco[i], side, RAIL_HALF, RAIL_HEIGHT, out, false);
    chain(road, heights, layout.tyres[i], side, TYRE_HALF, TYRE_HEIGHT, out, true);
  }
  const depth = stand_depth(layout.tiers);
  for (const s of layout.stands) {
    const p = at(s);
    const [x, z] = offset(p, -layout.inside * (STAND_FRONT + depth / 2));
    out.push(box_on(heights, x, z, depth / 2, MODULE / 2, p.tx, p.tz, STAND_BASE + (layout.tiers - 1) * STAND_RISE + STAND_BACK));
  }
  for (const s of layout.bays) {
    const p = at(s);
    const [x, z] = offset(p, layout.inside * (PIT_FRONT + BAY_DEPTH / 2));
    out.push(box_on(heights, x, z, BAY_DEPTH / 2, BAY / 2, p.tx, p.tz, BAY_HEIGHT));
  }
  for (const side of [-1, 1]) {
    const [x, z] = offset(road[0], side * WALL);
    out.push({ kind: "circle", x, y: sample(heights, x, z), z, radius: GANTRY_POST, height: GANTRY_HEIGHT });
  }
  return out;
}

/**
 * Lines `Stamp.paint` lays gravel along with half 0, one every CELL out from the trap's near edge. A line paints a cell
 * either side and the ground fades a cell further, so each is laid only where the trap runs that far past it: drawn one
 * line deeper, the gravel spilled through the tyre wall in 4 m teeth.
 */
export function gravel_lines(road: readonly RoadPoint[], layout: Layout): RoadPoint[][] {
  const out: RoadPoint[][] = [];
  for (const side of [-1, 1]) {
    const depth = layout.gravel[side_index(side)];
    for (let lane = 1; ; lane++) {
      const line = depth.map((d) => (d >= (lane + 1) * CELL - 1 ? GRAVEL_NEAR + lane * CELL : NaN));
      const found = runs(line);
      if (!found.length) break;
      for (const run of found) out.push(run.map((s) => along(road[s], side * line[s])));
    }
  }
  return out;
}

export function lane_lines(road: readonly RoadPoint[], layout: Layout): RoadPoint[][] {
  const line = layout.lane.map((share) => (share >= LANE_FIRM ? (lane_edges(share)[0] + lane_edges(share)[1]) / 2 : NaN));
  return runs(line).map((run) => run.map((s) => along(road[s], layout.inside * line[s])));
}

function along(p: RoadPoint, off: number): RoadPoint {
  const [x, z] = offset(p, off);
  return { ...p, x, z };
}

export function venue_discs(road: readonly RoadPoint[], layout: Layout): Disc[] {
  const n = road.length;
  const at = (s: number) => road[((s % n) + n) % n];
  const out: Disc[] = [];
  for (const side of [-1, 1]) {
    const i = side_index(side);
    for (let s = 0; s < n; s++) {
      const far = Math.max(layout.concrete[i][s] || 0, layout.armco[i][s] || 0);
      if (far > 0) out.push([...offset(road[s], side * far), CLEAR]);
    }
  }
  const depth = stand_depth(layout.tiers);
  for (const s of layout.stands) out.push([...offset(at(s), -layout.inside * (STAND_FRONT + depth / 2)), hypot(MODULE, depth) / 2 + CLEAR]);
  for (const s of layout.bays) out.push([...offset(at(s), layout.inside * (PIT_FRONT + BAY_DEPTH / 2)), hypot(BAY, BAY_DEPTH) / 2 + CLEAR]);
  return out;
}

import { mulberry32, sub } from "../rng";
import { sample, up } from "./field";
import { circle16, length } from "./noise";
import { CELL, N, ORIGIN, ROAD_HALF, SIZE, PropKind, type Prop, type RoadEdge, type RoadPoint, type Solid, type Terrain, type Town } from "./types";

export const MAST_HEIGHT = 32;
export const LIGHTHOUSE_HEIGHT = 20;
export const TURBINE_HEIGHT = 28;
export const ROTOR_RADIUS = 12;
export const ARCH_CLEARANCE = 7.5;
export const ARCH_THICK = 3;
export const ARCH_LEG = 1.8;

const SIGHT_EYES = 32;
const SIGHT_RANGE = 650;
const SIGHT_STEP = 8;
const EYE = 1.5;
const KEEP_OFF_ROAD = 25;
const TOWN_MARGIN = 40;
const EDGE_MARGIN = 80;
// Landmarks spread over the island so each one marks a different part of it.
const SPREAD = 300;

const MAST_RADIUS = 3;
const LIGHTHOUSE_RADIUS = 2.6;
const LIGHTHOUSE_LOW = 4;
const LIGHTHOUSE_HIGH = 18;
const SEA_REACH = [40, 80, 140, 220, 320];
const SEA_OPEN = 0.4;
const SEA_PROBE = 140;
const SEA_SHORTLIST = 60;
// Open sea only breaks ties: a lighthouse nobody on the circuit sees marks nothing.
const SEA_WEIGHT = 0.25;
const GRID = 4;

const RIDGE_MIN = 70;
const RIDGE_FALLBACK = 50;
const RIDGE_ARM = 6;
const RIDGE_DROP = 1.5;
const RIDGE_AXES = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];
const TURBINE_RADIUS = 1.4;
const TURBINES = 5;
const TURBINE_MIN = 3;
const TURBINE_GAP = [50, 90];
const TURBINE_TURN = 0.5;
const TURBINE_STARTS = 30;
const TURBINE_PEAK_CLEAR = 320;

const ARCH_END = 40;
const ARCH_STEP = 3;
const ARCH_STRAIGHT = 10;
const ARCH_TURN = 0.97;
const ARCH_GAP = 3;
const ARCH_GROUND = 4;

interface Spot {
  x: number;
  z: number;
  clear: number;
}

export interface Landmarks {
  props: Prop[];
  solids: Solid[];
}

function in_town(towns: Town[], x: number, z: number, margin: number): boolean {
  return towns.some((t) => length(t.x - x, t.z - z) < t.radius + margin);
}

function eyes(road: RoadPoint[]): RoadPoint[] {
  return Array.from({ length: SIGHT_EYES }, (_, i) => road[Math.floor((i * road.length) / SIGHT_EYES)]);
}

export function seen(heights: Float32Array, from: RoadPoint[], x: number, z: number, top: number): number {
  let count = 0;
  for (const e of from) {
    const dx = x - e.x;
    const dz = z - e.z;
    const dist = length(dx, dz);
    if (dist > SIGHT_RANGE) continue;
    const ey = e.y + EYE;
    const steps = Math.floor(dist / SIGHT_STEP);
    let clear = true;
    for (let s = 1; s < steps && clear; s++) {
      const t = s / steps;
      if (sample(heights, e.x + dx * t, e.z + dz * t) > ey + (top - ey) * t) clear = false;
    }
    if (clear) count++;
  }
  return count;
}

export class LandmarkPlanner {
  readonly out: Landmarks = { props: [], solids: [] };
  private readonly spots: Spot[] = [];
  private readonly heights: Float32Array;
  private readonly road_dist: Float32Array;
  private readonly eyes: RoadPoint[];
  private readonly next: () => number;

  constructor(
    seed: number,
    land: Terrain,
    road: RoadPoint[],
    private readonly towns: Town[],
  ) {
    this.heights = land.heights;
    this.road_dist = land.road_dist;
    this.eyes = eyes(road);
    this.next = mulberry32(sub(seed, "landmarks"));
  }

  private open(x: number, z: number, spread = 0): boolean {
    const edge = SIZE / 2 - EDGE_MARGIN;
    return (
      Math.abs(x) < edge &&
      Math.abs(z) < edge &&
      sample(this.road_dist, x, z) > KEEP_OFF_ROAD &&
      !in_town(this.towns, x, z, TOWN_MARGIN) &&
      !this.spots.some((s) => length(s.x - x, s.z - z) < s.clear + KEEP_OFF_ROAD + spread)
    );
  }

  private put(kind: PropKind, x: number, z: number, fx: number, fz: number, height: number, clear: number, radius: number) {
    const y = sample(this.heights, x, z);
    this.out.props.push({ kind, x, y, z, angle: Math.atan2(fx, fz), scale: 1 });
    this.out.solids.push({ kind: "circle", x, y, z, radius, height });
    this.spots.push({ x, z, clear });
  }

  private *grid(): Generator<{ x: number; z: number; y: number }> {
    for (let j = 0; j <= N; j += GRID)
      for (let i = 0; i <= N; i += GRID)
        yield {
          x: ORIGIN + i * CELL,
          z: ORIGIN + j * CELL,
          y: this.heights[j * (N + 1) + i],
        };
  }

  mast() {
    let best: { x: number; z: number; y: number } | null = null;
    for (const p of this.grid()) if ((!best || p.y > best.y) && this.open(p.x, p.z)) best = p;
    if (!best) return;
    const { x, z } = best;
    this.put(PropKind.MAST, x, z, 0, 1, MAST_HEIGHT, 8, MAST_RADIUS);
  }

  lighthouse() {
    const dirs = circle16();
    const shore: {
      x: number;
      z: number;
      open: number;
      fx: number;
      fz: number;
    }[] = [];
    for (const { x, z, y } of this.grid()) {
      if (y < LIGHTHOUSE_LOW || y > LIGHTHOUSE_HIGH || up(this.heights, x, z) < 0.8 || !this.open(x, z)) continue;
      if (dirs.filter(([dx, dz]) => sample(this.heights, x + dx * SEA_PROBE, z + dz * SEA_PROBE) < 0).length < dirs.length * SEA_OPEN) continue;
      let wet = 0;
      let fx = 0;
      let fz = 0;
      for (const [dx, dz] of dirs)
        for (const reach of SEA_REACH)
          if (sample(this.heights, x + dx * reach, z + dz * reach) < 0) {
            wet++;
            fx += dx;
            fz += dz;
          }
      const open = wet / (dirs.length * SEA_REACH.length);
      if (open >= SEA_OPEN) shore.push({ x, z, open, fx, fz });
    }
    shore.sort((a, b) => b.open - a.open);
    let best: {
      x: number;
      z: number;
      fx: number;
      fz: number;
      score: number;
    } | null = null;
    for (const s of shore.slice(0, SEA_SHORTLIST)) {
      const y = sample(this.heights, s.x, s.z);
      const score = s.open * SIGHT_EYES * SEA_WEIGHT + seen(this.heights, this.eyes, s.x, s.z, y + LIGHTHOUSE_HEIGHT);
      if (!best || score > best.score) best = { ...s, score };
    }
    if (!best) return;
    const d = length(best.fx, best.fz) || 1;
    this.put(PropKind.LIGHTHOUSE, best.x, best.z, best.fx / d, best.fz / d, LIGHTHOUSE_HEIGHT, 8, LIGHTHOUSE_RADIUS);
  }

  // A crest point is higher than both neighbours RIDGE_ARM cells away along at least one of four axes; turbines chain
  // along crest points in a roughly straight line, every chain grown greedily from one of the highest crest points.
  turbines() {
    const mast = this.out.props.find((p) => p.kind === PropKind.MAST);
    const crest = (min: number, spread: number) => {
      const out: { x: number; z: number; y: number }[] = [];
      const reach = RIDGE_ARM * CELL;
      for (const { x, z, y } of this.grid()) {
        if (y < min || up(this.heights, x, z) < 0.75 || !this.open(x, z, spread)) continue;
        if (mast && length(mast.x - x, mast.z - z) < TURBINE_PEAK_CLEAR) continue;
        const h = (ax: number, az: number) => sample(this.heights, x + ax * reach, z + az * reach);
        if (RIDGE_AXES.some(([ax, az]) => y > h(ax, az) + RIDGE_DROP && y > h(-ax, -az) + RIDGE_DROP)) out.push({ x, z, y });
      }
      return out.sort((a, b) => b.y - a.y);
    };
    let points = crest(RIDGE_MIN, SPREAD);
    if (points.length < TURBINE_MIN) points = crest(RIDGE_FALLBACK, SPREAD);
    if (points.length < TURBINE_MIN) points = crest(RIDGE_FALLBACK, 0);
    let best: (typeof points)[number][] = [];
    for (const start of points.slice(0, TURBINE_STARTS)) {
      const chain = [start];
      while (chain.length < TURBINES) {
        const last = chain[chain.length - 1];
        const prev = chain.length > 1 ? chain[chain.length - 2] : null;
        const step = points.find((p) => {
          const d = length(p.x - last.x, p.z - last.z);
          if (d < TURBINE_GAP[0] || d > TURBINE_GAP[1]) return false;
          if (chain.some((c) => length(c.x - p.x, c.z - p.z) < TURBINE_GAP[0])) return false;
          if (!prev) return true;
          const pd = length(last.x - prev.x, last.z - prev.z);
          return ((p.x - last.x) * (last.x - prev.x) + (p.z - last.z) * (last.z - prev.z)) / (d * pd) > TURBINE_TURN;
        });
        if (!step) break;
        chain.push(step);
      }
      if (chain.length > best.length || (chain.length === best.length && chain.reduce((s, c) => s + c.y, 0) > best.reduce((s, c) => s + c.y, 0))) best = chain;
      if (best.length === TURBINES) break;
    }
    const [fx, fz] = circle16()[Math.floor(this.next() * 16)];
    for (const p of best) this.put(PropKind.TURBINE, p.x, p.z, fx, fz, TURBINE_HEIGHT, ROTOR_RADIUS, TURBINE_RADIUS);
  }

  private arch_spot(edges: RoadEdge[], spread: number) {
    let best: { p: RoadPoint; half: number; score: number } | null = null;
    for (const edge of edges) {
      if (edge.kind !== "highway" || edge.closed) continue;
      const pts = edge.points;
      const span = edge.half + ARCH_GAP + ARCH_LEG;
      for (let i = ARCH_END; i < pts.length - ARCH_END; i += ARCH_STEP) {
        const p = pts[i];
        const a = pts[i - ARCH_STRAIGHT];
        const b = pts[i + ARCH_STRAIGHT];
        if (a.tx * b.tx + a.tz * b.tz < ARCH_TURN) continue;
        if (in_town(this.towns, p.x, p.z, TOWN_MARGIN)) continue;
        const legs = [-1, 1].map((side) => [p.x - p.tz * side * span, p.z + p.tx * side * span]);
        if (legs.some(([x, z]) => Math.abs(sample(this.heights, x, z) - p.y) > ARCH_GROUND || sample(this.road_dist, x, z) < ROAD_HALF + ARCH_LEG + 1)) continue;
        if (this.spots.some((s) => length(s.x - p.x, s.z - p.z) < s.clear + span + KEEP_OFF_ROAD + spread)) continue;
        const score = seen(this.heights, this.eyes, p.x, p.z, p.y + ARCH_CLEARANCE + ARCH_THICK);
        if (!best || score > best.score) best = { p, half: span, score };
      }
    }
    return best;
  }

  arch(edges: RoadEdge[]) {
    const best = this.arch_spot(edges, SPREAD) ?? this.arch_spot(edges, 0);
    if (!best) return;
    const { p, half } = best;
    this.out.props.push({
      kind: PropKind.ARCH,
      x: p.x,
      y: p.y,
      z: p.z,
      angle: Math.atan2(p.tx, p.tz),
      scale: half,
    });
    this.spots.push({ x: p.x, z: p.z, clear: half + ARCH_LEG + 2 });
    for (const side of [-1, 1]) {
      const x = p.x - p.tz * side * half;
      const z = p.z + p.tx * side * half;
      this.out.solids.push({
        kind: "circle",
        x,
        y: sample(this.heights, x, z),
        z,
        radius: ARCH_LEG,
        height: p.y + ARCH_CLEARANCE + ARCH_THICK - sample(this.heights, x, z),
      });
    }
    this.out.solids.push({
      kind: "box",
      x: p.x,
      y: p.y,
      z: p.z,
      hw: half + ARCH_LEG,
      hd: ARCH_LEG,
      cos: p.tz,
      sin: p.tx,
      height: ARCH_CLEARANCE + ARCH_THICK,
      bottom: ARCH_CLEARANCE,
    });
  }

  blocks(x: number, z: number, r: number): boolean {
    return this.spots.some((s) => length(s.x - x, s.z - z) < s.clear + r);
  }
}

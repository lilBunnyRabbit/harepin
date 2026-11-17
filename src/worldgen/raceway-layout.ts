import { atan2, hypot } from "../sim-math";
import { ROAD_HALF, type RoadPoint } from "./types";

// Where a raceway's venue goes, worked out from the lap alone: worldgen builds its solids and ground from this
// (raceway-venue.ts), and the scene draws the same layout from the world's road (worlds/raceway-stadium.ts).

const REACH = 6;
const STEP = 2;
const BEND = 450;
const HAIRPIN_RADIUS = 48;
const HAIRPIN_TURN = 2;
const SLOW_RADIUS = 72;
const KEEP = ROAD_HALF + 4;
const ROOM_MAX = 40;
const NEIGHBOUR = 70;
export const GRAVEL_NEAR = ROAD_HALF + 1.2;
export const WALL = ROAD_HALF + 2.8;
const BEND_WALL = ROAD_HALF + 10;
/** Road points of straight that take a wall: 300 m. */
const LONG_STRAIGHT = 150;
const TYRE_DEPTH = 5;
const BACKING = 1.8;
const TYRE_GAP = 1.1;
export const BAYS = 10;
export const BAY = 6;
export const BAY_DEPTH = 9;
export const MODULE = 20;
export const TIER = 1.7;
export const STAND_FRONT = WALL + 3.2;
export const PIT_FRONT = ROAD_HALF + 12.4;
const LANE_NEAR = ROAD_HALF + 3.4;
const LANE_FAR = ROAD_HALF + 11.4;
const LANE_PAD = 16;
const LANE_TAPER = 25;
export const PIT_CENTRE = 10;

export type CornerKind = "hairpin" | "slow" | "fast";

const TRAP_DEPTH: Record<CornerKind, number> = { hairpin: 14, slow: 9, fast: 0 };

export interface Bend {
  from: number;
  to: number;
  sign: number;
  radius: number;
  kind: CornerKind;
  apex: number;
}

export interface Stand {
  modules: number;
  tiers: number;
}

type Sides = [Float32Array, Float32Array];

export interface Layout {
  n: number;
  bends: Bend[];
  /** The side the lap turns toward on the whole, where the pits stand: +1 or -1, as an offset along (-tz, tx). */
  inside: number;
  /** Per side (`side_index`) and road point: the trap's depth out from GRAVEL_NEAR, 0 where there is none. */
  gravel: Sides;
  /** Per side and road point, metres off the centre a barrier's middle stands; NaN where there is none. */
  concrete: Sides;
  armco: Sides;
  tyres: Sides;
  lane: Float32Array;
  /** Road point of each terrace module's middle (negative: before the line), on the side away from the pits. */
  stands: number[];
  tiers: number;
  bays: number[];
}

/** The pit lane's near and far edge, metres off the centre, where it is `share` of its full width: it peels off the road's edge. */
export const lane_edges = (share: number): [number, number] => [ROAD_HALF - 0.1 + share * (LANE_NEAR - ROAD_HALF + 0.1), ROAD_HALF + share * (LANE_FAR - ROAD_HALF)];
export const side_index = (side: number) => (side > 0 ? 1 : 0);
export const stand_depth = (tiers: number) => 1 + tiers * TIER + 0.6;

export function curvatures(road: readonly RoadPoint[]): Float32Array {
  const n = road.length;
  const k = new Float32Array(n);
  for (let s = 0; s < n; s++) {
    const a = road[(s - REACH + n) % n];
    const b = road[(s + REACH) % n];
    k[s] = atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz) / (2 * REACH * STEP);
  }
  return k;
}

function bends_of(k: Float32Array): Bend[] {
  const n = k.length;
  const out: Bend[] = [];
  let open: { from: number; sign: number; peak: number; apex: number; turn: number } | null = null;
  const close = (to: number) => {
    if (!open) return;
    const radius = 1 / open.peak;
    const kind: CornerKind = radius < HAIRPIN_RADIUS && open.turn > HAIRPIN_TURN ? "hairpin" : radius < SLOW_RADIUS ? "slow" : "fast";
    out.push({ from: open.from, to, sign: open.sign, radius, kind, apex: open.apex });
    open = null;
  };
  for (let s = 0; s < n; s++) {
    const bent = Math.abs(k[s]) > 1 / BEND;
    const sign = Math.sign(k[s]);
    if (open && (!bent || sign !== open.sign)) close(s - 1);
    if (!bent) continue;
    open ??= { from: s, sign, peak: 0, apex: s, turn: 0 };
    open.turn += Math.abs(k[s]) * STEP;
    if (Math.abs(k[s]) > open.peak) {
      open.peak = Math.abs(k[s]);
      open.apex = s;
    }
  }
  close(n - 1);
  return out;
}

function rooms(road: readonly RoadPoint[]): Sides {
  const n = road.length;
  const cell = 16;
  const cells = new Map<number, number[]>();
  const key = (x: number, z: number) => Math.floor(x / cell) * 8192 + Math.floor(z / cell);
  road.forEach((p, s) => {
    const list = cells.get(key(p.x, p.z));
    if (list) list.push(s);
    else cells.set(key(p.x, p.z), [s]);
  });
  const near = (x: number, z: number, s: number) => {
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        for (const j of cells.get(key(x + dx * cell, z + dz * cell)) ?? []) {
          if (Math.min(Math.abs(j - s), n - Math.abs(j - s)) < NEIGHBOUR) continue;
          if (hypot(road[j].x - x, road[j].z - z) < KEEP) return true;
        }
    return false;
  };
  const out: Sides = [new Float32Array(n), new Float32Array(n)];
  for (const side of [-1, 1])
    for (let s = 0; s < n; s++) {
      const p = road[s];
      let room = ROOM_MAX;
      for (let off = KEEP; off <= ROOM_MAX; off += 2)
        if (near(p.x - p.tz * off * side, p.z + p.tx * off * side, s)) {
          room = off - 2;
          break;
        }
      out[side_index(side)][s] = room;
    }
  return out;
}

function smooth_set(values: Float32Array, reach: number): Float32Array {
  const n = values.length;
  const out = new Float32Array(n).fill(NaN);
  for (let s = 0; s < n; s++) {
    if (Number.isNaN(values[s])) continue;
    let sum = 0;
    let count = 0;
    for (let d = -reach; d <= reach; d++) {
      const v = values[(s + d + n) % n];
      if (Number.isNaN(v)) continue;
      sum += v;
      count++;
    }
    out[s] = sum / count;
  }
  return out;
}

function smooth_zero(values: Float32Array, reach: number): Float32Array {
  const n = values.length;
  const out = new Float32Array(n);
  for (let s = 0; s < n; s++) {
    let sum = 0;
    for (let d = -reach; d <= reach; d++) sum += values[(s + d + n) % n];
    out[s] = sum / (2 * reach + 1);
  }
  return out;
}

export function runs(line: Float32Array): number[][] {
  const n = line.length;
  const gap = line.findIndex((v) => Number.isNaN(v));
  if (gap < 0) return [[...line.keys(), 0]];
  const out: number[][] = [];
  let run: number[] = [];
  for (let d = 1; d <= n; d++) {
    const s = (gap + d) % n;
    if (!Number.isNaN(line[s])) {
      run.push(s);
      continue;
    }
    if (run.length > 1) out.push(run);
    run = [];
  }
  return out;
}

export function layout_of(road: readonly RoadPoint[], stand: Stand): Layout {
  const n = road.length;
  const wrap = (s: number) => ((s % n) + n) % n;
  const k = curvatures(road);
  const bends = bends_of(k);
  let turned = 0;
  for (const v of k) turned += v;
  const inside = Math.sign(turned) || 1;
  const room = rooms(road);
  const straight = (s: number) => Math.abs(k[wrap(s)]) <= 1 / BEND;
  let pit_back = 0;
  while (pit_back < n / 2 && straight(-pit_back - 1)) pit_back++;
  let pit_ahead = 0;
  while (pit_ahead < n / 2 && straight(pit_ahead + 1)) pit_ahead++;

  const lane = new Float32Array(n);
  const half = (BAYS * BAY) / 2 + LANE_PAD;
  for (let d = -Math.ceil((half + LANE_TAPER * STEP) / STEP); d * STEP <= half + LANE_TAPER * STEP; d++) {
    const along = Math.abs(d * STEP);
    lane[wrap(PIT_CENTRE + d)] = along <= half ? 1 : Math.max(0, 1 - (along - half) / (LANE_TAPER * STEP));
  }

  const raw: Sides = [new Float32Array(n), new Float32Array(n)];
  for (const bend of bends) {
    const depth = TRAP_DEPTH[bend.kind];
    if (!depth) continue;
    const side = side_index(-bend.sign);
    for (let s = bend.from - 22; s <= bend.to + 10; s++) raw[side][wrap(s)] = Math.max(raw[side][wrap(s)], depth);
  }
  const gravel = raw.map((values, i) => {
    const eased = smooth_zero(smooth_zero(values, 8), 8);
    for (let s = 0; s < n; s++) {
      const fits = room[i][s] - GRAVEL_NEAR - 3;
      eased[s] = lane[s] > 0 && i === side_index(inside) ? 0 : Math.max(0, Math.min(eased[s], fits));
      if (eased[s] < 1.5) eased[s] = 0;
    }
    return eased;
  }) as Sides;

  const unset = (): Sides => [new Float32Array(n).fill(NaN), new Float32Array(n).fill(NaN)];
  const walls = unset();
  const rails = unset();
  const run_of = new Int32Array(n);
  for (let s = 0, start = 0; s <= n; s++) {
    if (s < n && straight(s)) continue;
    for (let j = start; j < s; j++) run_of[j] = s - start;
    start = s + 1;
  }
  const on_bend = new Int8Array(n);
  for (const bend of bends) for (let s = bend.from - 8; s <= bend.to + 8; s++) on_bend[wrap(s)] = -bend.sign;
  const pit_run = (s: number) => s <= pit_ahead || s >= n - pit_back;
  for (const side of [-1, 1]) {
    const i = side_index(side);
    for (let s = 0; s < n; s++) {
      const pits = i === side_index(inside) && lane[s] > 0;
      if (pits) {
        if (lane[s] === 1) walls[i][s] = WALL;
        continue;
      }
      if (gravel[i][s] > 0) {
        walls[i][s] = GRAVEL_NEAR + gravel[i][s] + BACKING;
        continue;
      }
      if (on_bend[s] === side) {
        if (room[i][s] >= BEND_WALL + 1) rails[i][s] = BEND_WALL;
        continue;
      }
      if (on_bend[s] !== 0 || !straight(s)) continue;
      if ((run_of[s] >= LONG_STRAIGHT || pit_run(s)) && room[i][s] >= WALL + 1) walls[i][s] = WALL;
    }
  }
  const concrete = walls.map((line) => smooth_set(smooth_set(line, 8), 8)) as Sides;
  // Off the smoothed wall, not the trap's edge: smoothing pulls the wall in at a trap's shoulders, through tyres set off the gravel.
  const tyres = concrete.map((line, i) => line.map((off, s) => (gravel[i][s] >= TYRE_DEPTH ? off - TYRE_GAP : NaN))) as Sides;

  const across = side_index(-inside);
  const stands: number[] = [];
  for (let m = 0; m < stand.modules; m++) {
    const s = PIT_CENTRE + Math.round((m - (stand.modules - 1) / 2) * (MODULE / STEP));
    if (s <= pit_ahead - 5 && s >= -pit_back + 5 && room[across][wrap(s)] >= STAND_FRONT + stand_depth(stand.tiers)) stands.push(s);
  }
  const bays = Array.from({ length: BAYS }, (_, b) => PIT_CENTRE + Math.round((b - (BAYS - 1) / 2) * (BAY / STEP)));
  return { n, bends, inside, gravel, concrete, armco: rails.map((line) => smooth_set(line, 4)) as Sides, tyres, lane, stands, tiers: stand.tiers, bays };
}

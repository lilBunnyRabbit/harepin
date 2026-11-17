import { Vector3 } from "three";
import { Scrape } from "../car/car";
import type { Triple } from "../car/cars";
import type { Collider } from "../world/world";
import { ROAD_HALF, type RoadPoint } from "../worldgen/types";
import { atan2 } from "../sim-math";

export interface LineGround {
  height(x: number, z: number, y?: number): number;
  touches(car: Collider, gap: number): number;
}

const LATERAL = 0.5;
const ALONG = 2;
/**
 * Metres a ground sample stands off the mean of the ones BASE rows (m) before and after it, past what the road's middle
 * sample does across the same row, to count as a step. A one-sided 25 cm hump launched a car at 38 m/s (seed 9); the
 * ripples that cross the whole road lift both sides at once and are no step.
 */
const STEP = 0.1;
const BASE = 2;
/** Metres the car's body keeps off a step and off a solid. */
const STEP_GAP = 0.5;
const SOLID_GAP = 0.8;
/** Road points either side a hazard holds the car off for: its nose and tail reach about one each way. */
const DILATE = 1;
/** Road points inside which a car cannot swap sides of the road: bands that far apart with no lane in common are no passage. */
const SWERVE = 5;
/** Metres over the road a probe stands: a deck or a beam overhead is neither ground nor a wall. */
const PROBE_LIFT = 0.5;
const PROBE_BAND: [number, number] = [0.25, 0.9];
const PROBE_INERTIA: Triple = [1, 1, 1];
const FREE = 0;
const OUT = 1;
const HIT = 2;

/** Per road point, the lateral band (m off the centre, along the right normal) a car's centre keeps inside to stay off the road's steps and solids. */
export interface Hazards {
  readonly lo: Float64Array;
  readonly hi: Float64Array;
  /** 1 where no band is clear and a step is among what blocks it: the car has to take the step. */
  readonly step: Uint8Array;
}

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/**
 * Samples the ground across the road at each point that may leave the centre (`free`), for a car of `half_width` m: a
 * step is ground that rises or drops along the road by STEP more than the rest of its row, a solid one the car's body
 * comes within SOLID_GAP of. Each point's band is the clear run nearest `prefer` (m off the centre): where the line runs free of them.
 */
export function hazards(road: readonly RoadPoint[], free: Uint8Array, half_width: number, ground: LineGround, prefer: Float64Array): Hazards {
  const n = road.length;
  const reach = ROAD_HALF - half_width;
  const lanes = 2 * Math.round(ROAD_HALF / LATERAL) + 1;
  const mid = lanes >> 1;
  const rows = n * ALONG;
  const h = new Float64Array(rows * lanes);
  for (let r = 0; r < rows; r++) {
    const i = Math.floor(r / ALONG);
    if (!free[i] && !free[wrap(i - 1, n)] && !free[wrap(i + 1, n)]) continue;
    const f = (r % ALONG) / ALONG;
    const p = road[i];
    const q = road[wrap(i + 1, n)];
    const x = p.x + (q.x - p.x) * f;
    const z = p.z + (q.z - p.z) * f;
    const y = p.y + (q.y - p.y) * f + PROBE_LIFT;
    for (let l = 0; l < lanes; l++) {
      const lat = (l - mid) * LATERAL;
      h[r * lanes + l] = ground.height(x + p.tz * lat, z - p.tx * lat, y);
    }
  }
  const stepped = new Uint8Array(n * lanes);
  const solid = new Uint8Array(n * lanes);
  const probe = {
    pos: new Vector3(),
    vel: new Vector3(),
    ang: new Vector3(),
    heading: 0,
    scrape: new Scrape(),
    spec: { mass: 1, inertia: PROBE_INERTIA, circles: [0], radius: half_width, band: PROBE_BAND },
  } satisfies Collider;
  const span = Math.ceil((half_width + STEP_GAP) / LATERAL);
  const dev = new Float64Array(lanes);
  const sorted = new Float64Array(lanes);
  for (let i = 0; i < n; i++) {
    if (!free[i]) continue;
    for (let k = 0; k < ALONG; k++) {
      const r = i * ALONG + k;
      const before = wrap(r - BASE, rows) * lanes;
      const after = wrap(r + BASE, rows) * lanes;
      for (let l = 0; l < lanes; l++) dev[l] = h[r * lanes + l] - (h[before + l] + h[after + l]) / 2;
      sorted.set(dev);
      sorted.sort();
      const middle = sorted[mid];
      for (let l = 0; l < lanes; l++) {
        if (Math.abs(dev[l] - middle) <= STEP) continue;
        for (let c = Math.max(0, l - span); c <= Math.min(lanes - 1, l + span); c++) stepped[i * lanes + c] = 1;
      }
    }
    const p = road[i];
    probe.heading = atan2(p.tx, p.tz);
    for (let l = 0; l < lanes; l++) {
      const lat = (l - mid) * LATERAL;
      if (Math.abs(lat) > reach) continue;
      probe.pos.set(p.x + p.tz * lat, p.y + PROBE_LIFT, p.z - p.tx * lat);
      if (ground.touches(probe, SOLID_GAP) > 0) solid[i * lanes + l] = 1;
    }
  }
  const lo = new Float64Array(n).fill(-reach);
  const hi = new Float64Array(n).fill(reach);
  const step = new Uint8Array(n);
  const blocked = new Uint8Array(lanes);
  for (let i = 0; i < n; i++) {
    if (!free[i]) continue;
    let any = false;
    for (let l = 0; l < lanes; l++) {
      blocked[l] = Math.abs((l - mid) * LATERAL) > reach ? OUT : FREE;
      for (let d = -DILATE; d <= DILATE && blocked[l] === FREE; d++) {
        const j = wrap(i + d, n) * lanes + l;
        if (stepped[j] | solid[j]) blocked[l] = HIT;
      }
      any ||= blocked[l] === HIT;
    }
    if (!any) continue;
    const want = mid + prefer[i] / LATERAL;
    let best_a = -1;
    let best_b = -1;
    let best_miss = Infinity;
    for (let a = 0; a < lanes; a++) {
      if (blocked[a] !== FREE) continue;
      let b = a;
      while (b + 1 < lanes && blocked[b + 1] === FREE) b++;
      const miss = Math.max(0, a - want, want - b);
      if (miss < best_miss) {
        best_miss = miss;
        best_a = a;
        best_b = b;
      }
      a = b;
    }
    if (best_a < 0) {
      for (let d = -DILATE; d <= DILATE; d++) for (let l = 0; l < lanes; l++) step[i] |= stepped[wrap(i + d, n) * lanes + l];
      continue;
    }
    lo[i] = (best_a - mid) * LATERAL;
    hi[i] = (best_b - mid) * LATERAL;
  }
  // Bands that share no lane within SWERVE road points leave no way through: a car does not cross the road in a few
  // metres. The ground rippled 20 cm at the foot of a dip, each point's clear run fell on another side and the line
  // zigzagged 8 m across the road, planned at 9 m/s (seed 1). Such a run of steps is taken as one across the road is.
  const narrowed = (i: number) => lo[i] > -reach || hi[i] < reach;
  const held = (i: number) => narrowed(i) || step[i] === 1;
  for (let i = 0; i < n; i++) {
    if (!narrowed(i)) continue;
    let to = -1;
    for (let d = 1; d <= SWERVE && held(wrap(i + d, n)); d++) {
      const j = wrap(i + d, n);
      if (narrowed(j) && (lo[j] > hi[i] || hi[j] < lo[i])) to = j;
    }
    if (to < 0) continue;
    let from = i;
    while (from !== to && held(wrap(from - 1, n))) from = wrap(from - 1, n);
    while (to !== from && held(wrap(to + 1, n))) to = wrap(to + 1, n);
    let walled = false;
    for (let k = from; ; k = wrap(k + 1, n)) {
      for (let l = 0; l < lanes; l++) walled ||= solid[k * lanes + l] === 1;
      if (k === to) break;
    }
    if (walled) continue;
    for (let k = from; ; k = wrap(k + 1, n)) {
      lo[k] = -reach;
      hi[k] = reach;
      step[k] = 1;
      if (k === to) break;
    }
  }
  return { lo, hi, step };
}

import { mulberry32, sub } from "../rng";
import { at, sample, span_i, span_j, WHOLE, type Grid } from "./field";
import { hash, length, smoothstep } from "./noise";
import { chaikin, resample, type Path } from "./path";
import { CELL, ORIGIN, SIZE, type Canyon, type RoadPoint } from "./types";

const GRID = 16;
/** Start on the summit flank at this share of the peak's height: high enough to fall a long way, never the top. */
const FLANK = 0.6;
const WOBBLE = 4;
/** Metres of height a step outward from the peak is worth: enough to carry the line across a basin to the sea. */
const PULL = 0.5;
const SEA = 2;
const MIN_LENGTH = 300;
/** Past this the descent is wandering across a basin, not falling to the coast. */
const MAX_LENGTH = 1400;
const MAX_STEPS = 200;
/** The floor stays this far above sea level, so it is drivable and never flickers against the water. */
const FLOOR_ABOVE_SEA = 3.5;
/** A crossing with the circuit needs this much straight road either side: the causeway reads as one there. */
const CROSS_STRAIGHT = 60;
const CROSS_TURN = 0.15;
const STEP = 4;

export function peak(heights: Float32Array): [number, number, number] {
  let best = 0;
  for (let k = 1; k < heights.length; k++) if (heights[k] > heights[best]) best = k;
  const n = SIZE / CELL + 1;
  return [ORIGIN + (best % n) * CELL, ORIGIN + Math.floor(best / n) * CELL, heights[best]];
}

function descend(heights: Float32Array, x: number, z: number, dx: number, dz: number, seed: number, outlet: number): Path {
  const path: Path = [[x, z]];
  const seen = new Set<number>();
  let i = Math.round((x - ORIGIN) / GRID);
  let j = Math.round((z - ORIGIN) / GRID);
  for (let s = 0; s < MAX_STEPS; s++) {
    seen.add(i * 4096 + j);
    let best: [number, number] | null = null;
    let best_h = Infinity;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if ((!di && !dj) || seen.has((i + di) * 4096 + j + dj)) continue;
        const px = ORIGIN + (i + di) * GRID;
        const pz = ORIGIN + (j + dj) * GRID;
        if (Math.abs(px) > SIZE / 2 - GRID || Math.abs(pz) > SIZE / 2 - GRID) continue;
        const h = sample(heights, px, pz) + hash(i + di, j + dj, seed) * WOBBLE - PULL * GRID * (di * dx + dj * dz);
        if (h < best_h) [best, best_h] = [[i + di, j + dj], h];
      }
    if (!best) break;
    [i, j] = best;
    const px = ORIGIN + i * GRID;
    const pz = ORIGIN + j * GRID;
    path.push([px, pz]);
    if (sample(heights, px, pz) < outlet) break;
  }
  return path;
}

function run(path: Path): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += length(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return total;
}

function crosses(a: [number, number], b: [number, number], p: RoadPoint, q: RoadPoint): boolean {
  const d1 = (b[0] - a[0]) * (p.z - a[1]) - (b[1] - a[1]) * (p.x - a[0]);
  const d2 = (b[0] - a[0]) * (q.z - a[1]) - (b[1] - a[1]) * (q.x - a[0]);
  const d3 = (q.x - p.x) * (a[1] - p.z) - (q.z - p.z) * (a[0] - p.x);
  const d4 = (q.x - p.x) * (b[1] - p.z) - (q.z - p.z) * (b[0] - p.x);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function crossings(points: Path, road: readonly RoadPoint[]): number[] {
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const out: number[] = [];
  for (let r = 0; r < road.length; r++) {
    const p = road[r];
    if (p.x < x0 - STEP || p.x > x1 + STEP || p.z < z0 - STEP || p.z > z1 + STEP) continue;
    for (let c = 1; c < points.length; c++) if (crosses(points[c - 1], points[c], p, road[(r + 1) % road.length])) out.push(r);
  }
  return out;
}

function straight(road: readonly RoadPoint[], at: number): boolean {
  const n = road.length;
  const span = CROSS_STRAIGHT / 2;
  const a = road[(at - span + n) % n];
  for (let k = -span; k <= span; k++) {
    const p = road[(at + k + n) % n];
    if (Math.abs(a.tx * p.tz - a.tz * p.tx) > CROSS_TURN) return false;
  }
  return true;
}

/**
 * 0-1 canyon per seed: down the steepest way from the summit flank to ground under `outlet` (the coast, or a desert
 * basin), crossing the circuit at most once and only on a straight, where the road stamp later fills a causeway.
 */
export function plan_canyon(seed: number, heights: Float32Array, road: readonly RoadPoint[], outlet = SEA, tries = 24): Canyon | null {
  const next = mulberry32(sub(seed, "canyon"));
  const [px, pz, top] = peak(heights);
  for (let t = 0; t < tries; t++) {
    const angle = next() * Math.PI * 2;
    const dx = Math.sin(angle);
    const dz = Math.cos(angle);
    let r = 0;
    while (r < SIZE / 2 && sample(heights, px + dx * r, pz + dz * r) > top * FLANK) r += GRID;
    const coarse = descend(heights, px + dx * r, pz + dz * r, dx, dz, seed + t, outlet);
    if (sample(heights, coarse[coarse.length - 1][0], coarse[coarse.length - 1][1]) >= outlet) continue;
    const points = resample(chaikin(coarse, 3), STEP, false);
    const metres = run(points);
    if (metres < MIN_LENGTH || metres > MAX_LENGTH) continue;
    const cross = crossings(points, road);
    if (cross.length > 1 || (cross.length === 1 && !straight(road, cross[0]))) continue;
    return { points, depth: 7 + next() * 5, floor: 6 + next() * 4, wall: 6 + next() * 4 };
  }
  return null;
}

/** Cuts the canyon into `heights`: `depth` under the floor, easing out over the walls, never below FLOOR_ABOVE_SEA. */
export function carve(heights: Float32Array, canyon: Canyon, grid: Grid = WHOLE) {
  const { points, depth, floor, wall } = canyon;
  const reach = floor + wall;
  const cut = new Float32Array(heights.length);
  for (let s = 1; s < points.length; s++) {
    const [ax, az] = points[s - 1];
    const [bx, bz] = points[s];
    const [i0, i1] = span_i(grid, Math.min(ax, bx) - reach, Math.max(ax, bx) + reach);
    const [j0, j1] = span_j(grid, Math.min(az, bz) - reach, Math.max(az, bz) + reach);
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const x = ORIGIN + i * CELL;
        const z = ORIGIN + j * CELL;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
        const d = length(x - (ax + dx * t), z - (az + dz * t));
        const k = at(grid, i, j);
        cut[k] = Math.max(cut[k], depth * (1 - smoothstep(floor, reach, d)));
      }
  }
  for (let k = 0; k < heights.length; k++) {
    if (!cut[k] || heights[k] <= FLOOR_ABOVE_SEA) continue;
    heights[k] = Math.max(FLOOR_ABOVE_SEA, heights[k] - cut[k]);
  }
}

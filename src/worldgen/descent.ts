import { mulberry32, sub } from "../rng";
import { plan_gully } from "./canyon";
import { plan_falls } from "./falls";
import { sample } from "./field";
import { length } from "./noise";
import { limit_grade, resample, road_points, smooth, type Path } from "./path";
import type { DescentRecipe } from "./recipe";
import { MIN_RADIUS, tightest } from "./route";
import { descent_stack, HAIRPIN_RADIUS, type Switchback } from "./switchback";
import { ROAD_HALF, SPUR_GRADE, type Canyon, type RoadPoint } from "./types";

const TRIES = 24;
/** The gully's pull off the fall line, as (cos, sin): straight down the flank is too steep for a road above its foot. */
const TURNS = [
  [1, 0],
  [0.7, 0.7],
  [0.7, -0.7],
  [0.5, 0.87],
  [0.5, -0.87],
  [0.26, 0.97],
  [0.26, -0.97],
] as const;
const STEP = 2;
/** Points of the stack's straight tail the gully redraws, so the turn into it is smoothed. */
const LEAD = 12;
/** The grade is held exactly, never smoothed after, so it sits just under the world check's SPUR_GRADE. */
const GRADE = SPUR_GRADE - 0.01;
const HAIRPIN_GRADE = 0.07;
const HAIRPIN_REACH = 8;
const FLOOR = 3.5;
/** Most the road may stand over or sink under the gully floor before it reads as an embankment. */
const FILL_MAX = 6;
const RING_CLEAR = ROAD_HALF * 2 + 8;
/** Ring points either side of the join the descent may come near: it leaves the ring there. */
const RING_SKIP = 60;

export interface Descent {
  join: number;
  /** Index into `points` where the gully takes over from the stack. */
  from: number;
  stack: Switchback;
  gully: Canyon;
  points: RoadPoint[];
}

// Off the side away from the ring's middle: the ground inside can fall too, into a crater.
function outward(ring: readonly RoadPoint[], p: RoadPoint): [number, number] {
  let cx = 0;
  let cz = 0;
  for (const q of ring) {
    cx += q.x;
    cz += q.z;
  }
  cx /= ring.length;
  cz /= ring.length;
  return (p.x - cx) * -p.tz + (p.z - cz) * p.tx > 0 ? [-p.tz, p.tx] : [p.tz, -p.tx];
}

function clear_of(ring: readonly RoadPoint[], join: number, path: Path): boolean {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [x, z] of path) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  const n = ring.length;
  for (let r = 0; r < n; r++) {
    const q = ring[r];
    if (q.x < x0 - RING_CLEAR || q.x > x1 + RING_CLEAR || q.z < z0 - RING_CLEAR || q.z > z1 + RING_CLEAR) continue;
    if (Math.min((r - join + n) % n, (join - r + n) % n) < RING_SKIP) continue;
    for (const [x, z] of path) if (length(q.x - x, q.z - z) < RING_CLEAR) return false;
  }
  return true;
}

/** Road heights from `start` down the stack and the gully floor, held to grade; null when the descent can't hold it. */
function heights_of(heights: Float32Array, path: Path, stack: Switchback, gully: Canyon, from: number, start: number): number[] | null {
  const n = path.length;
  const run = path.slice(1).map(([x, z], i) => length(x - path[i][0], z - path[i][1]));
  const ground = path.map(([x, z], i) => (i < from ? sample(heights, x, z) : Math.max(FLOOR, sample(heights, x, z) - gully.depth)));
  const hairpins = stack.bends.filter((b) => b.radius === HAIRPIN_RADIUS);
  const grade = path.map(([x, z]) => (hairpins.some((b) => length(b.x - x, b.z - z) < b.radius + HAIRPIN_REACH) ? HAIRPIN_GRADE : GRADE));
  let room = 0;
  for (let i = 0; i < n - 1; i++) room += grade[i] * run[i];
  const end = ground[n - 1];
  if (start - end > room) return null;
  const ys = limit_grade(
    smooth(ground, 8, 3, false).map((y, i) => (i === 0 ? start : i === n - 1 ? end : y)),
    run,
    grade,
  );
  for (let i = from; i < n; i++) if (Math.abs(ys[i] - ground[i]) > FILL_MAX) return null;
  // The walk leaves rounding on the pinned ends; the first point is the ring's own, which the junction matches exactly.
  ys[0] = start;
  return ys;
}

/**
 * A one-way road off the ring at `join` down to the sea: a hairpin stack down the flank, then a gully. The stack takes
 * the fewest hairpins the recipe lists that bring it low enough for the gully to hold a road's grade.
 */
export function plan_descent(seed: number, heights: Float32Array, ring: readonly RoadPoint[], recipe: DescentRecipe, free: (at: number) => boolean): Descent | null {
  for (let attempt = 0; attempt < (recipe.attempts ?? 1); attempt++) {
    const found = attempt_descent(seed, attempt, heights, ring, recipe, free);
    if (found) return found;
  }
  return null;
}

// Attempt 0 draws as the descent always has; each later one salts the joins and the gullies afresh.
function attempt_descent(seed: number, attempt: number, heights: Float32Array, ring: readonly RoadPoint[], recipe: DescentRecipe, free: (at: number) => boolean): Descent | null {
  const n = ring.length;
  const offset = Math.floor(mulberry32(sub(seed, attempt ? `descent:${attempt}` : "descent"))() * n);
  const gully_seed = attempt ? sub(seed, `gully:${attempt}`) : seed;
  for (const count of recipe.stacks)
    for (let k = 0; k < TRIES; k++) {
      let join = (offset + Math.floor((k * n) / TRIES)) % n;
      for (let step = 0; step < n / TRIES && !free(join); step++) join = (join + 1) % n;
      if (!free(join)) continue;
      const p = ring[join];
      const down = outward(ring, p);
      const stack = descent_stack(heights, [p.x, p.z], down, count);
      if (!stack || !clear_of(ring, join, stack.points)) continue;
      const lead = stack.points.slice(-LEAD);
      for (const [c, s] of TURNS) {
        const gully = plan_gully(gully_seed + k, heights, lead, down[0] * c - down[1] * s, down[1] * c + down[0] * s, recipe.outlet, recipe.tries, recipe.bed?.stride);
        if (!gully || !clear_of(ring, join, gully.points)) continue;
        const path = resample([...stack.points.slice(0, -LEAD), ...gully.points], STEP, false);
        const from = path.findIndex(([x, z]) => length(x - gully.points[0][0], z - gully.points[0][1]) < STEP);
        const ys = heights_of(heights, path, stack, gully, from, p.y);
        if (!ys) continue;
        const points = road_points(path, ys, false);
        if (tightest(points) < MIN_RADIUS || tightest(points.slice(from)) < (recipe.bed?.radius ?? 0)) continue;
        // A bed with falls takes only a descent with room for one.
        if (!recipe.bed || plan_falls(points.slice(from), recipe.bed.falls).jumps.length) return { join, from, stack, gully, points };
      }
    }
  return null;
}

const NEAR_CELL = 16;

/** Whether (x, z) lies within `reach` of a point of `line`, binned on a grid so a whole-map sweep stays cheap. `reach` is at most NEAR_CELL. */
export function near_line(line: readonly RoadPoint[], reach: number): (x: number, z: number) => boolean {
  const cells = new Map<number, RoadPoint[]>();
  const key = (i: number, j: number) => i * 4096 + j;
  for (const p of line) {
    const k = key(Math.floor(p.x / NEAR_CELL), Math.floor(p.z / NEAR_CELL));
    const cell = cells.get(k);
    if (cell) cell.push(p);
    else cells.set(k, [p]);
  }
  return (x, z) => {
    if (!cells.size) return false;
    const i = Math.floor(x / NEAR_CELL);
    const j = Math.floor(z / NEAR_CELL);
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++)
        for (const p of cells.get(key(i + di, j + dj)) ?? []) if ((p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < reach * reach) return true;
    return false;
  };
}

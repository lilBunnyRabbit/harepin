import { sub } from "../rng";
import { sample } from "./field";
import { circle24, fbm, length } from "./noise";
import { ISLAND, type RoadRecipe } from "./recipe";
import { HAIRPIN_RADIUS, inside, switchback, type Switchback } from "./switchback";
import { CELL, N, ORIGIN, type RoadPoint } from "./types";

const ROAD_MIN_RADIUS = 32;
const ROAD_ATTEMPTS = 16;
const RADIUS_SPAN = 5;
const STEP = 2;
/** Lowest ground a control point may sit on; the coast attractor aims between this and COAST_HIGH. */
const COAST_LOW = 6;
const COAST_HIGH = 12;
const COAST_AIM = 9;
const COAST_REACH = 400;
/** Height the control nearest the summit climbs to. */
const SUMMIT_FLANK = 90;
/** Steepest mean climb from the ring to the hairpin; past it the road could only reach the flank in a deep cut. */
const FLANK_GRADE = 0.14;
const FLANK_MIN = 120;
/** Ring controls this close to the stack's footprint give way to it. */
const STACK_CLEAR = 60;
/** Fallback hairpin: a half circle of controls this far from its centre, apex on the flank. */
const TONGUE_RADIUS = 45;
/** Straight legs into and out of the tongue, in TONGUE_RADIUS, so the half circle starts tangent to the road. */
const TONGUE_LEG = 2;
const TONGUE: [number, number][] = [
  [-TONGUE_LEG, -1],
  [0, -1],
  [Math.SQRT1_2, -Math.SQRT1_2],
  [1, 0],
  [Math.SQRT1_2, Math.SQRT1_2],
  [0, 1],
  [-TONGUE_LEG, 1],
];
const ATTRACT_STEP = 4;
/** Controls on either side of the summit one that the coast attractor leaves alone. */
const SUMMIT_KEEP = 3;
const ROAD_GRADE = 0.12;
/** Open road near a bend: steeper, braking downhill into the bend at 40 m/s unsettles the rear. */
const BEND_GRADE = 0.09;
/** Switchback legs, driven at hairpin pace. */
const CLIMB_GRADE = 0.12;
const HAIRPIN_GRADE = 0.06;
/** Road within this much of a hairpin's arc counts as the hairpin for its grade. */
const HAIRPIN_REACH = 8;
/** Crests tighter than this (m) get eased: v²/g = 180 m lifts the wheels only past 42 m/s, the top of most straights. */
const CREST_RADIUS = 180;
const CREST_PASSES = 60;
/**
 * Within BEND_REACH points of a bend under BEND_RADIUS the road gets BEND_CREST and BEND_GRADE: a car unloaded over a
 * crest or braking downhill can't also turn in, and spins.
 */
const BEND_RADIUS = 400;
const BEND_CREST = 400;
const BEND_REACH = 40;
/** Closest two stretches of the loop may come, centre to centre, unless they are neighbours along it. */
const LOOP_CLEARANCE = 40;
const CLEARANCE_ARC = 60;
const CLEARANCE_STRIDE = 4;
const RELAX = 0.35;
const RELAX_TRIES = 40;
/** Nudges without a wider tightest bend before the attempt gives up: the pinch is not one a nudge can fix. */
const RELAX_STALL = 4;

export type Path = [number, number][];

export function resample(dense: Path, step: number, closed: boolean): Path {
  const out: Path = [dense[0]];
  let carry = 0;
  const count = closed ? dense.length : dense.length - 1;
  for (let i = 1; i <= count; i++) {
    const a = dense[i - 1];
    const b = dense[i % dense.length];
    const len = length(b[0] - a[0], b[1] - a[1]);
    let from = 0;
    while (carry + len - from >= step) {
      from += step - carry;
      carry = 0;
      const t = from / len;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    carry += len - from;
  }
  const last = out[out.length - 1];
  const end = closed ? out[0] : dense[dense.length - 1];
  if (length(end[0] - last[0], end[1] - last[1]) < step * 0.5) out.pop();
  if (!closed) out.push(end);
  return out;
}

// Centripetal Catmull-Rom (knot spacing sqrt of the chord): unevenly spaced controls, as the hairpin makes next to the
// ring, neither cusp nor loop. sqrt(sqrt(d²)) keeps the knots IEEE-exact.
function catmull(points: Path, step: number): Path {
  const dense: Path = [];
  const n = points.length;
  const knot = (a: [number, number], b: [number, number]) => Math.sqrt(Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]))) || 1e-6;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const t1 = knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    const steps = 4 + Math.ceil(length(p2[0] - p1[0], p2[1] - p1[1]) / 2);
    for (let s = 0; s < steps; s++) {
      const t = t1 + ((t2 - t1) * s) / steps;
      const w1 = t / t1;
      const w2 = (t - t1) / (t2 - t1);
      const w3 = (t - t2) / (t3 - t2);
      const a1x = p0[0] + (p1[0] - p0[0]) * w1;
      const a1z = p0[1] + (p1[1] - p0[1]) * w1;
      const a2x = p1[0] + (p2[0] - p1[0]) * w2;
      const a2z = p1[1] + (p2[1] - p1[1]) * w2;
      const a3x = p2[0] + (p3[0] - p2[0]) * w3;
      const a3z = p2[1] + (p3[1] - p2[1]) * w3;
      const b1 = t / t2;
      const b2 = (t - t1) / (t3 - t1);
      const b1x = a1x + (a2x - a1x) * b1;
      const b1z = a1z + (a2z - a1z) * b1;
      const b2x = a2x + (a3x - a2x) * b2;
      const b2z = a2z + (a3z - a2z) * b2;
      dense.push([b1x + (b2x - b1x) * w2, b1z + (b2z - b1z) * w2]);
    }
  }
  return resample(dense, step, true);
}

export function chaikin(points: Path, passes: number): Path {
  let out = points;
  for (let pass = 0; pass < passes; pass++) {
    const next: Path = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const [ax, az] = out[i];
      const [bx, bz] = out[i + 1];
      next.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

function highest(heights: Float32Array): [number, number] {
  let best = 0;
  for (let k = 1; k < heights.length; k++) if (heights[k] > heights[best]) best = k;
  return [ORIGIN + (best % (N + 1)) * CELL, ORIGIN + Math.floor(best / (N + 1)) * CELL];
}

/** Walks from `from` toward `to` in ATTRACT_STEP steps, up to `reach` and short of `to`, until `done`. */
function walk(heights: Float32Array, from: [number, number], to: [number, number], reach: number, done: (y: number, d: number) => boolean): [number, number] | null {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = length(dx, dz) || 1;
  for (let d = 0; d <= Math.min(reach, len - ATTRACT_STEP); d += ATTRACT_STEP) {
    const x = from[0] + (dx / len) * d;
    const z = from[1] + (dz / len) * d;
    if (done(sample(heights, x, z), d)) return [x, z];
  }
  return null;
}

interface Controls {
  points: Path;
  /** Controls [fixed, fixed + fixed_count) shape the summit section; relaxing leaves them alone. */
  fixed: number;
  fixed_count: number;
  stack: Switchback | null;
}

// Two noise frequencies give both long sweepers and tight pinches. The attractors then pull single controls: one out to
// the shore for a sea-view stretch, and the one nearest the summit, which becomes the switchback stack up its face or,
// where the face has no room, a single hairpin tongue.

function loop_controls(seed: number, heights: Float32Array, summit: [number, number], shape: RoadRecipe): Controls {
  const { radius, swing: reach, min, max } = shape.loop;
  const controls: Path = circle24().map(([c, s]) => {
    const swing = fbm(c * 3, s * 3, seed) - 0.5 + (fbm(c * 9, s * 9, seed + 5) - 0.5) * 0.5;
    const r = Math.max(min, Math.min(max, radius + swing * reach));
    return walk(heights, [c * r, s * r], [0, 0], r, (y) => y >= COAST_LOW) ?? [0, 0];
  });
  const n = controls.length;
  let top = 0;
  for (let i = 1; i < n; i++)
    if (length(controls[i][0] - summit[0], controls[i][1] - summit[1]) < length(controls[top][0] - summit[0], controls[top][1] - summit[1])) top = i;

  let shore = -1;
  let shore_at: [number, number] = [0, 0];
  let shore_d = Infinity;
  for (let i = 0; i < n; i++) {
    if (Math.min((i - top + n) % n, (top - i + n) % n) <= SUMMIT_KEEP) continue;
    const [x, z] = controls[i];
    const r = length(x, z) || 1;
    const out: [number, number] = [(x / r) * (r + COAST_REACH), (z / r) * (r + COAST_REACH)];
    const hit = walk(heights, controls[i], out, COAST_REACH, (y) => y <= COAST_HIGH);
    if (!hit) continue;
    const d = length(hit[0] - x, hit[1] - z);
    if (d < shore_d) {
      shore = i;
      shore_d = d;
      shore_at = hit;
    }
  }
  if (shore >= 0) {
    const [x, z] = shore_at;
    if (sample(heights, x, z) < COAST_LOW) {
      const r = length(x, z);
      let lo = r - ATTRACT_STEP;
      let hi = r;
      for (let k = 0; k < 8; k++) {
        const mid = (lo + hi) / 2;
        if (sample(heights, (x / r) * mid, (z / r) * mid) >= COAST_AIM) lo = mid;
        else hi = mid;
      }
      shore_at = [(x / r) * lo, (z / r) * lo];
    }
    controls[shore] = shore_at;
  }

  const prev = controls[(top - 1 + n) % n];
  const next = controls[(top + 1) % n];
  const ring: [number, number] = [next[0] - prev[0], next[1] - prev[1]];
  for (const count of shape.stacks) {
    const stack = switchback(heights, controls[top], summit, ring, count);
    if (!stack) continue;
    let from = top;
    let to = top;
    while (to - from < n - 2 && inside(stack, ...controls[(from - 1 + n) % n], STACK_CLEAR)) from--;
    while (to - from < n - 2 && inside(stack, ...controls[(to + 1) % n], STACK_CLEAR)) to++;
    const kept = Array.from({ length: n - (to - from + 1) }, (_, k) => controls[(to + 1 + k) % n]);
    return { points: [...stack.points, ...kept], fixed: 0, fixed_count: stack.points.length, stack };
  }

  const base = sample(heights, controls[top][0], controls[top][1]);
  const flank = walk(heights, controls[top], summit, Infinity, (y, d) => y >= SUMMIT_FLANK || (d >= FLANK_MIN && y - base > FLANK_GRADE * d)) ?? controls[top];
  const ux = summit[0] - flank[0];
  const uz = summit[1] - flank[1];
  const ul = length(ux, uz) || 1;
  const side = ring[0] * -uz + ring[1] * ux < 0 ? -1 : 1;
  const u: [number, number] = [ux / ul, uz / ul];
  const t: [number, number] = [-u[1] * side, u[0] * side];
  const cx = flank[0] - u[0] * TONGUE_RADIUS;
  const cz = flank[1] - u[1] * TONGUE_RADIUS;
  const bend = TONGUE.map(([a, b]): [number, number] => [cx + (u[0] * a + t[0] * b) * TONGUE_RADIUS, cz + (u[1] * a + t[1] * b) * TONGUE_RADIUS]);
  controls.splice(top, 1, ...bend);
  return { points: controls, fixed: top, fixed_count: TONGUE.length, stack: null };
}

/**
 * True when two stretches of the loop that are not neighbours along it come closer than LOOP_CLEARANCE. Inside the
 * stack the legs sit closer by design, and the stack checks its own spacing.
 */
function crowded(path: Path, stack: Switchback | null): boolean {
  const n = path.length;
  const arc = CLEARANCE_ARC / STEP;
  const own = path.map(([x, z]) => stack !== null && inside(stack, x, z, 0));
  for (let i = 0; i < n; i += CLEARANCE_STRIDE)
    for (let j = i + arc; j < Math.min(n, n - arc + i); j += CLEARANCE_STRIDE)
      if (!(own[i] && own[j]) && length(path[i][0] - path[j][0], path[i][1] - path[j][1]) < LOOP_CLEARANCE) return true;
  return false;
}

// Circumradius of each 20 m arc. Every op on the way here (the loop's control points included) is IEEE-exact, so all
// engines agree on which retry wins.
function radius_at(path: Path, i: number): number {
  const n = path.length;
  const [ax, az] = path[(i - RADIUS_SPAN + n) % n];
  const [bx, bz] = path[i];
  const [cx, cz] = path[(i + RADIUS_SPAN) % n];
  const cross = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
  const ab = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
  const bc = (cx - bx) * (cx - bx) + (cz - bz) * (cz - bz);
  const ac = (cx - ax) * (cx - ax) + (cz - az) * (cz - az);
  return cross > 0 ? Math.sqrt(ab * bc * ac) / (2 * cross) : Infinity;
}

/** Tightest bend, and every point under `limit`, skipping points `skip` claims. */
function tightest(path: Path, closed: boolean, skip?: (x: number, z: number) => boolean, limit = 0): { radius: number; under: number[] } {
  const n = path.length;
  let radius = Infinity;
  const under: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!closed && (i < RADIUS_SPAN || i >= n - RADIUS_SPAN)) continue;
    if (skip?.(path[i][0], path[i][1])) continue;
    const r = radius_at(path, i);
    if (r < limit) under.push(i);
    radius = Math.min(radius, r);
  }
  return { radius, under };
}

export function min_radius(path: Path, closed = true): number {
  return tightest(path, closed).radius;
}

// Every bend under ROAD_MIN_RADIUS eases its nearest control toward the midpoint of that control's neighbours, so one
// overshooting pinch costs a nudge, not a whole new loop. The stack's own hairpins are meant to be tight.
function relaxed({ points: controls, fixed, fixed_count, stack }: Controls): { path: Path; radius: number } {
  const n = controls.length;
  const skip = stack ? (x: number, z: number) => inside(stack, x, z, 0) : undefined;
  let path = catmull(controls, STEP);
  let { radius, under } = tightest(path, true, skip, ROAD_MIN_RADIUS);
  let best_radius = radius;
  let gained = 0;
  for (let fix = 0; fix < RELAX_TRIES && radius < ROAD_MIN_RADIUS && fix - gained <= RELAX_STALL; fix++) {
    const nudge = new Set<number>();
    for (const at of under) {
      const [x, z] = path[at];
      let c = -1;
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        const d = length(controls[i][0] - x, controls[i][1] - z);
        if (d < best && (i < fixed || i >= fixed + fixed_count)) {
          c = i;
          best = d;
        }
      }
      nudge.add(c);
    }
    const from = controls.slice();
    for (const c of [...nudge].sort((a, b) => a - b)) {
      const prev = from[(c - 1 + n) % n];
      const next = from[(c + 1) % n];
      const [cx, cz] = from[c];
      controls[c] = [cx + ((prev[0] + next[0]) / 2 - cx) * RELAX, cz + ((prev[1] + next[1]) / 2 - cz) * RELAX];
    }
    path = catmull(controls, STEP);
    ({ radius, under } = tightest(path, true, skip, ROAD_MIN_RADIUS));
    if (radius > best_radius) {
      best_radius = radius;
      gained = fix;
    }
  }
  return { path, radius };
}

export interface Loop {
  path: Path;
  stack: Switchback | null;
}

export function loop_path(seed: number, heights: Float32Array, shape: RoadRecipe = ISLAND.road): Loop {
  const summit = highest(heights);
  let best: Loop = { path: [], stack: null };
  let best_radius = -Infinity;
  for (let attempt = 0; attempt < ROAD_ATTEMPTS && best_radius < ROAD_MIN_RADIUS; attempt++) {
    const controls = loop_controls(attempt ? sub(seed, "road") + attempt : seed + 41, heights, summit, shape);
    const { path, radius } = relaxed(controls);
    const score = crowded(path, controls.stack) ? -1 : radius;
    if (score > best_radius) {
      best = { path, stack: controls.stack };
      best_radius = score;
    }
  }
  if (!best.stack) return best;
  // The start line goes half a lap from the stack, so the grid and the first checkpoints sit on open road.
  const { path, stack } = best;
  const n = path.length;
  const first = path.findIndex(([x, z]) => inside(stack, x, z, 0));
  const start = (first + Math.floor(n / 2)) % n;
  return { path: [...path.slice(start), ...path.slice(0, start)], stack };
}

export function smooth(ys: number[], window: number, passes: number, closed: boolean): number[] {
  const n = ys.length;
  for (let pass = 0; pass < passes; pass++) {
    const from = ys;
    ys = from.map((_, i) => {
      let sum = 0;
      for (let k = -window; k <= window; k++) {
        const j = i + k;
        sum += from[closed ? (j + n) % n : Math.max(0, Math.min(n - 1, j))];
      }
      return sum / (window * 2 + 1);
    });
  }
  return ys;
}

export function road_points(path: Path, ys: number[], closed: boolean): RoadPoint[] {
  const n = path.length;
  return path.map(([x, z], i) => {
    const [nx, nz] = closed || i < n - 1 ? path[(i + 1) % n] : [2 * x - path[i - 1][0], 2 * z - path[i - 1][1]];
    const len = length(nx - x, nz - z) || 1;
    return { x, y: ys[i], z, tx: (nx - x) / len, tz: (nz - z) / len };
  });
}

// Every point stays within `grade` of both pinned ends (the envelope) and of its neighbour, walked from the far end:
// the envelope is itself grade-Lipschitz, so the walk never pushes a point out of it and both ends stay pinned.
export function limit_grade(ys: number[], run: number[], grade: number | readonly number[]): number[] {
  const n = ys.length;
  const g = (i: number) => (typeof grade === "number" ? grade : grade[i]);
  const along = [0];
  for (let i = 1; i < n; i++) along.push(along[i - 1] + g(i - 1) * run[i - 1]);
  const total = along[n - 1];
  const y0 = ys[0];
  const y1 = ys[n - 1];
  const out = ys.map((y, i) => {
    const lo = Math.max(y0 - along[i], y1 - (total - along[i]));
    const hi = Math.min(y0 + along[i], y1 + (total - along[i]));
    return lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, y));
  });
  for (let i = n - 2; i >= 0; i--) out[i] = Math.max(out[i + 1] - g(i) * run[i], Math.min(out[i + 1] + g(i) * run[i], out[i]));
  return out;
}

// Grade clamping leaves kinks; each pass averages the points around any crest tighter than CREST_RADIUS.
function ease_crests(ys: number[], crest: readonly number[]): number[] {
  const n = ys.length;
  const k = RADIUS_SPAN;
  const limit = crest.map((r) => (k * STEP * (k * STEP)) / r);
  for (let pass = 0; pass < CREST_PASSES; pass++) {
    const from = ys;
    const sharp = new Uint8Array(n);
    let any = false;
    for (let i = 0; i < n; i++)
      if (2 * from[i] - from[(i - k + n) % n] - from[(i + k) % n] > limit[i]) {
        any = true;
        for (let j = -k; j <= k; j++) sharp[(i + j + n) % n] = 1;
      }
    if (!any) break;
    ys = from.map((y, i) => {
      if (!sharp[i]) return y;
      let sum = 0;
      for (let j = -k; j <= k; j++) sum += from[(i + j + n) % n];
      return sum / (2 * k + 1);
    });
  }
  return ys;
}

export function loop_heights({ path, stack }: Loop, heights: Float32Array): number[] {
  const n = path.length;
  const run = path.map(([x, z], i) => length(path[(i + 1) % n][0] - x, path[(i + 1) % n][1] - z));
  const hairpins = stack?.bends.filter((b) => b.radius === HAIRPIN_RADIUS) ?? [];
  const bend = path.map((_, i) => {
    const [ax, az] = path[(i - RADIUS_SPAN + n) % n];
    const [bx, bz] = path[i];
    const [cx, cz] = path[(i + RADIUS_SPAN) % n];
    const cross = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
    return cross > 0 && !(stack && inside(stack, bx, bz, 0)) && length(bx - ax, bz - az) * length(cx - bx, cz - bz) * length(cx - ax, cz - az) < 2 * cross * BEND_RADIUS;
  });
  const near_bend = path.map((_, i) => {
    for (let j = -BEND_REACH; j <= BEND_REACH; j++) if (bend[(i + j + n) % n]) return true;
    return false;
  });
  const crest = near_bend.map((near) => (near ? BEND_CREST : CREST_RADIUS));
  const grade = path.map(([x, z], i) => {
    if (hairpins.some((b) => length(b.x - x, b.z - z) < b.radius + HAIRPIN_REACH)) return HAIRPIN_GRADE;
    if (stack && inside(stack, x, z, 0)) return CLIMB_GRADE;
    return near_bend[i] ? BEND_GRADE : ROAD_GRADE;
  });
  const ys = smooth(
    path.map(([x, z]) => Math.max(3, sample(heights, x, z))),
    8,
    3,
    true,
  );
  const graded = (from: number[]) => limit_grade([...from, from[0]], run, grade).slice(0, n);
  return graded(ease_crests(graded(ys), crest));
}

export interface LoopRoad {
  road: RoadPoint[];
  stack: Switchback | null;
}

export function loop_road(seed: number, heights: Float32Array, shape: RoadRecipe = ISLAND.road): LoopRoad {
  const loop = loop_path(seed, heights, shape);
  return { road: road_points(loop.path, loop_heights(loop, heights), true), stack: loop.stack };
}

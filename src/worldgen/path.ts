import { sub } from "../rng";
import { sample } from "./field";
import { circle16, fbm, length } from "./noise";
import type { RoadPoint } from "./types";

const ROAD_MIN_RADIUS = 45;
const ROAD_ATTEMPTS = 16;
const RADIUS_SPAN = 5;
const STEP = 2;

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

function catmull(points: Path, step: number): Path {
  const dense: Path = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let s = 0; s < 80; s++) {
      const t = s / 80;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([at(p0[0], p1[0], p2[0], p3[0]), at(p0[1], p1[1], p2[1], p3[1])]);
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

function loop_controls(seed: number): Path {
  return circle16().map(([c, s]) => {
    const r = 600 + (fbm(c * 3, s * 3, seed) - 0.5) * 420;
    return [c * r, s * r];
  });
}

// Circumradius of each 20 m arc. Every op on the way here (the loop's control points included) is IEEE-exact, so all
// engines agree on which retry wins.
export function min_radius(path: Path, closed = true): number {
  const n = path.length;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    if (!closed && (i < RADIUS_SPAN || i >= n - RADIUS_SPAN)) continue;
    const [ax, az] = path[(i - RADIUS_SPAN + n) % n];
    const [bx, bz] = path[i];
    const [cx, cz] = path[(i + RADIUS_SPAN) % n];
    const cross = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
    const ab = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
    const bc = (cx - bx) * (cx - bx) + (cz - bz) * (cz - bz);
    const ac = (cx - ax) * (cx - ax) + (cz - az) * (cz - az);
    min = Math.min(min, cross > 0 ? Math.sqrt(ab * bc * ac) / (2 * cross) : Infinity);
  }
  return min;
}

export function loop_path(seed: number): Path {
  let best = catmull(loop_controls(seed + 41), STEP);
  let best_radius = min_radius(best);
  for (let attempt = 1; attempt < ROAD_ATTEMPTS && best_radius < ROAD_MIN_RADIUS; attempt++) {
    const path = catmull(loop_controls(sub(seed, "road") + attempt), STEP);
    const radius = min_radius(path);
    if (radius > best_radius) {
      best = path;
      best_radius = radius;
    }
  }
  return best;
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

export function loop_road(seed: number, heights: Float32Array): RoadPoint[] {
  const path = loop_path(seed);
  const ys = smooth(
    path.map(([x, z]) => Math.max(3, sample(heights, x, z))),
    24,
    4,
    true,
  );
  return road_points(path, ys, true);
}

import type { RoadPoint } from "./types";

/** Lowest and highest side offset a point's ribbon vertices may take. */
export type Reach = [number, number];

export interface Arm {
  /** Outward from the node, points[0] on it, tangents pointing away; only as far as its mouth may go. */
  points: readonly RoadPoint[];
  reach: readonly Reach[];
  half: number;
  /** Half width a neighbouring arm's mouth stays clear of: the asphalt plus any sidewalk. */
  clear: number;
  /** Curb radius this arm asks for; a corner takes the larger of its two arms'. Zero keeps the corner sharp. */
  radius: number;
  rank: number;
  lift: number;
  /** A corner between two lined arms carries their edge line round it. */
  lined: boolean;
}

export interface PatchPoint {
  x: number;
  z: number;
  lift: number;
}

export interface RimPoint {
  x: number;
  z: number;
  wx: number;
  wz: number;
}

export interface Patch {
  centre: PatchPoint;
  /** The patch rim, walked so each (centre, outline[q + 1], outline[q]) faces up. */
  outline: PatchPoint[];
  /** Per arm, the point its own ribbon starts from: the patch covers everything inside. */
  mouths: number[];
  /** Per arm, the first point each side (-1, +1 of the arm) runs its own rim from, sidewalks included. */
  sides: [number, number][];
  lines: RimPoint[][];
  minor: number[];
}

// cos 50°: a corner sharper than this needs a setback longer than the arms it joins.
const SHARPEST = 0.6427876096865394;
// Largest turn between two fillet segments, in radians (4°): coarser reads as facets up close.
const FILLET_TURN = 0.0698;
const FILLET_MIN_STEPS = 4;
/** Index slack for a setback that lands on a point: (4 + 4 cos 90°) / sin 90° comes out a hair over 4. */
const SNAP = 1e-6;
// A fillet end and the rim point it lands on come out a rounding apart; both kept make a sliver that faces nowhere.
const SAME = 1e-6;

type Corner = { kind: "walk" } | { kind: "taper" } | { kind: "fillet"; at_i: number; at_j: number; radius: number };

/** Monotonic in the angle from +x toward +z, the side `n = (-tz, tx)` points to; no trig. */
function pseudo_angle(x: number, z: number): number {
  if (z >= 0) return x >= 0 ? z / (x + z) : 1 - x / (z - x);
  return x < 0 ? 2 - z / (-x - z) : 3 + x / (x - z);
}

function arc_lengths(points: readonly RoadPoint[]): number[] {
  const out = [0];
  for (let k = 1; k < points.length; k++) out.push(out[k - 1] + Math.hypot(points[k].x - points[k - 1].x, points[k].z - points[k - 1].z));
  return out;
}

/** The arm's ribbon vertex on `side` at point k, exactly as `Roads.strip` lays it. */
export function rim(arm: Arm, k: number, side: -1 | 1): { x: number; z: number } {
  const p = arm.points[k];
  const [lo, hi] = arm.reach[k];
  const off = Math.max(lo, Math.min(hi, side * arm.half));
  return { x: p.x - p.tz * off, z: p.z + p.tx * off };
}

function first_at(arc: readonly number[], at: number): number {
  for (let k = 0; k < arc.length; k++) if (arc[k] >= at - SNAP) return k;
  return arc.length;
}

function rim_at(arm: Arm, arc: readonly number[], at: number, side: -1 | 1) {
  let k = 0;
  while (k < arc.length - 2 && arc[k + 1] <= at) k++;
  const t = (at - arc[k]) / (arc[k + 1] - arc[k] || 1);
  const a = rim(arm, k, side);
  const b = rim(arm, k + 1, side);
  const tx = arm.points[k].tx + (arm.points[k + 1].tx - arm.points[k].tx) * t;
  const tz = arm.points[k].tz + (arm.points[k + 1].tz - arm.points[k].tz) * t;
  const len = Math.hypot(tx, tz) || 1;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, tx: tx / len, tz: tz / len };
}

/**
 * The asphalt where arms meet at a node: each arm trimmed back to a setback, the corners between neighbouring arms
 * rounded, as one rim around the node. Null when a corner is too sharp or an arm too short to fit it.
 */
export function junction_patch(x: number, z: number, arms: readonly Arm[]): Patch | null {
  const count = arms.length;
  if (count < 2) return null;
  const order = arms.map((_, i) => i).sort((a, b) => pseudo_angle(arms[a].points[0].tx, arms[a].points[0].tz) - pseudo_angle(arms[b].points[0].tx, arms[b].points[0].tz));
  const arcs = arms.map((arm) => arc_lengths(arm.points));
  const floor = Math.max(...arms.map((arm) => arm.half));
  const setback = arms.map(() => floor);
  const corners: Corner[] = [];
  for (let q = 0; q < count; q++) {
    const i = order[q];
    const j = order[(q + 1) % count];
    const a = arms[i];
    const b = arms[j];
    const ta = a.points[0];
    const tb = b.points[0];
    const sin = ta.tx * tb.tz - ta.tz * tb.tx;
    const cos = ta.tx * tb.tx + ta.tz * tb.tz;
    if (sin > 0 && cos > SHARPEST) return null;
    if (sin <= 0) {
      corners.push({ kind: "walk" });
      continue;
    }
    const u = (b.half + a.half * cos) / sin;
    const v = (a.half + b.half * cos) / sin;
    if (u < 0 || v < 0) {
      corners.push({ kind: "taper" });
      continue;
    }
    const cot_half = (1 + cos) / sin;
    const room_a = arcs[i][arcs[i].length - 1];
    const room_b = arcs[j][arcs[j].length - 1];
    const clear_a = (b.clear + a.half * cos) / sin;
    const clear_b = (a.clear + b.half * cos) / sin;
    const radius = Math.min(Math.max(a.radius, b.radius), (room_a - u) / cot_half, (room_b - v) / cot_half);
    if (radius < 0 || clear_a > room_a || clear_b > room_b) return null;
    const at_i = u + radius * cot_half;
    const at_j = v + radius * cot_half;
    setback[i] = Math.max(setback[i], at_i, clear_a);
    setback[j] = Math.max(setback[j], at_j, clear_b);
    corners.push({ kind: "fillet", at_i, at_j, radius });
  }
  const mouths = arms.map((_, i) => Math.max(1, first_at(arcs[i], setback[i])));
  if (mouths.some((m, i) => m >= arms[i].points.length)) return null;

  const top = order.reduce((best, i) => (arms[i].rank > arms[best].rank ? i : best), order[0]);
  const centre = { x, z, lift: arms[top].lift };
  const outline: PatchPoint[] = [];
  const sides: [number, number][] = arms.map(() => [0, 0]);
  const lines: RimPoint[][] = [];
  const push = (p: { x: number; z: number }, lift: number) => {
    const last = outline[outline.length - 1];
    if (!last || Math.abs(last.x - p.x) > SAME || Math.abs(last.z - p.z) > SAME) outline.push({ x: p.x, z: p.z, lift });
  };
  // Where the rim leaves each arm's side for the corner, as arc length: -1 side from the corner before, +1 side from the one after.
  const leave = (q: number, side: -1 | 1): number => {
    const corner = corners[side > 0 ? q : (q + count - 1) % count];
    const i = order[q];
    if (corner.kind === "walk") return 0;
    if (corner.kind === "taper") return arcs[i][mouths[i]];
    return side > 0 ? corner.at_i : corner.at_j;
  };
  for (let q = 0; q < count; q++) {
    const i = order[q];
    const arm = arms[i];
    const arc = arcs[i];
    const m = mouths[i];
    const from_minus = leave(q, -1);
    const from_plus = leave(q, 1);
    sides[i] = [first_at(arc, from_minus), first_at(arc, from_plus)];
    for (let k = 1; k < m; k++) if (arc[k] > from_minus) push(rim(arm, k, -1), arm.lift);
    push(rim(arm, m, -1), arm.lift);
    push(rim(arm, m, 1), arm.lift);
    for (let k = m - 1; k >= 1; k--) if (arc[k] > from_plus) push(rim(arm, k, 1), arm.lift);

    const corner = corners[q];
    const j = order[(q + 1) % count];
    const next = arms[j];
    if (corner.kind === "walk") {
      const p = rim(arm, 0, 1);
      const r = rim(next, 0, -1);
      // Straight through, both rims sit on one line across the node: keep the wider, so the narrower arm tapers out to it
      // instead of the fan laying a triangle with no area.
      const straight = Math.abs((p.x - x) * (r.z - z) - (p.z - z) * (r.x - x)) < SAME;
      const wider = arm.half >= next.half;
      if (!straight || wider) push(p, arm.lift);
      if (!straight || !wider) push(r, next.lift);
    } else if (corner.kind === "fillet") {
      for (const p of fillet(arm, arc, next, arcs[j], corner)) push(p, arm.lift + (next.lift - arm.lift) * p.t);
    }
    if (arm.lined && next.lined) lines.push(edge_line(arm, arc, m, from_plus, corner, next, arcs[j], mouths[j]));
  }
  const first = outline[0];
  const last = outline[outline.length - 1];
  if (Math.abs(first.x - last.x) <= SAME && Math.abs(first.z - last.z) <= SAME) outline.pop();
  const minor = order.filter((i) => arms[i].rank < arms[top].rank);
  return { centre, outline, mouths, sides, lines, minor };
}

function fillet(a: Arm, arc_a: readonly number[], b: Arm, arc_b: readonly number[], corner: Extract<Corner, { kind: "fillet" }>): { x: number; z: number; t: number }[] {
  const p = rim_at(a, arc_a, corner.at_i, 1);
  const r = rim_at(b, arc_b, corner.at_j, -1);
  if (corner.radius === 0) return [{ x: p.x, z: p.z, t: 0 }];
  // The control point is where the two rims, followed back toward the node, cross: a quadratic through it leaves
  // each rim along its own tangent, so the curb meets both edges without a kink.
  const cross = p.tx * r.tz - p.tz * r.tx;
  const dx = r.x - p.x;
  const dz = r.z - p.z;
  const s = (dx * r.tz - dz * r.tx) / (cross || 1);
  const t = (dx * p.tz - dz * p.tx) / (cross || 1);
  const sharp = Math.abs(cross) < 1e-6 || s > 0 || t > 0;
  const cx = sharp ? (p.x + r.x) / 2 : p.x + p.tx * s;
  const cz = sharp ? (p.z + r.z) / 2 : p.z + p.tz * s;
  // A rational quadratic with middle weight cos(turn / 2) is a true circular arc when both tangents are equally long,
  // so the curb bends evenly instead of bunching its turn in the middle, and even steps turn about FILLET_TURN each.
  const turn_cos = Math.max(-1, Math.min(1, -(p.tx * r.tx + p.tz * r.tz)));
  const weight = sharp ? 1 : Math.sqrt((1 + turn_cos) / 2);
  const steps = Math.max(FILLET_MIN_STEPS, Math.ceil(Math.acos(turn_cos) / FILLET_TURN));
  const out = [];
  for (let step = 0; step <= steps; step++) {
    const u = step / steps;
    const w0 = (1 - u) * (1 - u);
    const w1 = 2 * u * (1 - u) * weight;
    const w2 = u * u;
    const sum = w0 + w1 + w2;
    out.push({ x: (p.x * w0 + cx * w1 + r.x * w2) / sum, z: (p.z * w0 + cz * w1 + r.z * w2) / sum, t: u });
  }
  return out;
}

function edge_line(a: Arm, arc_a: readonly number[], m_a: number, from_a: number, corner: Corner, b: Arm, arc_b: readonly number[], m_b: number): RimPoint[] {
  const out: RimPoint[] = [];
  const own = (arm: Arm, k: number, side: -1 | 1) => {
    const p = arm.points[k];
    const e = rim(arm, k, side);
    out.push({ x: e.x, z: e.z, wx: side * p.tz, wz: -side * p.tx });
  };
  if (corner.kind === "taper") {
    const p = rim(a, m_a, 1);
    const r = rim(b, m_b, -1);
    const len = Math.hypot(r.x - p.x, r.z - p.z) || 1;
    const wx = -(r.z - p.z) / len;
    const wz = (r.x - p.x) / len;
    return [
      { ...p, wx, wz },
      { ...r, wx, wz },
    ];
  }
  for (let k = m_a; k >= 0; k--) if (arc_a[k] > from_a || (corner.kind === "walk" && k === 0)) own(a, k, 1);
  if (corner.kind === "fillet") {
    const curve = fillet(a, arc_a, b, arc_b, corner);
    for (let q = 0; q < curve.length; q++) {
      const prev = curve[Math.max(0, q - 1)];
      const next = curve[Math.min(curve.length - 1, q + 1)];
      const len = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
      out.push({ x: curve[q].x, z: curve[q].z, wx: -(next.z - prev.z) / len, wz: (next.x - prev.x) / len });
    }
  }
  const from_b = corner.kind === "fillet" ? corner.at_j : 0;
  for (let k = 0; k <= m_b; k++) {
    if (!(arc_b[k] > from_b || (corner.kind === "walk" && k === 0))) continue;
    const e = rim(b, k, -1);
    const last = out[out.length - 1];
    if (last && last.x === e.x && last.z === e.z) continue;
    own(b, k, -1);
  }
  return out;
}

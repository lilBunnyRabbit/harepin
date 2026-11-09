import { sample } from "./field";
import { length } from "./noise";
import type { Path } from "./path";
import { ROAD_HALF, type Item } from "./types";

export const HAIRPIN_RADIUS = 16;
const CREST_BEND = 40;
/** Leg length and hairpin spacing are picked so the terrain under a leg rises this much per metre of road. */
const LEG_GRADE = 0.1;
/** Up-slope spacing between hairpins, in HAIRPIN_RADIUS: under about 2 the fillet runs longer than the leg. */
const SPACING_MIN = 2.2;
const LEG_MIN = 70;
const LEG_MAX = 180;
/** Steeper than this the legs at LEG_MAX would sit in a cut deeper than the road is wide. */
const SLOPE_MAX = 0.8;
const STACK_GAP = 60;
const SLOPE_PROBE = 150;
const SLOPE_MIN = 0.06;
const SUMMIT_KEEP = 40;
const LAND = 6;
const SPACING = 6;
const ARC_DEPTH = 4;
/** Guard rail off the centreline on the outside of each hairpin, clear of the asphalt and its edge. */
const RAIL_OFFSET = ROAD_HALF + 3.5;
/** Most the ground may fall across a rail's footprint: the world check's grounding limit, less a margin. */
const RAIL_LEVEL = 0.2;
const RAIL_HALF = 1.5;
const RAIL_WIDTH = 0.3;
/** Nearest any road's centre may come to a rail: the world check keeps solid items this far off the asphalt. */
const RAIL_ROAD = ROAD_HALF + RAIL_HALF + 1.5;
const RAIL_STEP = 3.2;

export interface Bend {
  x: number;
  z: number;
  radius: number;
  arc: Path;
}

export interface Switchback {
  points: Path;
  bends: Bend[];
  /** Footprint frame: `t` across the face in driving direction, `u` up it toward the summit. */
  x: number;
  z: number;
  tx: number;
  tz: number;
  ux: number;
  uz: number;
  t0: number;
  t1: number;
  u1: number;
}

export function inside(s: Switchback, x: number, z: number, margin: number): boolean {
  const dx = x - s.x;
  const dz = z - s.z;
  const t = dx * s.tx + dz * s.tz;
  const u = dx * s.ux + dz * s.uz;
  return t > s.t0 - margin && t < s.t1 + margin && u > -margin && u < s.u1 + margin;
}

// Bisects the radius vectors (angle under 180°) instead of stepping an angle, which would need cos/sin.
function arc(cx: number, cz: number, ax: number, az: number, bx: number, bz: number, r: number, depth: number, out: Path) {
  if (depth === 0) {
    out.push([cx + bx, cz + bz]);
    return;
  }
  const mx = ax + bx;
  const mz = az + bz;
  const ml = length(mx, mz);
  const hx = (mx / ml) * r;
  const hz = (mz / ml) * r;
  arc(cx, cz, ax, az, hx, hz, r, depth - 1, out);
  arc(cx, cz, hx, hz, bx, bz, r, depth - 1, out);
}

function fillet(vertices: Path, hairpins: Set<number>): { line: Path; bends: Bend[] } | null {
  const line: Path = [vertices[0]];
  const bends: Bend[] = [];
  let used = 0;
  for (let i = 1; i < vertices.length - 1; i++) {
    const [px, pz] = vertices[i - 1];
    const [vx, vz] = vertices[i];
    const [nx, nz] = vertices[i + 1];
    const l1 = length(vx - px, vz - pz);
    const l2 = length(nx - vx, nz - vz);
    const d1x = (vx - px) / l1;
    const d1z = (vz - pz) / l1;
    const d2x = (nx - vx) / l2;
    const d2z = (nz - vz) / l2;
    const cos = d1x * d2x + d1z * d2z;
    const r = hairpins.has(i) ? HAIRPIN_RADIUS : CREST_BEND;
    const reach = r * Math.sqrt((1 - cos) / (1 + cos));
    if (used + reach > l1 || (i === vertices.length - 2 && reach > l2)) return null;
    used = reach;
    const turn = d1x * d2z - d1z * d2x < 0 ? -1 : 1;
    const ax = vx - d1x * reach;
    const az = vz - d1z * reach;
    const cx = ax - d1z * turn * r;
    const cz = az + d1x * turn * r;
    const bx = vx + d2x * reach;
    const bz = vz + d2z * reach;
    const points: Path = [[ax, az]];
    arc(cx, cz, ax - cx, az - cz, bx - cx, bz - cz, r, ARC_DEPTH, points);
    line.push(...points);
    bends.push({ x: cx, z: cz, radius: r, arc: points });
  }
  line.push(vertices[vertices.length - 1]);
  return { line, bends };
}

function spaced(line: Path, step: number): Path {
  const out: Path = [line[0]];
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1];
    const [bx, bz] = line[i];
    const len = length(bx - ax, bz - az);
    let from = step - carry;
    while (from <= len) {
      out.push([ax + ((bx - ax) * from) / len, az + ((bz - az) * from) / len]);
      from += step;
    }
    carry = len - (from - step);
  }
  const last = line[line.length - 1];
  const tail = out[out.length - 1];
  if (length(last[0] - tail[0], last[1] - tail[1]) > step / 2) out.push(last);
  else out[out.length - 1] = last;
  return out;
}

/**
 * A Stelvio stack on the summit face: `count` hairpins up the left of the face, a bend across the top, `count` hairpins
 * down the right. `base` is the ring point at its foot and `t` the ring's direction there. Null when the face is too
 * flat, too steep, too small or runs into the sea; the caller then falls back.
 */
export function switchback(heights: Float32Array, base: [number, number], summit: [number, number], t: [number, number], count: number): Switchback | null {
  const [x, z] = base;
  const dist = length(summit[0] - x, summit[1] - z);
  const ux = (summit[0] - x) / dist;
  const uz = (summit[1] - z) / dist;
  const side = t[0] * -uz + t[1] * ux < 0 ? -1 : 1;
  const tx = -uz * side;
  const tz = ux * side;
  const probe = Math.min(SLOPE_PROBE, dist - SUMMIT_KEEP);
  if (probe <= 0) return null;
  const slope = (sample(heights, x + ux * probe, z + uz * probe) - sample(heights, x, z)) / probe;
  if (slope < SLOPE_MIN || slope > SLOPE_MAX) return null;
  let spacing = SPACING_MIN * HAIRPIN_RADIUS;
  let leg = Math.min(LEG_MAX, (slope * spacing) / LEG_GRADE);
  if (leg < LEG_MIN) {
    leg = LEG_MIN;
    spacing = (LEG_GRADE * leg) / slope;
  }
  const top = (count + 1) * spacing;
  if (top > dist - SUMMIT_KEEP) return null;
  const a = -STACK_GAP / 2 - leg;
  const b = -STACK_GAP / 2;
  const c = STACK_GAP / 2;
  const d = STACK_GAP / 2 + leg;
  const local: Path = [];
  const hairpins = new Set<number>();
  for (let j = 0; j <= count + 1; j++) {
    if (j >= 1 && j <= count) hairpins.add(local.length);
    local.push([j % 2 ? b : a, j * spacing]);
  }
  for (let j = 1; j <= count + 1; j++) {
    if (j <= count) hairpins.add(local.length);
    local.push([j % 2 ? d : c, top - j * spacing]);
  }
  const shaped = fillet(local, hairpins);
  if (!shaped) return null;
  const world = (p: [number, number]): [number, number] => [x + tx * p[0] + ux * p[1], z + tz * p[0] + uz * p[1]];
  const points = spaced(shaped.line, SPACING).map(world);
  if (points.some(([px, pz]) => sample(heights, px, pz) < LAND)) return null;
  const bends = shaped.bends.map((bend) => {
    const [bx, bz] = world([bend.x, bend.z]);
    return { x: bx, z: bz, radius: bend.radius, arc: bend.arc.map(world) };
  });
  return { points, bends, x, z, tx, tz, ux, uz, t0: a - HAIRPIN_RADIUS, t1: d + HAIRPIN_RADIUS, u1: top + HAIRPIN_RADIUS };
}

/** Barriers along the outside of every hairpin, where the fill falls away; spots on uneven ground are left open. */
export function guard_rails(stack: Switchback, heights: Float32Array, road_dist: Float32Array): Item[] {
  const out: Item[] = [];
  for (const bend of stack.bends) {
    if (bend.radius !== HAIRPIN_RADIUS) continue;
    const scale = (bend.radius + RAIL_OFFSET) / bend.radius;
    let last: [number, number] | null = null;
    for (const [px, pz] of bend.arc) {
      const rx = (px - bend.x) * scale;
      const rz = (pz - bend.z) * scale;
      const x = bend.x + rx;
      const z = bend.z + rz;
      if (last && length(x - last[0], z - last[1]) < RAIL_STEP) continue;
      const rl = length(rx, rz);
      const fx = -rz / rl;
      const fz = rx / rl;
      const y = sample(heights, x, z);
      if (y < LAND / 2 || sample(road_dist, x, z) < RAIL_ROAD) continue;
      const corners = [-1, 1].flatMap((a) => [-1, 1].map((b) => sample(heights, x + fx * a * RAIL_HALF - fz * b * RAIL_WIDTH, z + fz * a * RAIL_HALF + fx * b * RAIL_WIDTH)));
      if (corners.some((h) => Math.abs(h - y) > RAIL_LEVEL)) continue;
      out.push({ kind: "barrier", x, y, z, fx, fz, scale: 1, light: false });
      last = [x, z];
    }
  }
  return out;
}

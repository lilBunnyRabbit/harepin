import { at, sample, WHOLE, type Grid } from "./field";
import { length } from "./noise";
import type { Path } from "./path";
import { CELL, N, ORIGIN, ROAD_HALF, type Item, type RoadPoint } from "./types";

export const HAIRPIN_RADIUS = 16;
/**
 * Each hairpin turns on two corners a hairpin's width apart, up the face from its row. One corner would fillet two legs
 * meeting at a sharp angle, and its arc would sit far inside the leg ends, eating most of the climb.
 */
const U_TURN = [-HAIRPIN_RADIUS, HAIRPIN_RADIUS];
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
/** Straight run before the first hairpin and after the last: room for the CREST_BEND fillet off the fall line. */
const DESCENT_LEAD = 40;
const DESCENT_STEP = 2;
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
/**
 * The ground under the stack stays within FACE_CUT of the nearest leg's height across the asphalt and climbs or falls
 * away from it no steeper than FACE_BANK until the bank meets the hillside. The legs climb at road grades up a face that
 * rises far faster, so without it they run in cuts tens of metres deep.
 */
const FACE_CUT = 1;
const FACE_BANK = 1;
/**
 * A bank that has not met the hillside by FACE_REACH would end in a wall there, so the ground moves at most FACE_TAPER
 * per metre still to go: a slope no steeper than the hillside's plus FACE_TAPER. Banks on seeds swept so far meet it by 220 m.
 */
export const FACE_REACH = 280;
const FACE_TAPER = 0.5;
/** Vertices this near a road point take its exact cone; the rest get it through the chamfer passes. */
const FACE_SEED = ROAD_HALF + 2 * CELL;
const DIAGONAL = CELL * Math.SQRT2;

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
    if (j < 1 || j > count) local.push([j % 2 ? b : a, j * spacing]);
    else
      for (const du of U_TURN) {
        hairpins.add(local.length);
        local.push([j % 2 ? b : a, j * spacing + du]);
      }
  }
  for (let j = 1; j <= count + 1; j++) {
    if (j > count) local.push([j % 2 ? d : c, top - j * spacing]);
    else
      for (const du of U_TURN) {
        hairpins.add(local.length);
        local.push([j % 2 ? d : c, top - j * spacing - du]);
      }
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

/** One-way: `count` hairpins down the fall line `down` from `top`. Unlike `switchback`, the frame's `u` runs downhill. */
export function descent_stack(heights: Float32Array, top: [number, number], down: [number, number], count: number): Switchback | null {
  const [x, z] = top;
  const [ux, uz] = down;
  const tx = -uz;
  const tz = ux;
  const slope = (sample(heights, x + ux * DESCENT_LEAD, z + uz * DESCENT_LEAD) - sample(heights, x + ux * (DESCENT_LEAD + SLOPE_PROBE), z + uz * (DESCENT_LEAD + SLOPE_PROBE))) / SLOPE_PROBE;
  if (slope < SLOPE_MIN || slope > SLOPE_MAX) return null;
  const spacing = SPACING_MIN * HAIRPIN_RADIUS;
  const half = LEG_MAX / 2;
  const local: Path = [
    [0, 0],
    [0, DESCENT_LEAD],
  ];
  const hairpins = new Set<number>();
  for (let j = 1; j <= count; j++)
    for (const du of U_TURN) {
      hairpins.add(local.length);
      local.push([j % 2 ? half : -half, DESCENT_LEAD + j * spacing + du]);
    }
  const foot = DESCENT_LEAD + (count + 1) * spacing;
  local.push([0, foot], [0, foot + DESCENT_LEAD]);
  const shaped = fillet(local, hairpins);
  if (!shaped) return null;
  const world = (p: [number, number]): [number, number] => [x + tx * p[0] + ux * p[1], z + tz * p[0] + uz * p[1]];
  const points = spaced(shaped.line, DESCENT_STEP).map(world);
  if (points.some(([px, pz]) => sample(heights, px, pz) < LAND)) return null;
  const bends = shaped.bends.map((bend) => {
    const [bx, bz] = world([bend.x, bend.z]);
    return { x: bx, z: bz, radius: bend.radius, arc: bend.arc.map(world) };
  });
  return { points, bends, x, z, tx, tz, ux, uz, t0: -half - HAIRPIN_RADIUS, t1: half + HAIRPIN_RADIUS, u1: foot + DESCENT_LEAD };
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

// The bounds come from a lattice of their own over the stack's box, filled by two chamfer passes, so a tile replaying this
// op gets the same values as the whole grid: nothing in it reads the ground.
/** Shapes the ground under the stack's `points` (the road inside its footprint) to a face its legs sit on. */
export function shape_face(heights: Float32Array, points: readonly RoadPoint[], grid: Grid = WHOLE, reach = FACE_REACH) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    z0 = Math.min(z0, p.z);
    z1 = Math.max(z1, p.z);
  }
  const i0 = Math.max(0, Math.floor((x0 - reach - ORIGIN) / CELL));
  const i1 = Math.min(N, Math.ceil((x1 + reach - ORIGIN) / CELL));
  const j0 = Math.max(0, Math.floor((z0 - reach - ORIGIN) / CELL));
  const j1 = Math.min(N, Math.ceil((z1 + reach - ORIGIN) / CELL));
  if (i0 > i1 || j0 > j1 || i0 > grid.i1 || i1 < grid.i0 || j0 > grid.j1 || j1 < grid.j0) return;
  const w = i1 - i0 + 1;
  const size = w * (j1 - j0 + 1);
  const hi = new Float32Array(size).fill(Infinity);
  const lo = new Float32Array(size).fill(-Infinity);
  const dist = new Float32Array(size).fill(Infinity);
  for (const p of points) {
    const pi0 = Math.max(i0, Math.floor((p.x - FACE_SEED - ORIGIN) / CELL));
    const pi1 = Math.min(i1, Math.ceil((p.x + FACE_SEED - ORIGIN) / CELL));
    const pj0 = Math.max(j0, Math.floor((p.z - FACE_SEED - ORIGIN) / CELL));
    const pj1 = Math.min(j1, Math.ceil((p.z + FACE_SEED - ORIGIN) / CELL));
    for (let j = pj0; j <= pj1; j++)
      for (let i = pi0; i <= pi1; i++) {
        const d = length(ORIGIN + i * CELL - p.x, ORIGIN + j * CELL - p.z);
        if (d > FACE_SEED) continue;
        const l = (j - j0) * w + i - i0;
        const bank = Math.max(0, d - ROAD_HALF) * FACE_BANK;
        hi[l] = Math.min(hi[l], p.y + FACE_CUT + bank);
        lo[l] = Math.max(lo[l], p.y - FACE_CUT - bank);
        dist[l] = Math.min(dist[l], d);
      }
  }
  const pull = (l: number, from: number, step: number) => {
    hi[l] = Math.min(hi[l], hi[from] + step * FACE_BANK);
    lo[l] = Math.max(lo[l], lo[from] - step * FACE_BANK);
    dist[l] = Math.min(dist[l], dist[from] + step);
  };
  const rows = j1 - j0 + 1;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < w; i++) {
      const l = j * w + i;
      if (i > 0) pull(l, l - 1, CELL);
      if (j > 0) {
        pull(l, l - w, CELL);
        if (i > 0) pull(l, l - w - 1, DIAGONAL);
        if (i < w - 1) pull(l, l - w + 1, DIAGONAL);
      }
    }
  for (let j = rows - 1; j >= 0; j--)
    for (let i = w - 1; i >= 0; i--) {
      const l = j * w + i;
      if (i < w - 1) pull(l, l + 1, CELL);
      if (j < rows - 1) {
        pull(l, l + w, CELL);
        if (i < w - 1) pull(l, l + w + 1, DIAGONAL);
        if (i > 0) pull(l, l + w - 1, DIAGONAL);
      }
    }
  for (let j = Math.max(j0, grid.j0); j <= Math.min(j1, grid.j1); j++)
    for (let i = Math.max(i0, grid.i0); i <= Math.min(i1, grid.i1); i++) {
      const l = (j - j0) * w + i - i0;
      const most = (reach - dist[l]) * FACE_TAPER;
      if (most <= 0) continue;
      const k = at(grid, i, j);
      const h = heights[k];
      heights[k] = h + Math.min(most, Math.max(-most, Math.min(hi[l], Math.max(lo[l], h)) - h));
    }
}

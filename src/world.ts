import { Vector3 } from "three";
import { CAR_BODY, type Ground } from "./car";
import { mulberry32, sub } from "./rng";

export const SIZE = 2048;
export const CELL = 4;
export const N = SIZE / CELL;
const ORIGIN = -SIZE / 2;
export const ROAD_HALF = 6;
const CAR_RADIUS = 1.05;
const SHOULDER = 16;
const PEAK_HEIGHT = 150;
const PEAK_SPREAD = 230;
const PEAK_REACH = 220;
const SEED0_PEAK: Peak = { x: 120, z: -160 };

function hash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x, y, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    x *= 2.03;
    y *= 2.03;
  }
  return sum / norm;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

interface Peak {
  x: number;
  z: number;
}

function peak_of(seed: number): Peak {
  if (seed === 0) return SEED0_PEAK;
  const next = mulberry32(sub(seed, "peak"));
  const angle = next() * Math.PI * 2;
  const reach = Math.sqrt(next()) * PEAK_REACH;
  return { x: Math.cos(angle) * reach, z: Math.sin(angle) * reach };
}

function raw_height(x: number, z: number, seed: number, peak: Peak): number {
  const r = Math.hypot(x, z) / 960 + (fbm(x / 380, z / 380, seed + 3) - 0.5) * 0.3;
  const mask = 1 - smoothstep(0.8, 1.0, r);
  const hills = fbm(x / 520, z / 520, seed + 7);
  const ridge = 1 - Math.abs(2 * fbm(x / 300, z / 300, seed + 11) - 1);
  const top = PEAK_HEIGHT * Math.exp(-(((x - peak.x) ** 2 + (z - peak.z) ** 2) / PEAK_SPREAD ** 2));
  const land = 5 + hills ** 1.7 * 95 + ridge ** 3 * 22 + top;
  return -9 + (land + 9) * mask;
}

export interface RoadPoint {
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
}

export interface Tree {
  x: number;
  y: number;
  z: number;
  scale: number;
  kind: number;
}

export interface Solid {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
}

export interface Checkpoint {
  x: number;
  y: number;
  z: number;
  heading: number;
  index: number;
}

function catmull(points: [number, number][], step: number): [number, number][] {
  const dense: [number, number][] = [];
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
  const out: [number, number][] = [dense[0]];
  let carry = 0;
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i % dense.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let from = 0;
    while (carry + len - from >= step) {
      from += step - carry;
      carry = 0;
      const t = from / len;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    carry += len - from;
  }
  if (Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < step * 0.5) out.pop();
  return out;
}

export class World implements Ground {
  readonly heights = new Float32Array((N + 1) * (N + 1));
  readonly road_dist = new Float32Array((N + 1) * (N + 1)).fill(1e9);
  readonly road: RoadPoint[] = [];
  readonly trees: Tree[] = [];
  readonly checkpoints: Checkpoint[] = [];
  readonly solids: Solid[] = [];
  private readonly solid_grid = new Map<number, number[]>();

  constructor(readonly seed = 0) {
    const { heights, road_dist } = this;
    const peak = peak_of(seed);
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) heights[j * (N + 1) + i] = raw_height(ORIGIN + i * CELL, ORIGIN + j * CELL, seed, peak);

    const controls: [number, number][] = [];
    const count = 16;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 600 + (fbm(Math.cos(a) * 3, Math.sin(a) * 3, seed + 41) - 0.5) * 420;
      controls.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const path = catmull(controls, 2);
    let ys = path.map(([x, z]) => Math.max(3, this.height(x, z)));
    for (let pass = 0; pass < 4; pass++) {
      const window = 24;
      ys = ys.map((_, i) => {
        let sum = 0;
        for (let k = -window; k <= window; k++) sum += ys[(i + k + ys.length) % ys.length];
        return sum / (window * 2 + 1);
      });
    }
    for (let i = 0; i < path.length; i++) {
      const [x, z] = path[i];
      const [nx, nz] = path[(i + 1) % path.length];
      const len = Math.hypot(nx - x, nz - z) || 1;
      this.road.push({ x, y: ys[i], z, tx: (nx - x) / len, tz: (nz - z) / len });
    }

    const road_height = new Float32Array(heights.length);
    const reach = ROAD_HALF + SHOULDER;
    for (let s = 0; s < this.road.length; s++) {
      const a = this.road[s];
      const b = this.road[(s + 1) % this.road.length];
      const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - reach - ORIGIN) / CELL));
      const i1 = Math.min(N, Math.ceil((Math.max(a.x, b.x) + reach - ORIGIN) / CELL));
      const j0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - reach - ORIGIN) / CELL));
      const j1 = Math.min(N, Math.ceil((Math.max(a.z, b.z) + reach - ORIGIN) / CELL));
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz || 1;
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const px = ORIGIN + i * CELL;
          const pz = ORIGIN + j * CELL;
          const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
          const d = Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t));
          const k = j * (N + 1) + i;
          if (d < road_dist[k]) {
            road_dist[k] = d;
            road_height[k] = a.y + (b.y - a.y) * t;
          }
        }
    }
    for (let k = 0; k < heights.length; k++) {
      if (road_dist[k] > reach) continue;
      const w = 1 - smoothstep(ROAD_HALF + 1.5, reach, road_dist[k]);
      heights[k] += (road_height[k] - 0.05 - heights[k]) * w;
    }

    const cps = 12;
    for (let i = 0; i < cps; i++) {
      const p = this.road[Math.floor((i / cps) * this.road.length)];
      this.checkpoints.push({ x: p.x, y: p.y, z: p.z, heading: Math.atan2(p.tx, p.tz), index: i });
      for (const side of [-1, 1]) {
        const off = side * (ROAD_HALF + 1.7);
        const x = p.x - p.tz * off;
        const z = p.z + p.tx * off;
        this.add_solid({ x, y: this.height(x, z), z, radius: 0.5, height: 7 });
      }
    }

    const spacing = 13;
    for (let z = ORIGIN + spacing; z < -ORIGIN - spacing; z += spacing)
      for (let x = ORIGIN + spacing; x < -ORIGIN - spacing; x += spacing) {
        const px = x + (hash(x, z, seed + 91) - 0.5) * spacing;
        const pz = z + (hash(x, z, seed + 92) - 0.5) * spacing;
        const density = fbm(px / 180, pz / 180, seed + 55, 3);
        if (hash(x, z, seed + 93) > (density - 0.38) * 2.6) continue;
        const y = this.height(px, pz);
        if (y < 3 || y > 125) continue;
        if (this.distance_to_road(px, pz) < ROAD_HALF + 7) continue;
        const n = this.normal(px, pz, new Vector3());
        if (n.y < 0.82) continue;
        this.add_tree({ x: px, y, z: pz, scale: 0.75 + hash(x, z, seed + 94) * 0.9, kind: hash(x, z, seed + 95) < 0.7 ? 0 : 1 });
      }
  }

  private add_tree(tree: Tree) {
    this.trees.push(tree);
    this.add_solid({ x: tree.x, y: tree.y, z: tree.z, radius: 0.35 * tree.scale, height: 6 * tree.scale });
  }

  private add_solid(solid: Solid) {
    const index = this.solids.push(solid) - 1;
    const key = this.grid_key(Math.floor(solid.x / 16), Math.floor(solid.z / 16));
    const list = this.solid_grid.get(key);
    if (list) list.push(index);
    else this.solid_grid.set(key, [index]);
  }

  private grid_key(cx: number, cz: number) {
    return (cx + 1000) * 4096 + (cz + 1000);
  }

  private corner(x: number, z: number) {
    const gx = Math.max(0, Math.min(N - 1e-4, (x - ORIGIN) / CELL));
    const gz = Math.max(0, Math.min(N - 1e-4, (z - ORIGIN) / CELL));
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    return { i, j, fx: gx - i, fz: gz - j };
  }

  private lerp_field(field: Float32Array, x: number, z: number): number {
    const { i, j, fx, fz } = this.corner(x, z);
    const k = j * (N + 1) + i;
    const h00 = field[k];
    const h10 = field[k + 1];
    const h01 = field[k + N + 1];
    const h11 = field[k + N + 2];
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

  height(x: number, z: number): number {
    return this.lerp_field(this.heights, x, z);
  }

  normal(x: number, z: number, out: Vector3): Vector3 {
    const { i, j, fx, fz } = this.corner(x, z);
    const h = this.heights;
    const k = j * (N + 1) + i;
    if (fx + fz <= 1) return out.set(h[k] - h[k + 1], CELL, h[k] - h[k + N + 1]).normalize();
    return out.set(h[k + N + 1] - h[k + N + 2], CELL, h[k + 1] - h[k + N + 2]).normalize();
  }

  distance_to_road(x: number, z: number): number {
    return this.lerp_field(this.road_dist, x, z);
  }

  grip(x: number, z: number): number {
    const d = this.distance_to_road(x, z);
    return d < ROAD_HALF + 0.5 ? 1 : d < ROAD_HALF + 3 ? 0.85 : 0.72;
  }

  roll(x: number, z: number): number {
    return this.distance_to_road(x, z) < ROAD_HALF + 3 ? 1 : 12;
  }

  nearest_road(x: number, z: number): RoadPoint {
    let best = this.road[0];
    let dist = Infinity;
    for (const p of this.road) {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < dist) {
        dist = d;
        best = p;
      }
    }
    return best;
  }

  // The car is two circles (nose and tail) so a corner clip spins it instead of stopping it dead; the push and
  // the yaw kick come from the same impulse applied at that circle's offset from the centre of mass.
  collide(pos: Vector3, vel: Vector3, ang: Vector3, heading: number): number {
    let impact = 0;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    for (const offset of [1.25, -1.25]) {
      const px = pos.x + fx * offset;
      const pz = pos.z + fz * offset;
      const cx = Math.floor(px / 16);
      const cz = Math.floor(pz / 16);
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const list = this.solid_grid.get(this.grid_key(cx + dx, cz + dz));
          if (!list) continue;
          for (const index of list) {
            const solid = this.solids[index];
            if (pos.y > solid.y + solid.height) continue;
            const ox = px - solid.x;
            const oz = pz - solid.z;
            const d = Math.hypot(ox, oz);
            const min = CAR_RADIUS + solid.radius;
            if (d >= min || d < 1e-3) continue;
            const nx = ox / d;
            const nz = oz / d;
            pos.x += nx * (min - d);
            pos.z += nz * (min - d);
            const rx = fx * offset;
            const rz = fz * offset;
            const into = vel.x * nx + vel.z * nz + ang.y * (rz * nx - rx * nz);
            if (into >= 0) continue;
            impact = Math.max(impact, -into);
            const arm = rz * nx - rx * nz;
            const impulse = (-into * 1.25) / (1 / CAR_BODY.mass + (arm * arm) / CAR_BODY.yaw_inertia);
            vel.x += (nx * impulse) / CAR_BODY.mass;
            vel.z += (nz * impulse) / CAR_BODY.mass;
            ang.y += (arm * impulse) / CAR_BODY.yaw_inertia;
            vel.multiplyScalar(0.9);
            ang.x *= 0.7;
            ang.z *= 0.7;
          }
        }
    }
    return impact;
  }
}

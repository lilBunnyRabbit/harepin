import { sample } from "./field";
import { length } from "./noise";
import { chaikin, limit_grade, resample, road_points, smooth, type Path } from "./path";
import { ORIGIN, ROAD_HALF, SIZE, SPUR_GRADE, type RoadPoint, type Town } from "./types";

const COARSE = 16;
const G = SIZE / COARSE;
const SLOPE_COST = 40;
const MAX_GRADE = 0.2;
const STEEP_COST = 30;
const WATER = 2;
const RING_BAND = 18;
const TOWN_MARGIN = 14;
const OWN_TOWN_MARGIN = 8;
const CORRIDOR = COARSE * 1.5;
const SPUR_BAND = 2;
/** Spur points held at the end heights, 2 m apart: the flat run where the spur meets the plateau or the ring. */
const HOLD = 10;
/** The last APPROACH metres of a spur run straight along the ring normal, so it meets the ring as a clean T. */
export const APPROACH = 32;
// Shaping aims under SPUR_GRADE so the smoothing after the clamp cannot push a 10 m window over it.
export const SHAPE_GRADE = SPUR_GRADE - 0.015;
const NEED_MARGIN = 12;
const JOIN_TRIES = 16;
/** Ring points between two join candidates, 2 m apart. */
const JOIN_SPACING = 20;
/** cos² of the sharpest control-polygon turn a spur keeps (60°); a 90° turn on 16 m cells smooths to about ROAD_HALF. */
const TURN_COS2 = 0.25;

export class Heap {
  private readonly keys: number[] = [];
  private readonly items: number[] = [];

  get size() {
    return this.items.length;
  }

  push(item: number, key: number) {
    const { keys, items } = this;
    let i = items.length;
    keys.push(key);
    items.push(item);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const { keys, items } = this;
    const top = items[0];
    const last_key = keys.pop() ?? 0;
    const last_item = items.pop() ?? 0;
    if (items.length) {
      keys[0] = last_key;
      items[0] = last_item;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && this.less(l, m)) m = l;
        if (r < items.length && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private less(a: number, b: number) {
    return this.keys[a] < this.keys[b] || (this.keys[a] === this.keys[b] && this.items[a] < this.items[b]);
  }

  private swap(a: number, b: number) {
    const { keys, items } = this;
    [keys[a], keys[b]] = [keys[b], keys[a]];
    [items[a], items[b]] = [items[b], items[a]];
  }
}

function centre(c: number): number {
  return ORIGIN + (c + 0.5) * COARSE;
}

function cell_of(v: number): number {
  return Math.max(0, Math.min(G - 1, Math.floor((v - ORIGIN) / COARSE)));
}

export class Router {
  private readonly height = new Float32Array(G * G);
  private readonly blocked = new Uint8Array(G * G);

  constructor(
    heights: Float32Array,
    road_dist: Float32Array,
    private readonly towns: Town[],
  ) {
    for (let j = 0; j < G; j++)
      for (let i = 0; i < G; i++) {
        const x = centre(i);
        const z = centre(j);
        const k = j * G + i;
        this.height[k] = sample(heights, x, z);
        if (this.height[k] < WATER || sample(road_dist, x, z) < ROAD_HALF + RING_BAND) this.blocked[k] = 1;
      }
  }

  /** A* from the gate to the ring point `to`, arriving straight along the ring normal on the gate's side. */
  route(from: { x: number; y: number; z: number }, to: RoadPoint, town: Town): Path | null {
    const side = Math.sign((from.x - to.x) * -to.tz + (from.z - to.z) * to.tx) || 1;
    const ax = to.x - to.tz * side * APPROACH;
    const az = to.z + to.tx * side * APPROACH;
    const start = cell_of(from.z) * G + cell_of(from.x);
    const goal = cell_of(az) * G + cell_of(ax);
    const out_x = ax - from.x;
    const out_z = az - from.z;
    const out_len = length(out_x, out_z) || 1;
    // Inside its own town the spur may only leave along the corridor from the gate toward the ring; the gate is the
    // node nearest the ring, so no street lies in that corridor.
    const corridor = (x: number, z: number) => {
      const along = ((x - from.x) * out_x + (z - from.z) * out_z) / out_len;
      const across = Math.abs((x - from.x) * out_z - (z - from.z) * out_x) / out_len;
      return along > 0 && across < CORRIDOR;
    };
    const free = (k: number) => {
      if (k === goal) return this.height[k] >= WATER;
      if (this.blocked[k]) return false;
      const x = centre(k % G);
      const z = centre(Math.floor(k / G));
      for (const t of this.towns) {
        const d = length(x - t.x, z - t.z);
        if (t !== town ? d < t.radius + TOWN_MARGIN : d < t.core + OWN_TOWN_MARGIN && !corridor(x, z)) return false;
      }
      return true;
    };
    if (!free(goal)) return null;
    const cost = new Float64Array(G * G).fill(Infinity);
    const came = new Int32Array(G * G).fill(-1);
    const heap = new Heap();
    cost[start] = 0;
    heap.push(start, 0);
    const gx = goal % G;
    const gz = Math.floor(goal / G);
    while (heap.size) {
      const k = heap.pop();
      if (k === goal) break;
      const i = k % G;
      const j = Math.floor(k / G);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= G || nj >= G) continue;
          const n = nj * G + ni;
          if (!free(n)) continue;
          const run = (di && dj ? Math.SQRT2 : 1) * COARSE;
          const grade = Math.abs(this.height[n] - this.height[k]) / run;
          const step = run * (1 + SLOPE_COST * grade * grade) + (grade > MAX_GRADE ? STEEP_COST * run : 0);
          const total = cost[k] + step;
          if (total >= cost[n]) continue;
          cost[n] = total;
          came[n] = k;
          heap.push(n, total + length(ni - gx, nj - gz) * COARSE);
        }
    }
    if (came[goal] < 0 && goal !== start) return null;
    const cells: Path = [];
    for (let k = came[goal]; k !== start && k >= 0; k = came[k]) cells.push([centre(k % G), centre(Math.floor(k / G))]);
    cells.reverse();
    const clear = (x: number, z: number) => length(x - from.x, z - from.z) > COARSE * 1.5 && length(x - ax, z - az) > COARSE * 1.5;
    return unkink([[from.x, from.z], ...cells.filter(([x, z]) => clear(x, z)), [ax, az], [to.x, to.z]], from.y, to.y);
  }

  /** Blocks the cells along an accepted spur so later spurs keep their distance. */
  claim(path: Path) {
    for (const [x, z] of path) {
      const c = cell_of(z) * G + cell_of(x);
      for (let dj = -SPUR_BAND; dj <= SPUR_BAND; dj++)
        for (let di = -SPUR_BAND; di <= SPUR_BAND; di++) {
          const n = c + dj * G + di;
          if (n >= 0 && n < G * G) this.blocked[n] = 1;
        }
    }
  }
}

/** Ring indices to try as the spur's T, nearest first, at least JOIN_SPACING points apart. */
export function join_candidates(road: RoadPoint[], from: { x: number; z: number }): number[] {
  const n = road.length;
  const order = road.map((p, i) => [length(p.x - from.x, p.z - from.z), i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const picked: number[] = [];
  for (const [, i] of order) {
    if (picked.length >= JOIN_TRIES) break;
    if (picked.every((j) => Math.min((i - j + n) % n, (j - i + n) % n) >= JOIN_SPACING)) picked.push(i);
  }
  return picked;
}

/** Steepest rise over run the spur can reach between its pinned ends; above SPUR_GRADE the route is too short. */
export function spur_need(path: Path, from_y: number, to_y: number): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += length(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return Math.abs(to_y - from_y) / Math.max(1, total - HOLD * 4 - NEED_MARGIN);
}

function reverses(a: [number, number], b: [number, number], c: [number, number]): boolean {
  return (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) <= 0;
}

function turn_too_sharp(a: [number, number], b: [number, number], c: [number, number]): boolean {
  const ux = b[0] - a[0];
  const uz = b[1] - a[1];
  const vx = c[0] - b[0];
  const vz = c[1] - b[1];
  const dot = ux * vx + uz * vz;
  return dot <= 0 || dot * dot < TURN_COS2 * (ux * ux + uz * uz) * (vx * vx + vz * vz);
}

// A* on the coarse grid zig-zags between cells; chaikin turns a reversal into a bend tighter than the spur's half width,
// whose inner edge folds over itself. Drops the cell at each sharp corner, keeping the gate, the approach point and the
// junction. A corner short of a reversal stays when the shorter spur could no longer hold SHAPE_GRADE (some zig-zags are
// the switchbacks of a climb); the mesh pulls in the inner edge there. A reversal always goes: no ribbon survives one.
function unkink(cells: Path, from_y: number, to_y: number): Path {
  let out = cells;
  for (let i = 1; i < out.length - 1; ) {
    if (!turn_too_sharp(out[i - 1], out[i], out[i + 1])) {
      i++;
      continue;
    }
    const drop = i < out.length - 2 ? i : i - 1;
    const next = out.filter((_, k) => k !== drop);
    if (drop < 1 || (!reverses(out[i - 1], out[i], out[i + 1]) && spur_need(next, from_y, to_y) > SHAPE_GRADE)) {
      i++;
      continue;
    }
    out = next;
    i = Math.max(1, drop - 1);
  }
  return out;
}

export function spur_points(cells: Path, heights: Float32Array, from_y: number, to_y: number): RoadPoint[] {
  const path = resample(chaikin(cells, 4), 2, false);
  const n = path.length;
  const run = path.slice(1).map(([x, z], i) => length(x - path[i][0], z - path[i][1]));
  const pinned = (ys: number[]) => ys.map((y, i) => (i < HOLD ? from_y : i > n - 1 - HOLD ? to_y : y));
  let ys = pinned(smooth(path.map(([x, z]) => Math.max(3, sample(heights, x, z))), 10, 3, false));
  ys = limit_grade(ys, run, SHAPE_GRADE);
  ys = limit_grade(pinned(smooth(ys, 4, 2, false)), run, SHAPE_GRADE);
  return road_points(path, ys, false);
}

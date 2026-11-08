import { sample } from "./field";
import { length, smoothstep } from "./noise";
import { chaikin, resample, road_points, smooth, type Path } from "./path";
import { ORIGIN, ROAD_HALF, SIZE, type RoadPoint, type Town } from "./types";

const COARSE = 16;
const G = SIZE / COARSE;
const SLOPE_COST = 40;
const MAX_GRADE = 0.2;
const STEEP_COST = 30;
const WATER = 2;
const RING_BAND = 18;
const GOAL_FREE = 40;
const TOWN_MARGIN = 14;
const SPUR_BAND = 2;
const PIN = 20;

class Heap {
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

  route(from: { x: number; z: number }, to: { x: number; z: number }, town: Town): Path | null {
    const start = cell_of(from.z) * G + cell_of(from.x);
    const goal = cell_of(to.z) * G + cell_of(to.x);
    const gate_reach = length(from.x - town.x, from.z - town.z);
    const free = (k: number) => {
      const x = centre(k % G);
      const z = centre(Math.floor(k / G));
      if (length(x - to.x, z - to.z) < GOAL_FREE) return this.height[k] >= WATER;
      if (this.blocked[k]) return false;
      for (const t of this.towns) {
        const d = length(x - t.x, z - t.z);
        if (t === town ? d < gate_reach - 8 : d < t.radius + TOWN_MARGIN) return false;
      }
      return true;
    };
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
    if (came[goal] < 0) return null;
    const cells: Path = [];
    for (let k = came[goal]; k !== start && k >= 0; k = came[k]) cells.push([centre(k % G), centre(Math.floor(k / G))]);
    cells.reverse();
    for (let k = 0; k < cells.length; k++) {
      const [x, z] = cells[k];
      const c = cell_of(z) * G + cell_of(x);
      for (let dj = -SPUR_BAND; dj <= SPUR_BAND; dj++)
        for (let di = -SPUR_BAND; di <= SPUR_BAND; di++) {
          const n = c + dj * G + di;
          if (n >= 0 && n < G * G) this.blocked[n] = 1;
        }
    }
    return [[from.x, from.z], ...cells, [to.x, to.z]];
  }
}

export function spur_points(cells: Path, heights: Float32Array, from_y: number, to_y: number): RoadPoint[] {
  const path = resample(chaikin(cells, 4), 2, false);
  const n = path.length;
  const ys = smooth(
    path.map(([x, z]) => Math.max(3, sample(heights, x, z))),
    10,
    3,
    false,
  ).map((y, i) => {
    const head = 1 - smoothstep(0, PIN, i);
    const tail = 1 - smoothstep(0, PIN, n - 1 - i);
    return y + (from_y - y) * head + (to_y - y) * tail;
  });
  return road_points(path, ys, false);
}

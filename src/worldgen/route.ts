import { sample } from "./field";
import { Heap } from "./heap";
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
/** Extra cost of crossing the circuit, in metres: one crossing where a detour of up to this much avoids a second. */
export const CROSS_COST = 200;
/** Tightest bend a spur or link may take, m: a square departure that bends harder is routed another way. */
export const MIN_RADIUS = 11;
const BEND_SPAN = 2;
/** cos² of the sharpest control-polygon turn a spur keeps (60°); a 90° turn on 16 m cells smooths to about ROAD_HALF. */
const TURN_COS2 = 0.25;

/** A unit direction on the ground. */
export interface Way {
  x: number;
  z: number;
}

/** A point a link may start or end at, with what it costs to get there from the town it serves. */
export interface Port {
  x: number;
  z: number;
  cost: number;
}

/** A place the circuit may be crossed square: the approach points either side of it. */
export interface Crossing {
  a: Way;
  b: Way;
}

/** A town a link starts or ends at by its own exit: its core is open only along the exit's corridor. */
export interface Exit {
  town: Town;
  x: number;
  z: number;
  way: Way;
}

export interface LinkPath {
  source: number;
  goal: number;
  /** Cells between the ports, split where the path crosses the circuit; `crossings[k]` sits between legs k and k + 1. */
  legs: Path[];
  crossings: number[];
  /** Whether crossing k was taken from its `a` side. */
  forward: boolean[];
  cost: number;
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
  /** Cells kept off outright: unlike a road band, no run into a junction or link port may enter one. */
  private readonly kept = new Uint8Array(G * G);

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

  /**
   * A* from the gate to the ring point `to`, arriving straight along the ring normal on the gate's side. With `out` the
   * spur first leaves the gate straight along that unit direction, so it meets the gate's streets square.
   */
  route(from: { x: number; y: number; z: number }, to: RoadPoint, town: Town, out: Way | null = null): Path | null {
    const side = Math.sign((from.x - to.x) * -to.tz + (from.z - to.z) * to.tx) || 1;
    const ax = to.x - to.tz * side * APPROACH;
    const az = to.z + to.tx * side * APPROACH;
    const sx = out ? from.x + out.x * APPROACH : from.x;
    const sz = out ? from.z + out.z * APPROACH : from.z;
    const start = cell_of(sz) * G + cell_of(sx);
    const goal = cell_of(az) * G + cell_of(ax);
    const out_x = out ? out.x : ax - from.x;
    const out_z = out ? out.z : az - from.z;
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
    const clear = (x: number, z: number) => length(x - sx, z - sz) > COARSE * 1.5 && length(x - ax, z - az) > COARSE * 1.5;
    const head: Path = out ? [[from.x, from.z], [sx, sz]] : [[from.x, from.z]];
    return unkink([...head, ...cells.filter(([x, z]) => clear(x, z)), [ax, az], [to.x, to.z]], from.y, to.y, head.length);
  }

  /**
   * Cheapest way from any source port to any goal port over open ground, where the circuit can only be crossed at one of
   * `crossings`. Ports and crossing ends sit beside a road on purpose, so they are doors: a path may start or land on one
   * inside a blocked band and leave it, or end there, but never walk through it.
   */
  link(sources: readonly Port[], goals: readonly Port[], crossings: readonly Crossing[], exits: readonly Exit[], limit = Infinity): LinkPath | null {
    if (!sources.length || !goals.length) return null;
    const cells = G * G;
    // Flags over the grid, so the search's inner loop checks a cell without a map lookup.
    const portal = new Uint8Array(cells);
    const special = new Uint8Array(cells);
    const at = (p: Way) => cell_of(p.z) * G + cell_of(p.x);
    const goal_at = new Map<number, number[]>();
    goals.forEach((g, i) => {
      const k = at(g);
      portal[k] = special[k] = 1;
      goal_at.set(k, [...(goal_at.get(k) ?? []), i]);
    });
    const hops = new Map<number, { to: number; crossing: number; forward: boolean }[]>();
    crossings.forEach((c, i) => {
      const a = at(c.a);
      const b = at(c.b);
      portal[a] = portal[b] = special[a] = special[b] = 1;
      hops.set(a, [...(hops.get(a) ?? []), { to: b, crossing: i, forward: true }]);
      hops.set(b, [...(hops.get(b) ?? []), { to: a, crossing: i, forward: false }]);
    });
    for (const p of sources) portal[at(p)] = 1;
    const corridor = (e: Exit, x: number, z: number) => {
      const along = (x - e.x) * e.way.x + (z - e.z) * e.way.z;
      const across = Math.abs((x - e.x) * e.way.z - (z - e.z) * e.way.x);
      return along > 0 && across < CORRIDOR;
    };
    const open = new Uint8Array(cells);
    for (let k = 0; k < cells; k++) if (this.height[k] >= WATER && !this.blocked[k]) open[k] = 1;
    for (const t of this.towns) {
      const exit = exits.find((e) => e.town === t);
      const reach = exit ? t.core + OWN_TOWN_MARGIN : t.radius + TOWN_MARGIN;
      for (let j = cell_of(t.z - reach); j <= cell_of(t.z + reach); j++)
        for (let i = cell_of(t.x - reach); i <= cell_of(t.x + reach); i++) {
          const k = j * G + i;
          const x = centre(i);
          const z = centre(j);
          if (length(x - t.x, z - t.z) >= reach || (exit && corridor(exit, x, z))) continue;
          open[k] = 0;
        }
    }
    const free = (k: number) => open[k] === 1;
    const door = (k: number) => portal[k] === 1 && this.height[k] >= WATER && !this.kept[k];
    const launched = new Uint8Array(cells);
    const near = octile(goals.map(at));
    const cost = new Float64Array(cells + goals.length).fill(Infinity);
    const came = new Int32Array(cells).fill(-1);
    const hop = new Int32Array(cells).fill(-1);
    const source = new Int32Array(cells).fill(-1);
    const heap = new Heap();
    sources.forEach((p, i) => {
      const k = at(p);
      if (!door(k) || p.cost >= cost[k]) return;
      cost[k] = p.cost;
      source[k] = i;
      launched[k] = 1;
      heap.push(k, p.cost + near[k]);
    });
    const step_to = (k: number, n: number, step: number, via: number) => {
      const total = cost[k] + step;
      if (total >= cost[n]) return;
      cost[n] = total;
      came[n] = k;
      hop[n] = via;
      source[n] = source[k];
      launched[n] = via === -1 ? 0 : 1;
      heap.push(n, total + near[n]);
    };
    let goal = -1;
    // Keys only grow along the search, so once the least reaches `limit` no cheaper link is left to find.
    while (heap.size && heap.least < limit) {
      const k = heap.pop();
      if (k >= cells) {
        goal = k - cells;
        break;
      }
      if (special[k]) {
        for (const g of goal_at.get(k) ?? []) {
          const total = cost[k] + goals[g].cost;
          if (total < cost[cells + g]) {
            cost[cells + g] = total;
            heap.push(cells + g, total);
          }
        }
        for (const h of hops.get(k) ?? []) if (door(h.to)) step_to(k, h.to, 2 * APPROACH + CROSS_COST, h.forward ? h.crossing : -2 - h.crossing);
      }
      if (!free(k) && !launched[k]) continue;
      const i = k % G;
      const j = Math.floor(k / G);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= G || nj >= G) continue;
          const n = nj * G + ni;
          if (!free(n) && !door(n)) continue;
          const run = (di && dj ? Math.SQRT2 : 1) * COARSE;
          const grade = Math.abs(this.height[n] - this.height[k]) / run;
          step_to(k, n, run * (1 + SLOPE_COST * grade * grade) + (grade > MAX_GRADE ? STEEP_COST * run : 0), -1);
        }
    }
    if (goal < 0) return null;
    let k = at(goals[goal]);
    const legs: Path[] = [[]];
    const taken: number[] = [];
    const forward: boolean[] = [];
    const first = source[k];
    for (;;) {
      legs[0].unshift([centre(k % G), centre(Math.floor(k / G))]);
      const via = hop[k];
      if (via !== -1) {
        taken.unshift(via >= 0 ? via : -2 - via);
        forward.unshift(via >= 0);
        legs.unshift([]);
      }
      if (came[k] < 0) break;
      k = came[k];
    }
    return { source: first, goal, legs, crossings: taken, forward, cost: cost[cells + goal] };
  }

  /** Whether every point from `from` to `to` lies on a cell nothing blocks, and no point at all on a kept-off cell. */
  clear(points: readonly RoadPoint[], from: number, to: number): boolean {
    for (let i = 0; i < points.length; i++) {
      const k = cell_of(points[i].z) * G + cell_of(points[i].x);
      if (this.kept[k] || (i >= from && i < to && this.blocked[k])) return false;
    }
    return true;
  }

  /** Blocks every cell within `reach` of the line. */
  keep_off(line: readonly [number, number][], reach: number) {
    for (const [x, z] of line)
      for (let j = cell_of(z - reach); j <= cell_of(z + reach); j++)
        for (let i = cell_of(x - reach); i <= cell_of(x + reach); i++) if (length(centre(i) - x, centre(j) - z) < reach) this.blocked[j * G + i] = this.kept[j * G + i] = 1;
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

// Grid steps cost at least their run and a crossing more than its jump, so octile distance to the nearest goal never
// overestimates: A* stays exact while it skips most of the grid.
function octile(goals: readonly number[]): Float64Array {
  const d = new Float64Array(G * G).fill(Infinity);
  for (const k of goals) d[k] = 0;
  const diagonal = Math.SQRT2 * COARSE;
  const relax = (k: number, n: number, step: number) => {
    if (d[n] + step < d[k]) d[k] = d[n] + step;
  };
  for (let j = 0; j < G; j++)
    for (let i = 0; i < G; i++) {
      const k = j * G + i;
      if (i > 0) relax(k, k - 1, COARSE);
      if (j > 0) {
        relax(k, k - G, COARSE);
        if (i > 0) relax(k, k - G - 1, diagonal);
        if (i < G - 1) relax(k, k - G + 1, diagonal);
      }
    }
  for (let j = G - 1; j >= 0; j--)
    for (let i = G - 1; i >= 0; i--) {
      const k = j * G + i;
      if (i < G - 1) relax(k, k + 1, COARSE);
      if (j < G - 1) {
        relax(k, k + G, COARSE);
        if (i < G - 1) relax(k, k + G + 1, diagonal);
        if (i > 0) relax(k, k + G - 1, diagonal);
      }
    }
  return d;
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
// The first `head` points (the gate and its departure point) and the last two stay. A departure point, and with
// `square_end` the approach point, keeps any turn short of a reversal: its legs run APPROACH metres, so chaikin rounds
// even a square turn wide, and dropping cells beside it until the turn eased would cut straight across whatever the
// path went round.
export function unkink(cells: Path, from_y: number, to_y: number, head = 1, square_end = false): Path {
  let out = cells;
  for (let i = 1; i < out.length - 1; ) {
    const sharp = i < head || (square_end && i === out.length - 2) ? reverses : turn_too_sharp;
    if (!sharp(out[i - 1], out[i], out[i + 1])) {
      i++;
      continue;
    }
    const fixed = (k: number) => k < head || k >= out.length - 2;
    const drop = !fixed(i) ? i : !fixed(i + 1) ? i + 1 : i - 1;
    const next = out.filter((_, k) => k !== drop);
    if (drop < 1 || fixed(drop) || (!reverses(out[i - 1], out[i], out[i + 1]) && spur_need(next, from_y, to_y) > SHAPE_GRADE)) {
      i++;
      continue;
    }
    out = next;
    i = Math.max(1, Math.min(i, drop) - 1);
  }
  return out;
}

/** Smallest bend radius along the road, from tangents BEND_SPAN points either side. */
export function tightest(points: readonly RoadPoint[]): number {
  let radius = Infinity;
  for (let i = BEND_SPAN; i < points.length - BEND_SPAN; i++) {
    const a = points[i - BEND_SPAN];
    const b = points[i + BEND_SPAN];
    const half_sin = Math.sqrt(Math.max(0, (1 - (a.tx * b.tx + a.tz * b.tz)) / 2));
    if (half_sin > 0) radius = Math.min(radius, length(b.x - a.x, b.z - a.z) / 2 / half_sin);
  }
  return radius;
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

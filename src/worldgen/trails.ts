import { mulberry32, sub } from "../rng";
import { peak } from "./canyon";
import { cell_range, sample, up, vertex } from "./field";
import { DECK_GRADE, gap_jump, type GapJump } from "./gap";
import { circle16, length, smoothstep } from "./noise";
import { chaikin, limit_grade, resample, road_points, smooth, type Path } from "./path";
import { Heap } from "./heap";
import type { Stamp, TrailLine } from "./stamp";
import { CELL, N, ORIGIN, ROAD_HALF, SIZE, type Canyon, type RoadPoint, type Solid, type Terrain, type Town } from "./types";

const GRID = 16;
const G = SIZE / GRID;
const SLOPE_COST = 20;
const MAX_GRADE = 0.2;
const STEEP_COST = 60;
const SCARP = 0.55;
const ROUGH_COST = 400;
// A flat toll per road crossed, and a per-metre one for staying on it: trails cross roads rarely and never run along one.
const ROAD_CROSS = 200;
const ROAD_STAY = 4;
const ROAD_BAND = 10;
const WATER = 3.5;
const TOWN_MARGIN = 20;
const SOLID_MARGIN = 8;
const CANYON_MARGIN = 10;
// Weighted A*: a trail need not be the cheapest line, and this explores a fraction of the grid.
const GREED = 2;
/** Cells this close to the straight's ends on its own side are fenced, so legs meet it from behind and leave ahead. */
const FENCE = 48;
/** cos² of the sharpest turn kept between grid cells (60°). */
const TURN_COS2 = 0.25;
/** A leg may meet the jump straight at most this far off its line (cos): past it the run-up starts from a hairpin. */
const JOIN_COS = 0.3;

// The run-up is long enough for the slowest car out of a bend to reach GAP_V_MIN at the toe.
const RUNUP = 70;
const RUNOUT = 40;
const PAD_HALF = 9;
const PAD_BLEND = 8;
// Only the last HARD metres of the run-up and the deck are set to the jump planes; the rest of the straight eases back to the ground.
const HARD = 30;
/** Ground under the deck stays this far below it, so the analytic plane is all a wheel touches. */
const DECK_SINK = 0.3;
const SINK_TAPER = 10;
const MAX_FILL = 9;
const MAX_RIM_STEP = 10;
const APPROACH_GRADE = 0.08;
/** Canyon points either side of a crossing that must run straight: the slot reads as one cut across it. */
const STRAIGHT_SPAN = 6;
const STRAIGHT_TURN = 0.45;
const ROAD_CLEAR = ROAD_HALF + 16;
// The ramp-out runs along the floor first, clear of the promontories, before it climbs the far wall.
const FLOOR_RUN = 24;
const RAMP_GRADE = 0.2;
const RAMP_MIN = 40;
const RIM_OUT = 6;
const TRAIL_BLEND = 0.5;
const TRAIL_GRADE = 0.18;
const CUT_BLEND = 0.8;
const CUT_PER_M = 0.2;
// Deeper than this a cut or fill would leave a trench or a dyke one car wide: the trail keeps the slope instead.
const MAX_CUT = 1.5;
/** Steepest the trail may get over STEEP_SPAN points once graded: past it is a bank no car climbs. */
const MAX_STEEP = 0.8;
const STEEP_SPAN = 3;
const STEP = 2;

const SHOULDER_TOP = 110;
const SHOULDER_LOW = 70;
const COAST_HIGH = 8;
const START_OUT = 24;
/** Starts sit on ground at most this steep (the unit normal's y): a standing start on a hillside slides back. */
const LEVEL_UP = 0.97;
const OPTIONS = 6;
const WINDOWS = [
  { id: "offroad-1", min: 1200, max: 3000, aim: 2000 },
  { id: "offroad-2", min: 2200, max: 4400, aim: 3200 },
];

export interface Trail {
  id: string;
  points: RoadPoint[];
  /** Point index of the take-off toe, and of the run-out end where the ramp-out joins; -1 without a gap. */
  toe: number;
  rejoin: number;
}

export interface Trails {
  trails: Trail[];
  gap: GapJump | null;
  /** From the canyon floor under the gap up the far wall to the trail: a car that falls short drives out here. */
  ramp_out: RoadPoint[];
}

type Point = [number, number];

interface Crossing {
  /** Canyon centre under the gap, the trail's way across it and the canyon's way upstream. */
  cx: number;
  cz: number;
  dx: number;
  dz: number;
  ux: number;
  uz: number;
  y: number;
  /** Rise per metre toward the toe on the run-up, and fall per metre past the deck end. */
  before: number;
  after: number;
  jump: GapJump;
  /** Metres along (dx, dz) from the toe: the straight runs `from` to `to`, the slot `slot0` to `slot1`. */
  from: number;
  to: number;
  slot0: number;
  slot1: number;
  deck_end: number;
  ramp_out: RoadPoint[];
  /** Segments of `ramp_out` that cut the wall, set hard; past them it only marks the ground as dirt. */
  cut: number;
}

const centre = (c: number) => ORIGIN + (c + 0.5) * GRID;
const cell_of = (v: number) => Math.max(0, Math.min(G - 1, Math.floor((v - ORIGIN) / GRID)));
const key = (x: number, z: number) => cell_of(z) * G + cell_of(x);
const dist = (a: Point, b: Point) => length(a[0] - b[0], a[1] - b[1]);

function run(path: Path): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + dist(path[i - 1], path[i]));
  return out;
}

/** Ground height `v` metres along the straight from the toe; null over the slot, which keeps the canyon. */
function profile(c: Crossing, v: number): number | null {
  if (v < 0) return c.y + c.before * v;
  if (v <= c.slot0) return c.y;
  if (v < c.slot1) return null;
  if (v <= c.deck_end) return c.y + DECK_GRADE * (v - c.slot1) - sink(c, v);
  return c.y + DECK_GRADE * (c.deck_end - c.slot1) - c.after * (v - c.deck_end);
}

// Tapers to nothing at the deck end, so the ground meets the deck there instead of leaving a step off it.
function sink(c: Crossing, v: number): number {
  return v > c.slot1 && v <= c.deck_end ? DECK_SINK * Math.min(1, (c.deck_end - v) / SINK_TAPER) : 0;
}

function scarp(heights: Float32Array, ci: number, cj: number): boolean {
  const per = GRID / CELL;
  for (let j = cj * per; j < (cj + 1) * per; j++)
    for (let i = ci * per; i < (ci + 1) * per; i++) {
      const h = heights[vertex(i, j)];
      if (Math.abs(heights[vertex(i + 1, j)] - h) > SCARP * CELL || Math.abs(heights[vertex(i, j + 1)] - h) > SCARP * CELL) return true;
    }
  return false;
}

class Planner {
  readonly blocked = new Uint8Array(G * G);
  private readonly solid = new Uint8Array(G * G);
  /** Terrain vertices inside the canyon rim. */
  private readonly gorge = new Uint8Array((N + 1) * (N + 1));
  private readonly road = new Uint8Array(G * G);
  private readonly height = new Float32Array(G * G);
  /** Cells with a scarp between their 4 m vertices: the centre heights A* compares cannot see one. */
  private readonly rough = new Uint8Array(G * G);

  constructor(
    private readonly land: Terrain,
    private readonly towns: readonly Town[],
    solids: readonly Solid[],
    private readonly canyon: Canyon | null,
  ) {
    const { heights, road_dist } = land;
    for (let j = 0; j < G; j++)
      for (let i = 0; i < G; i++) {
        const x = centre(i);
        const z = centre(j);
        const k = j * G + i;
        this.height[k] = sample(heights, x, z);
        this.rough[k] = scarp(heights, i, j) ? 1 : 0;
        if (this.height[k] < WATER || Math.abs(x) > SIZE / 2 - 3 * GRID || Math.abs(z) > SIZE / 2 - 3 * GRID) this.blocked[k] = 1;
        if (towns.some((t) => length(t.x - x, t.z - z) < t.radius + TOWN_MARGIN)) this.blocked[k] = 1;
        if (sample(road_dist, x, z) < ROAD_HALF + ROAD_BAND) this.road[k] = 1;
      }
    for (const s of solids) this.block_disc(s.x, s.z, (s.kind === "circle" ? s.radius : length(s.hw, s.hd)) + SOLID_MARGIN, this.solid);
    for (let k = 0; k < G * G; k++) this.blocked[k] |= this.solid[k];
    if (!canyon) return;
    const rim = canyon.floor + canyon.wall;
    for (const [x, z] of canyon.points) {
      this.block_disc(x, z, rim + CANYON_MARGIN);
      const [i0, i1] = cell_range(x - rim, x + rim);
      const [j0, j1] = cell_range(z - rim, z + rim);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (length(ORIGIN + i * CELL - x, ORIGIN + j * CELL - z) < rim) this.gorge[vertex(i, j)] = 1;
    }
  }

  block_disc(x: number, z: number, r: number, into = this.blocked) {
    for (let j = cell_of(z - r); j <= cell_of(z + r); j++)
      for (let i = cell_of(x - r); i <= cell_of(x + r); i++) if (length(centre(i) - x, centre(j) - z) < r + GRID / 2) into[j * G + i] = 1;
  }

  in_gorge(x: number, z: number): boolean {
    return this.gorge[vertex(Math.round((x - ORIGIN) / CELL), Math.round((z - ORIGIN) / CELL))] === 1;
  }

  /** Blocks cells within FENCE of `at` that lie ahead of it along (dx, dz), all but its own. */
  fence(at: Point, dx: number, dz: number) {
    for (let j = cell_of(at[1] - FENCE); j <= cell_of(at[1] + FENCE); j++)
      for (let i = cell_of(at[0] - FENCE); i <= cell_of(at[0] + FENCE); i++) {
        const ox = centre(i) - at[0];
        const oz = centre(j) - at[1];
        if (length(ox, oz) < FENCE && ox * dx + oz * dz > -GRID / 2 && j * G + i !== key(at[0], at[1])) this.blocked[j * G + i] = 1;
      }
  }

  free(x: number, z: number): boolean {
    return !this.blocked[key(x, z)];
  }

  free_ground(x: number, z: number): boolean {
    if (sample(this.land.heights, x, z) < WATER) return false;
    if (this.towns.some((t) => length(t.x - x, t.z - z) < t.radius + TOWN_MARGIN)) return false;
    return !this.solid[key(x, z)];
  }

  /** A* over the 16 m grid from `a` to `b`; null when walled off. */
  route(a: Point, b: Point, blocked: Uint8Array): Path | null {
    const start = key(a[0], a[1]);
    const goal = key(b[0], b[1]);
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
          if (blocked[n] && n !== goal) continue;
          const step_run = (di && dj ? Math.SQRT2 : 1) * GRID;
          const grade = Math.abs(this.height[n] - this.height[k]) / step_run;
          let step = step_run * (1 + SLOPE_COST * grade * grade) + (grade > MAX_GRADE ? STEEP_COST * step_run : 0);
          if (this.rough[n]) step += ROUGH_COST;
          if (this.road[n]) step += this.road[k] ? step_run * ROAD_STAY : ROAD_CROSS;
          const total = cost[k] + step;
          if (total >= cost[n]) continue;
          cost[n] = total;
          came[n] = k;
          heap.push(n, total + length(ni - gx, nj - gz) * GRID * GREED);
        }
    }
    if (came[goal] < 0) return null;
    const cells: Path = [];
    for (let k = came[goal]; k !== start && k >= 0; k = came[k]) cells.push([centre(k % G), centre(Math.floor(k / G))]);
    cells.reverse();
    const near = (p: Point, q: Point) => dist(p, q) < GRID * 1.2;
    return [a, ...cells.filter((p) => !near(p, a) && !near(p, b)), b];
  }

  /** The crossing with the least ground to move: a straight canyon stretch with level rims, clear of roads and towns. */
  crossing(): Crossing | null {
    const canyon = this.canyon;
    if (!canyon) return null;
    const { points } = canyon;
    const { heights, road_dist } = this.land;
    const rim = canyon.floor + canyon.wall;
    const shape = gap_jump(0, 0, 0, 0, 0, 1);
    const slot0 = shape.takeoff.length;
    const slot1 = slot0 + shape.gap;
    const deck_end = slot1 + shape.deck.length;
    let best: Crossing | null = null;
    let best_fill = Infinity;
    const lo = Math.max(STRAIGHT_SPAN, Math.floor(points.length * 0.15));
    const hi = Math.min(points.length - 1 - STRAIGHT_SPAN, Math.floor(points.length * 0.85));
    for (let c = lo; c <= hi; c += 3) {
      const [ax, az] = points[c - STRAIGHT_SPAN];
      const [bx, bz] = points[c + STRAIGHT_SPAN];
      const span = length(bx - ax, bz - az);
      const ux = (ax - bx) / span;
      const uz = (az - bz) / span;
      const [mx, mz] = points[c];
      const bend = (px: number, pz: number) => Math.abs((px - mx) * uz - (pz - mz) * ux) / (length(px - mx, pz - mz) || 1);
      if (bend(ax, az) > STRAIGHT_TURN || bend(bx, bz) > STRAIGHT_TURN) continue;
      const [cx, cz] = points[c];
      for (const side of [-1, 1]) {
        const dx = -uz * side;
        const dz = ux * side;
        const near = sample(heights, cx - dx * (rim + 4), cz - dz * (rim + 4));
        const far = sample(heights, cx + dx * (rim + 4), cz + dz * (rim + 4));
        if (Math.abs(near - far) > MAX_RIM_STEP) continue;
        const toe_at = -(slot0 + slot1) / 2;
        const tx = cx + dx * toe_at;
        const tz = cz + dz * toe_at;
        const along = (v: number): Point => [tx + dx * v, tz + dz * v];
        const y = (near + far) / 2;
        const end_y = y + DECK_GRADE * (deck_end - slot1);
        let lean_a = 0;
        let lean_b = 0;
        let norm = 0;
        for (let v = 8; v <= Math.min(RUNUP, RUNOUT); v += 8) norm += v * v;
        for (let v = 8; v <= Math.min(RUNUP, RUNOUT); v += 8) {
          lean_a += v * (y - sample(heights, ...along(-v)));
          lean_b += v * (end_y - sample(heights, ...along(deck_end + v)));
        }
        const clamp = (g: number) => Math.max(-APPROACH_GRADE, Math.min(APPROACH_GRADE, g));
        const cross: Crossing = {
          cx, cz, dx, dz, ux, uz, y,
          before: clamp(lean_a / norm),
          after: clamp(lean_b / norm),
          jump: gap_jump(0, tx, y, tz, dx, dz),
          from: -RUNUP, to: deck_end + RUNOUT, slot0, slot1, deck_end,
          ramp_out: [], cut: 0,
        };
        let fill = 0;
        let ok = true;
        for (let v = -RUNUP; v <= deck_end + RUNOUT && ok; v += 4)
          for (let u = -PAD_HALF - PAD_BLEND; u <= PAD_HALF + PAD_BLEND && ok; u += 4) {
            const x = tx + dx * v + dz * u;
            const z = tz + dz * v - dx * u;
            const core = Math.abs(u) <= PAD_HALF;
            if ((core && sample(road_dist, x, z) < ROAD_CLEAR) || !this.free_ground(x, z)) ok = false;
            const want = profile(cross, v);
            if (!ok || want === null || v < -HARD || v > deck_end || !core) continue;
            const h = sample(heights, x, z);
            if (Math.abs(v + toe_at) > rim && Math.abs(h - want) > MAX_FILL) ok = false;
            fill += Math.abs(h - want);
          }
        if (!ok || fill >= best_fill) continue;
        if (!this.ramp_out(cross, rim + RIM_OUT)) continue;
        best = cross;
        best_fill = fill;
      }
    }
    return best;
  }

  /** Floor under the gap, upstream along it, a climb up the far wall to the rim, then over to the run-out end. */
  private ramp_out(c: Crossing, rim: number): boolean {
    const { heights, road_dist } = this.land;
    const floor_y = sample(heights, c.cx, c.cz);
    const guess = sample(heights, c.cx + c.ux * (FLOOR_RUN + RAMP_MIN) + c.dx * rim, c.cz + c.uz * (FLOOR_RUN + RAMP_MIN) + c.dz * rim);
    const climb = Math.max(RAMP_MIN, (guess - floor_y) / RAMP_GRADE);
    const top: Point = [c.cx + c.ux * (FLOOR_RUN + climb) + c.dx * rim, c.cz + c.uz * (FLOOR_RUN + climb) + c.dz * rim];
    const rim_y = sample(heights, ...top);
    if (rim_y - floor_y > (RAMP_GRADE + 0.05) * climb) return false;
    const link: Point = [c.jump.takeoff.x + c.dx * c.to, c.jump.takeoff.z + c.dz * c.to];
    const corners: Path = [[c.cx, c.cz], [c.cx + c.ux * FLOOR_RUN, c.cz + c.uz * FLOOR_RUN], top, link];
    const path = resample(chaikin(corners, 2), STEP, false);
    const metres = run(path);
    const l0 = FLOOR_RUN;
    const l1 = l0 + dist(corners[1], top);
    for (let i = 0; i < path.length; i++) if (metres[i] > l1 && (!this.free_ground(...path[i]) || sample(road_dist, ...path[i]) < ROAD_CLEAR)) return false;
    const ys = path.map((p, i) => {
      const s = metres[i];
      if (s <= l0) return sample(heights, p[0], p[1]);
      if (s <= l1) return floor_y + ((rim_y - floor_y) * (s - l0)) / (l1 - l0);
      return sample(heights, p[0], p[1]);
    });
    c.ramp_out = road_points(path, ys, false);
    c.cut = metres.findIndex((s) => s > l1);
    return true;
  }
}

// The grid sees 16 m steps; a road embankment or a plateau edge can still put a wall inside one.
function too_steep(line: Path, heights: Float32Array, cross: Crossing | null): boolean {
  const ground = line.map(([x, z]) => sample(heights, x, z));
  const ys = limit_grade(smooth(ground, 5, 2, false), line.slice(1).map((q, i) => dist(q, line[i])), TRAIL_GRADE).map((y, i) => ground[i] + Math.max(-MAX_CUT, Math.min(MAX_CUT, y - ground[i])));
  const on_pad = (q: Point) => cross !== null && Math.abs((q[0] - cross.cx) * cross.dz - (q[1] - cross.cz) * cross.dx) < PAD_HALF + PAD_BLEND && Math.abs((q[0] - cross.cx) * cross.dx + (q[1] - cross.cz) * cross.dz) < cross.to + PAD_BLEND;
  for (let i = 0; i + STEEP_SPAN < line.length; i++) if (!on_pad(line[i]) && Math.abs(ys[i + STEEP_SPAN] - ys[i]) > MAX_STEEP * STEEP_SPAN * STEP) return true;
  return false;
}

// Drops grid corners sharper than TURN_COS2 that are not `fixed`; chaikin would fold a reversal over itself.
function unkink(path: Path, fixed: (i: number) => boolean): Path {
  let out = path;
  let keep = fixed;
  for (let i = 1; i < out.length - 1; ) {
    const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
    const ux = b[0] - a[0];
    const uz = b[1] - a[1];
    const vx = c[0] - b[0];
    const vz = c[1] - b[1];
    const dot = ux * vx + uz * vz;
    if (keep(i) || (dot > 0 && dot * dot >= TURN_COS2 * (ux * ux + uz * uz) * (vx * vx + vz * vz))) {
      i++;
      continue;
    }
    const drop = i;
    out = out.filter((_, k) => k !== drop);
    const was = keep;
    keep = (k) => was(k >= drop ? k + 1 : k);
    i = Math.max(1, i - 1);
  }
  return out;
}

function waypoints(p: Planner, heights: Float32Array, towns: readonly Town[]) {
  const [px, pz] = peak(heights);
  const dirs = circle16();
  const shoulders: Point[] = [];
  const coast: Point[] = [];
  for (const [fx, fz] of dirs) {
    let shoulder: Point | null = null;
    for (let r = 8; r < SIZE / 2; r += 8) {
      const x = px + fx * r;
      const z = pz + fz * r;
      const h = sample(heights, x, z);
      if (!shoulder && h < SHOULDER_TOP && h > SHOULDER_LOW && p.free(x, z)) shoulder = [x, z];
      if (h < COAST_HIGH) {
        if (h > WATER && p.free(x, z)) coast.push([x, z]);
        break;
      }
    }
    if (shoulder) shoulders.push(shoulder);
  }
  const starts: Point[] = [];
  for (const t of towns)
    for (const [fx, fz] of dirs) {
      const x = t.x + fx * (t.radius + TOWN_MARGIN + START_OUT);
      const z = t.z + fz * (t.radius + TOWN_MARGIN + START_OUT);
      if (p.free(x, z) && up(heights, x, z) > LEVEL_UP) starts.push([x, z]);
    }
  return { shoulders, coast, starts: [...starts, ...coast].filter(([x, z]) => up(heights, x, z) > LEVEL_UP) };
}

interface Plan {
  /** The trail line, STEP apart. */
  path: Path;
}

/**
 * Point to point on dirt: from a town edge (or the coast) to the canyon crossing, over the gap, past a summit shoulder
 * and down to the coast. The crossing is planned first and laid as one straight from run-up to run-out; the legs between
 * are A* on the 16 m grid with half a spur's slope penalty, a toll per road crossed and towns blocked.
 */
export function plan_trails(seed: number, land: Terrain, stamp: Stamp, canyon: Canyon | null, towns: readonly Town[], solids: readonly Solid[]): Trails {
  const next = mulberry32(sub(seed, "trails"));
  const p = new Planner(land, towns, solids, canyon);
  const cross = p.crossing();
  const { heights } = land;
  const marks = waypoints(p, heights, towns);
  const straight: Point[] = [];
  if (cross) {
    const { jump, dx, dz } = cross;
    for (let v = cross.from; v <= cross.to + 1e-6; v += GRID) straight.push([jump.takeoff.x + dx * v, jump.takeoff.z + dz * v]);
    // Its ends stay open so the legs can reach them.
    for (const [x, z] of straight.slice(3, -3)) p.block_disc(x, z, PAD_HALF + PAD_BLEND);
    p.fence(straight[0], cross.dx, cross.dz);
    p.fence(straight[straight.length - 1], -cross.dx, -cross.dz);
    for (const q of cross.ramp_out.slice(0, cross.cut)) p.block_disc(q.x, q.z, PAD_HALF);
  }
  const side = (q: Point) => (cross ? (q[0] - cross.cx) * cross.dx + (q[1] - cross.cz) * cross.dz : 0);
  const a = straight[0];
  const b = straight[straight.length - 1];

  const plans: Plan[] = [];
  const used = new Set<string>();
  // The legs to and from the gap see only the base grid, so one that two options share is routed once.
  const cache = new Map<string, Path | null>();
  for (const window of WINDOWS) {
    const options: { start: Point; shoulder: Point | null; finish: Point; guess: number }[] = [];
    for (const start of marks.starts) {
      if (cross && side(start) > -RUNUP) continue;
      for (const finish of marks.coast) {
        if (cross && side(finish) < RUNOUT) continue;
        for (const shoulder of [null, ...marks.shoulders]) {
          if (shoulder && cross && side(shoulder) < RUNOUT) continue;
          const stops = [start, ...(cross ? [a, b] : []), ...(shoulder ? [shoulder] : []), finish];
          let guess = 0;
          for (let i = 1; i < stops.length; i++) guess += dist(stops[i - 1], stops[i]);
          guess *= 1.2;
          if (guess >= window.min && guess <= window.max) options.push({ start, shoulder, finish, guess });
        }
      }
    }
    options.sort((u, v) => Math.abs(u.guess - window.aim) - Math.abs(v.guess - window.aim) || u.guess - v.guess);
    const skip = Math.floor(next() * Math.min(3, options.length));
    for (const option of [...options.slice(skip), ...options.slice(0, skip)].slice(0, OPTIONS)) {
      const id = `${option.start}|${option.finish}`;
      if (used.has(id)) continue;
      const blocked = Uint8Array.from(p.blocked);
      const legs: [Point, Point][] = cross ? [[option.start, a], [b, option.shoulder ?? option.finish]] : [[option.start, option.shoulder ?? option.finish]];
      if (option.shoulder) legs.push([option.shoulder, option.finish]);
      const found: Path[] = [];
      for (const [from, to] of legs) {
        const fresh = found.length === 0 || (cross !== null && found.length === 1);
        const memo = `${from}>${to}`;
        const leg = fresh && cache.has(memo) ? (cache.get(memo) ?? null) : p.route(from, to, fresh ? p.blocked : blocked);
        if (fresh) cache.set(memo, leg);
        if (!leg) break;
        found.push(leg);
        for (const [x, z] of leg) p.block_disc(x, z, GRID, blocked);
      }
      if (found.length < legs.length) continue;
      if (cross) {
        const into = found[0][found[0].length - 2];
        const out = found[1][1];
        const cos_in = ((a[0] - into[0]) * cross.dx + (a[1] - into[1]) * cross.dz) / (dist(a, into) || 1);
        const cos_out = ((out[0] - b[0]) * cross.dx + (out[1] - b[1]) * cross.dz) / (dist(out, b) || 1);
        if (cos_in < JOIN_COS || cos_out < JOIN_COS) continue;
      }
      const tail = found.slice(cross ? 1 : 0).flatMap((leg, i) => (i === 0 && !cross ? leg : leg.slice(1)));
      const path: Path = cross ? [...found[0].slice(0, -1), ...straight, ...tail] : tail;
      const first = cross ? found[0].length - 1 : -1;
      const line = resample(chaikin(unkink(path, (i) => first >= 0 && i >= first && i <= first + straight.length - 1), 3), STEP, false);
      const metres = run(line);
      if (metres[metres.length - 1] < window.min || metres[metres.length - 1] > window.max) continue;
      if (too_steep(line, heights, cross)) continue;
      plans.push({ path: line });
      used.add(id);
      break;
    }
  }
  if (!plans.length) return { trails: [], gap: null, ramp_out: [] };

  if (cross) pad(land, cross);
  const done = plans.map((plan, n) => finish(plan, cross, heights, WINDOWS[n].id));
  const trails = done.map((d) => d.trail);
  const lines: TrailLine[] = done.map((d) => d.line);
  if (cross) lines.push({ points: cross.ramp_out, blend: (i) => (i < cross.cut ? 1 : 0) });
  stamp.trail(lines);
  return { trails, gap: cross?.jump ?? null, ramp_out: cross?.ramp_out ?? [] };
}

// Where the pad sets the ground the trail leaves it alone, and it takes over again as the pad eases out.
function finish(plan: Plan, cross: Crossing | null, heights: Float32Array, id: string): { trail: Trail; line: TrailLine } {
  const { path } = plan;
  const ground = path.map(([x, z]) => sample(heights, x, z));
  const steps = path.slice(1).map((q, i) => dist(q, path[i]));
  // Steeper than TRAIL_GRADE the trail is cut and filled toward its graded line; elsewhere it keeps half the bumps.
  const graded = (ys: number[]) => limit_grade(ys, steps, TRAIL_GRADE).map((y, i) => ground[i] + Math.max(-MAX_CUT, Math.min(MAX_CUT, y - ground[i])));
  const share = (ys: number[], i: number) => Math.min(CUT_BLEND, TRAIL_BLEND + CUT_PER_M * Math.abs(ground[i] - ys[i]));
  let ys = graded(smooth(ground, 5, 2, false));
  if (!cross) {
    const points = road_points(path, ys, false);
    const blend = ys.map((_, i) => share(ys, i));
    return { trail: { id, points, toe: -1, rejoin: -1 }, line: { points, blend: (i) => blend[i] } };
  }
  const { takeoff } = cross.jump;
  const v_of = (q: Point) => (q[0] - takeoff.x) * cross.dx + (q[1] - takeoff.z) * cross.dz;
  const on_line = (q: Point) => Math.abs((q[0] - takeoff.x) * cross.dz - (q[1] - takeoff.z) * cross.dx) < 1 && v_of(q) >= cross.from && v_of(q) <= cross.to;
  const hard = (i: number) => on_line(path[i]) && v_of(path[i]) >= -HARD && v_of(path[i]) <= cross.deck_end;
  const fix = (from: number[]) => from.map((y, i) => (hard(i) ? (profile(cross, v_of(path[i])) ?? cross.y) + sink(cross, v_of(path[i])) : y));
  ys = fix(graded(fix(ys)));
  const blend = path.map((q, i) => share(ys, i) * (on_line(q) ? 1 - pad_share(cross, v_of(q)) : 1));
  const toe = path.findIndex((q) => on_line(q) && v_of(q) >= 0);
  const rejoin = path.findIndex((q, i) => i > toe && on_line(q) && v_of(q) >= cross.to - GRID);
  const points = road_points(path, ys, false);
  return { trail: { id, points, toe, rejoin }, line: { points, blend: (i) => blend[i] } };
}

function pad_share(c: Crossing, v: number): number {
  return smoothstep(c.from, -HARD, v) * (1 - smoothstep(c.deck_end, c.to, v));
}

/** Sets the ground to the jump profile under the run-up, kicker, deck and run-out, easing back to terrain at the edges. */
function pad(land: Terrain, c: Crossing) {
  const { heights, road_dist } = land;
  const { takeoff } = c.jump;
  const reach = PAD_HALF + PAD_BLEND;
  const ends: Point[] = [
    [takeoff.x + c.dx * c.from, takeoff.z + c.dz * c.from],
    [takeoff.x + c.dx * c.to, takeoff.z + c.dz * c.to],
  ];
  const [i0, i1] = cell_range(Math.min(ends[0][0], ends[1][0]) - reach, Math.max(ends[0][0], ends[1][0]) + reach);
  const [j0, j1] = cell_range(Math.min(ends[0][1], ends[1][1]) - reach, Math.max(ends[0][1], ends[1][1]) + reach);
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const x = ORIGIN + i * CELL;
      const z = ORIGIN + j * CELL;
      const v = (x - takeoff.x) * c.dx + (z - takeoff.z) * c.dz;
      const u = Math.abs((x - takeoff.x) * c.dz - (z - takeoff.z) * c.dx);
      if (u >= reach || v <= c.from || v >= c.to) continue;
      const want = profile(c, v);
      if (want === null) continue;
      const k = vertex(i, j);
      const w = (1 - smoothstep(PAD_HALF, reach, u)) * pad_share(c, v) * smoothstep(ROAD_HALF + 6, ROAD_HALF + 16, road_dist[k]);
      heights[k] += (want - heights[k]) * w;
    }
}

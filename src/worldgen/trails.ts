import { mulberry32, sub } from "../rng";
import { peak } from "./canyon";
import { at, cell_range, sample, span_i, span_j, up, vertex, WHOLE, type Grid } from "./field";
import { DECK_GRADE, gap_jump, type GapJump } from "./gap";
import { circle16, length, smoothstep } from "./noise";
import { chaikin, limit_grade, resample, road_points, smooth, type Path } from "./path";
import { Heap } from "./heap";
import type { Stamp, TrailLine } from "./stamp";
import { CELL, N, ORIGIN, ROAD_HALF, SHOULDER, SIZE, type Canyon, type RoadPoint, type Solid, type Terrain, type Town } from "./types";

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
/** Centres of two crossings tried in turn lie this far apart: a near one meets the same blocked legs. */
const CROSS_APART = 80;
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
/** A hatch on dirt stalls from rest past about 0.32: every stretch steeper than CLIMB is cut and filled down to it. */
const CLIMB = 0.24;
/** Deepest such a cut or fill gets; the ground beside it is shaped to banks, so it is no trench. */
const DEEP_CUT = 6;
/**
 * The banks of a deep run are shaped off copies of its line this far to each side, so its bed runs level out past the
 * trail's own edge: a car drifting wide on the climb stays on it instead of dropping a wheel off a dyke.
 */
const BED = 3;
/** Banks of a deep run meet the hillside within this of its line; the switchback's own reach would shape 280 m around it. */
const BANK_REACH = 40;
/** A point the CLIMB grading moved further than this is stamped in full. */
const CUT_MOVED = 0.05;
/** A trail still climbing faster than CLIMB_MAX over CLIMB_SPAN points after that is dropped for the next option. */
const CLIMB_MAX = 0.26;
const CLIMB_SPAN = 20;
/** Nor may it pitch up faster than PITCH_MAX over PITCH_SPAN points: a ridge deeper than DEEP_CUT to cut through. */
const PITCH_MAX = 0.4;
const PITCH_SPAN = 4;
/** Points this close to an earlier trail take its height and blend: two lines graded apart would stamp a washboard. */
const SHARED = 2;

const SHOULDER_TOP = 110;
const SHOULDER_LOW = 70;
const COAST_HIGH = 8;
const START_OUT = 24;
/** Starts sit on ground at most this steep (the unit normal's y): a standing start on a hillside slides back. */
const LEVEL_UP = 0.97;
const OPTIONS = 32;
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

export interface Crossing {
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
    readonly land: Terrain,
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

  /** Crossings over straight canyon stretches with level rims, clear of roads and towns, least ground to move first. */
  crossings(): Crossing[] {
    const canyon = this.canyon;
    if (!canyon) return [];
    const { points } = canyon;
    const { heights, road_dist } = this.land;
    const rim = canyon.floor + canyon.wall;
    const shape = gap_jump(0, 0, 0, 0, 0, 1);
    const slot0 = shape.takeoff.length;
    const slot1 = slot0 + shape.gap;
    const deck_end = slot1 + shape.deck.length;
    const found: { cross: Crossing; fill: number }[] = [];
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
        if (!ok) continue;
        if (!this.ramp_out(cross, rim + RIM_OUT)) continue;
        found.push({ cross, fill });
      }
    }
    return found.sort((a, b) => a.fill - b.fill).map((f) => f.cross);
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
function too_steep(line: Path, land: Terrain, cross: Crossing | null): boolean {
  const ground = line.map(([x, z]) => sample(land.heights, x, z));
  const steps = line.slice(1).map((q, i) => dist(q, line[i]));
  const ys = limit_grade(smooth(ground, 5, 2, false), steps, TRAIL_GRADE).map((y, i) => ground[i] + Math.max(-MAX_CUT, Math.min(MAX_CUT, y - ground[i])));
  const on_pad = (q: Point) => cross !== null && Math.abs((q[0] - cross.cx) * cross.dz - (q[1] - cross.cz) * cross.dx) < PAD_HALF + PAD_BLEND && Math.abs((q[0] - cross.cx) * cross.dx + (q[1] - cross.cz) * cross.dz) < cross.to + PAD_BLEND;
  for (let i = 0; i + STEEP_SPAN < line.length; i++) if (!on_pad(line[i]) && Math.abs(ys[i + STEEP_SPAN] - ys[i]) > MAX_STEEP * STEEP_SPAN * STEP) return true;
  const cut = climb(ys, ground, steps, () => false, (i) => by_road(land, line[i]));
  const rises = (span: number, most: number) => {
    for (let i = 0; i + span < line.length; i++) if (!on_pad(line[i]) && !on_pad(line[i + span]) && cut[i + span] - cut[i] > most * span * STEP) return true;
    return false;
  };
  return rises(CLIMB_SPAN, CLIMB_MAX) || rises(PITCH_SPAN, PITCH_MAX);
}

// The trail stamp leaves the ground by a road to the road's blend, so grading there starts from that ground.
function by_road(land: Terrain, q: Point): boolean {
  return sample(land.road_dist, q[0], q[1]) < ROAD_HALF + SHOULDER;
}

/** Grades each run between `pinned` points to CLIMB, cutting or filling at most DEEP_CUT; points `near_road` keep their height. */
function climb(ys: number[], ground: number[], steps: number[], pinned: (i: number) => boolean, near_road: (i: number) => boolean): number[] {
  const out = ys.slice();
  for (let a = 0; a < ys.length; a++) {
    if (pinned(a)) continue;
    let b = a;
    while (b + 1 < ys.length && !pinned(b + 1)) b++;
    const from = Math.max(0, a - 1);
    const to = Math.min(ys.length - 1, b + 1);
    const want = limit_grade(ys.slice(from, to + 1).map((y, k) => (near_road(from + k) ? ground[from + k] : y)), steps.slice(from, to), CLIMB);
    for (let i = a; i <= b; i++) if (!near_road(i)) out[i] = ground[i] + Math.max(-DEEP_CUT, Math.min(DEEP_CUT, want[i - from] - ground[i]));
    a = b;
  }
  return out;
}

// A leg too steep on its own sinks every option through it, so the legs after it are never routed.
function steep_leg(leg: Path | null, land: Terrain, cross: Crossing | null): Path | null {
  return leg && !too_steep(resample(chaikin(leg, 3), STEP, false), land, cross) ? leg : null;
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
export function plan_trails(seed: number, land: Terrain, stamp: Stamp, canyon: Canyon | null, towns: readonly Town[], solids: readonly Solid[], tries = 1): Trails {
  const p = new Planner(land, towns, solids, canyon);
  const { heights } = land;
  const marks = waypoints(p, heights, towns);
  const base = Uint8Array.from(p.blocked);
  const crossings = p.crossings();
  const picked: Crossing[] = [];
  for (const c of crossings) if (picked.length < tries && picked.every((q) => length(q.cx - c.cx, q.cz - c.cz) > CROSS_APART)) picked.push(c);
  let cross: Crossing | null = null;
  let plans: Plan[] = [];
  // A crossing no trail can reach gives way to the next best one apart from it.
  for (const c of picked.length ? picked : [null]) {
    p.blocked.set(base);
    cross = c;
    plans = route_trails(seed, p, marks, heights, c);
    if (plans.length) break;
  }
  if (!plans.length) return { trails: [], gap: null, ramp_out: [] };

  if (cross) stamp.pad(cross);
  const done: Finished[] = [];
  for (const [n, plan] of plans.entries()) done.push(finish(plan, cross, land, WINDOWS[n].id, done));
  for (const runs of done.map((d) => merged(d.deep))) for (const run of runs) stamp.face([-BED, 0, BED].flatMap((o) => run.map((q) => ({ ...q, x: q.x - q.tz * o, z: q.z + q.tx * o }))), BANK_REACH);
  // A bank shaped for one trail can reach another running beside it: that one then sets its own line in full. A point at
  // blend 0 is the pad's, the slot over the canyon among them.
  for (const { trail, blend } of done) for (const [i, q] of trail.points.entries()) if (blend[i] > 0 && Math.abs(sample(land.heights, q.x, q.z) - q.y) > MAX_CUT) blend[i] = 1;
  const trails = done.map((d) => d.trail);
  const lines: TrailLine[] = done.map((d) => ({ points: d.trail.points, blend: (i) => d.blend[i] }));
  if (cross) lines.push({ points: cross.ramp_out, blend: (i) => (i < cross.cut ? 1 : 0) });
  stamp.trail(lines);
  return { trails, gap: cross?.jump ?? null, ramp_out: cross?.ramp_out ?? [] };
}

function route_trails(seed: number, p: Planner, marks: ReturnType<typeof waypoints>, heights: Float32Array, cross: Crossing | null): Plan[] {
  const next = mulberry32(sub(seed, "trails"));
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
  const steep = new Set<string>();
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
      let chain = "";
      for (const [from, to] of legs) {
        const fresh = found.length === 0 || (cross !== null && found.length === 1);
        // A later leg routes around the ones before it, so it is keyed by them too.
        chain = fresh ? `${chain}|${from}>${to}` : `${chain}|${from}>${to}+`;
        const memo = fresh ? `${from}>${to}` : chain;
        const leg = cache.has(memo) ? (cache.get(memo) ?? null) : steep_leg(p.route(from, to, fresh ? p.blocked : blocked), p.land, cross);
        cache.set(memo, leg);
        if (!leg) break;
        found.push(leg);
        for (const [x, z] of leg) p.block_disc(x, z, GRID, blocked);
      }
      if (found.length < legs.length || steep.has(chain)) continue;
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
      if (too_steep(line, p.land, cross)) {
        steep.add(chain);
        continue;
      }
      plans.push({ path: line });
      used.add(id);
      break;
    }
  }
  return plans;
}

interface Finished {
  trail: Trail;
  /** Share of the way the stamp moves the ground to the line, per point. */
  blend: number[];
  /** Runs cut or filled deeper than MAX_CUT, whose ground is shaped to banks. */
  deep: RoadPoint[][];
}

interface Shared {
  x: number;
  z: number;
  y: number;
  blend: number;
}

// Where the pad sets the ground the trail leaves it alone, and it takes over again as the pad eases out.
function finish(plan: Plan, cross: Crossing | null, land: Terrain, id: string, earlier: readonly Finished[]): Finished {
  const { path } = plan;
  const ground = path.map(([x, z]) => sample(land.heights, x, z));
  const steps = path.slice(1).map((q, i) => dist(q, path[i]));
  // Steeper than TRAIL_GRADE the trail is cut and filled toward its graded line; elsewhere it keeps half the bumps.
  const graded = (ys: number[]) => limit_grade(ys, steps, TRAIL_GRADE).map((y, i) => ground[i] + Math.max(-MAX_CUT, Math.min(MAX_CUT, y - ground[i])));
  const share = (ys: number[], i: number) => Math.min(CUT_BLEND, TRAIL_BLEND + CUT_PER_M * Math.abs(ground[i] - ys[i]));
  const near = buckets(earlier);
  const shared = path.map((q) => nearest(near, q));
  let ys = graded(smooth(ground, 5, 2, false));
  let toe = -1;
  let rejoin = -1;
  let hard = (_: number) => false;
  let eased = (_: number) => 1;
  if (cross) {
    const c = cross;
    const { takeoff } = c.jump;
    const v_of = (q: Point) => (q[0] - takeoff.x) * c.dx + (q[1] - takeoff.z) * c.dz;
    const on_line = (q: Point) => Math.abs((q[0] - takeoff.x) * c.dz - (q[1] - takeoff.z) * c.dx) < 1 && v_of(q) >= c.from && v_of(q) <= c.to;
    hard = (i) => on_line(path[i]) && v_of(path[i]) >= -HARD && v_of(path[i]) <= c.deck_end;
    eased = (i) => (on_line(path[i]) ? 1 - pad_share(c, v_of(path[i])) : 1);
    const fix = (from: number[]) => from.map((y, i) => (hard(i) ? (profile(c, v_of(path[i])) ?? c.y) + sink(c, v_of(path[i])) : y));
    ys = fix(graded(fix(ys)));
    toe = path.findIndex((q) => on_line(q) && v_of(q) >= 0);
    rejoin = path.findIndex((q, i) => i > toe && on_line(q) && v_of(q) >= c.to - GRID);
  }
  const flat = ys.map((y, i) => shared[i]?.y ?? y);
  ys = climb(flat, ground, steps, (i) => hard(i) || shared[i] !== null, (i) => by_road(land, path[i]));
  const blend = ys.map((y, i) => shared[i]?.blend ?? (Math.abs(y - flat[i]) > CUT_MOVED ? 1 : share(ys, i) * eased(i)));
  const points = road_points(path, ys, false);
  const deep: RoadPoint[][] = [];
  let from = -1;
  for (let i = 0; i <= points.length; i++) {
    const cut = i < points.length && !shared[i] && !hard(i) && Math.abs(ys[i] - ground[i]) > MAX_CUT;
    if (cut && from < 0) from = i;
    if (!cut && from >= 0) {
      deep.push(points.slice(from, i));
      from = -1;
    }
  }
  return { trail: { id, points, toe, rejoin }, blend, deep };
}

// Runs whose banks would overlap shape the ground in one pass.
function merged(runs: readonly RoadPoint[][]): RoadPoint[][] {
  const out: RoadPoint[][] = [];
  for (const run of runs) {
    const last = out[out.length - 1]?.at(-1);
    if (last && length(run[0].x - last.x, run[0].z - last.z) < 2 * BANK_REACH) out[out.length - 1] = [...out[out.length - 1], ...run];
    else out.push(run);
  }
  return out;
}

const bucket = (x: number, z: number) => `${Math.floor(x / SHARED)},${Math.floor(z / SHARED)}`;

function buckets(earlier: readonly Finished[]): Map<string, Shared[]> {
  const out = new Map<string, Shared[]>();
  for (const { trail, blend } of earlier)
    for (const [k, p] of trail.points.entries()) {
      const key = bucket(p.x, p.z);
      const list = out.get(key) ?? [];
      list.push({ x: p.x, z: p.z, y: p.y, blend: blend[k] });
      out.set(key, list);
    }
  return out;
}

function nearest(near: Map<string, Shared[]>, q: Point): Shared | null {
  let best = SHARED * SHARED;
  let out: Shared | null = null;
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++)
      for (const p of near.get(bucket(q[0] + dx * SHARED, q[1] + dz * SHARED)) ?? []) {
        const d = (p.x - q[0]) ** 2 + (p.z - q[1]) ** 2;
        if (d >= best) continue;
        best = d;
        out = p;
      }
  return out;
}

function pad_share(c: Crossing, v: number): number {
  return smoothstep(c.from, -HARD, v) * (1 - smoothstep(c.deck_end, c.to, v));
}

/** Sets the ground to the jump profile under the run-up, kicker, deck and run-out, easing back to terrain at the edges. */
export function pad(land: Terrain, c: Crossing, grid: Grid = WHOLE) {
  const { heights, road_dist } = land;
  const { takeoff } = c.jump;
  const reach = PAD_HALF + PAD_BLEND;
  const ends: Point[] = [
    [takeoff.x + c.dx * c.from, takeoff.z + c.dz * c.from],
    [takeoff.x + c.dx * c.to, takeoff.z + c.dz * c.to],
  ];
  const [i0, i1] = span_i(grid, Math.min(ends[0][0], ends[1][0]) - reach, Math.max(ends[0][0], ends[1][0]) + reach);
  const [j0, j1] = span_j(grid, Math.min(ends[0][1], ends[1][1]) - reach, Math.max(ends[0][1], ends[1][1]) + reach);
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      const x = ORIGIN + i * CELL;
      const z = ORIGIN + j * CELL;
      const v = (x - takeoff.x) * c.dx + (z - takeoff.z) * c.dz;
      const u = Math.abs((x - takeoff.x) * c.dz - (z - takeoff.z) * c.dx);
      if (u >= reach || v <= c.from || v >= c.to) continue;
      const want = profile(c, v);
      if (want === null) continue;
      const k = at(grid, i, j);
      const w = (1 - smoothstep(PAD_HALF, reach, u)) * pad_share(c, v) * smoothstep(ROAD_HALF + 6, ROAD_HALF + 16, road_dist[k]);
      heights[k] += (want - heights[k]) * w;
    }
}

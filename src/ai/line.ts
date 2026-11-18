import { GRAVITY } from "../car/rigid-body";
import { ROAD_HALF, type Ramp, type RoadPoint } from "../worldgen/types";
import { hazards, type LineGround } from "./hazards";
import { AI_TUNING } from "./tuning";
import { trim_of, UNIT_SCALE, type Capability, type PlanScale } from "./capability";
import { corner_plans, grip_at_speed, trimmed_hold } from "./corners";
import { CORNER_MODEL } from "./corner-model";
import { hypot } from "../sim-math";

/** Grip (m/s²) the line plans a bend of signed curvature `bend` (1/m) on, for a car of `scale` over the coupe. */
export function grip_at(bend: number, scale: PlanScale = UNIT_SCALE): number {
  const radius = 1 / Math.max(1e-9, Math.abs(bend));
  const { hairpin_radius, fast_radius } = AI_TUNING;
  const line_grip = AI_TUNING.line_grip * scale.slow;
  const fast_grip = AI_TUNING.fast_grip * scale.fast;
  return line_grip + (fast_grip - line_grip) * Math.max(0, Math.min(1, (radius - hairpin_radius) / (fast_radius - hairpin_radius)));
}

/**
 * Metres between the car's body and the road edge: the driver holds the line to about half a metre through a bend. At
 * 0.6 a car braked behind another in a fast bend had no road left to catch its slide in and met a post (seeds 14, 17, 34).
 */
const EDGE_GAP = 0.9;
/** Coarsest point spacing the relax starts at, and passes at spacing 1 (more at coarser ones, by the square root). */
const RELAX_TOP = 64;
const RELAX_PASSES = 100;
/** Metres a point is nudged to measure how its curvature moves with its offset. */
const NUDGE = 1e-3;
/** Share of the solved move a point takes per pass: the full move overshoots, as each point also bends its neighbours. */
const RELAX_GAIN = 0.3;
export const CURVE_SPAN = 5;
/** Road points either side a crest's vertical curvature is read over. */
const CREST_SPAN = 10;
/** Fastest pace over a circuit kicker, and how far before its toe (m) the line slows for it: as the autopilot takes them. */
const JUMP_PACE = 32;
const RAMP_LOOK = 120;
/** Metres either side of a kicker's run the line keeps to the centre, lined up with the ramp. */
const RAMP_PIN = 20;
/** Least share of its braking or pull the profile gives a car at the limit of a bend: at none, a bend's apex could never be braked into. */
const GRIP_FLOOR = 0.25;
/** Most of the car's weight (share of g) a crest may take off it at the planned speed: past 1 it leaves the road. */
const CREST_HOLD = 0.8;

/**
 * A closed racing line over a circuit, built once at the start: per road point a signed lateral offset (along the
 * point's right normal, (tz, -tx)), the world position it gives, and the planned speed there.
 */
export interface RaceLine {
  readonly road: readonly RoadPoint[];
  readonly offset: Float64Array;
  readonly x: Float64Array;
  readonly z: Float64Array;
  /** m/s: the speed profile along the line: corner speeds from radius and grip, braked for at `AI_TUNING.line_brake` by a backward pass, held to what the car pulls (`drive_at`) by a forward one, all times `scale`. */
  readonly speed: Float64Array;
  /** m/s: the same profile braked for at `AI_TUNING.late_brake`, the plan of a late braker diving down the inside. */
  readonly late: Float64Array;
  /** The car the speeds are planned for, over the stock coupe (`plan_scale`). */
  readonly scale: PlanScale;
  /** Vertical curvature (1/m) over a crest, and 1 where the road kicks (a kicker or a step across it): what any car's plan slows for. */
  readonly lift: Float64Array;
  readonly kick: Uint8Array;
  /** Signed 1/radius (1/m) of the line at each point; positive bends away from the right normal. */
  readonly bend: Float64Array;
  readonly ramp: Int16Array;
  /** Metres between point i and i + 1. */
  readonly step: Float64Array;
  /** How far the line may stray off the centre at each point (m). */
  readonly room: Float64Array;
  /** Metres off the centre (along the right normal) a car's centre keeps between to stay off the steps and solids on the road: the line, a pass or a defence. */
  readonly lo: Float64Array;
  readonly hi: Float64Array;
}

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Signed 1/radius of the circle through a, b, c. */
export function inverse_radius(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  const cross = (bx - ax) * (cz - bz) - (bz - az) * (cx - bx);
  // One square root, not three Math.hypot: the relax runs this about a million times a line.
  const d = Math.sqrt(((bx - ax) ** 2 + (bz - az) ** 2) * ((cx - bx) ** 2 + (cz - bz) ** 2) * ((cx - ax) ** 2 + (cz - az) ** 2));
  return d < 1e-12 ? 0 : (2 * cross) / d;
}

function ramp_index(road: readonly RoadPoint[], ramp: Ramp): number {
  let at = 0;
  for (let i = 1; i < road.length; i++) if ((road[i].x - ramp.x) ** 2 + (road[i].z - ramp.z) ** 2 < (road[at].x - ramp.x) ** 2 + (road[at].z - ramp.z) ** 2) at = i;
  return hypot(road[at].x - ramp.x, road[at].z - ramp.z) < ROAD_HALF ? at : -1;
}

/** Most acceleration (m/s²) the line plans at `speed` m/s: traction up to `line_drive`, then the engine's power over speed. */
export function drive_at(speed: number, scale: PlanScale = UNIT_SCALE): number {
  return Math.min(AI_TUNING.line_drive * scale.drive, (AI_TUNING.line_power * scale.power) / Math.max(1, speed));
}

/** Share of the tyres' grip left along the road at `speed` m/s through bend `bend` (1/m), the car at `load` of its weight: the friction circle, never under GRIP_FLOOR. */
function along(speed: number, bend: number, scale: PlanScale, load: number): number {
  const used = (speed * speed * Math.abs(bend)) / (grip_at(bend, scale) * load);
  return Math.max(GRIP_FLOOR, Math.sqrt(Math.max(0, 1 - used * used)));
}

/**
 * Backward over corner speeds `speed`, in place, so every bend ahead can be braked for at `brake[i]` m/s² less what the
 * bend's turning takes of the grip. Two laps, as a curve from the slowest bend wraps past the start line. Over a crest
 * (`lift`) the car is light, and the braking and the circle shrink with its load: braked at the flat's 5 m/s² through a
 * 250 m bend over a crest at 36 m/s, the hatch's tail came round (seeds 4, 15).
 */
function brake_pass(speed: Float64Array, step: Float64Array, bend: Float64Array, lift: Float64Array, brake: Float64Array, scale: PlanScale) {
  const n = speed.length;
  for (let k = 2 * n - 1; k >= 0; k--) {
    const i = wrap(k, n);
    const v = speed[wrap(k + 1, n)];
    const load = 1 - Math.min(AI_TUNING.crest_light, (v * v * lift[i]) / GRAVITY);
    speed[i] = Math.min(speed[i], Math.sqrt(v * v + 2 * brake[i] * load * along(v, bend[i], scale, load) * step[i]));
  }
}

/**
 * Forward, in place, so no exit plans more than `drive_at` gives, less `bend_share` times the square of the share of
 * the grip the bend takes. The plan takes none: the corner model's fitted `pull_bend` there cost 0.2-0.5% a lap, the
 * driver lifting to a plan under what it pulls (the full friction circle cost a second). Brake points read it.
 */
function pull_pass(speed: Float64Array, step: Float64Array, bend: Float64Array, scale: PlanScale, car: Capability, bend_share: number) {
  const n = speed.length;
  for (let k = 0; k < 2 * n; k++) {
    const i = wrap(k, n);
    const v = speed[i];
    const next = wrap(k + 1, n);
    const used = (v * v * Math.abs(bend[i])) / grip_at_speed(v, car);
    const share = Math.max(GRIP_FLOOR, 1 - bend_share * used * used);
    speed[next] = Math.min(speed[next], Math.sqrt(v * v + 2 * drive_at(v, scale) * share * step[i]));
  }
}

/** m/s a bend held at `hold` m/s on the flat holds over a crest of `lift` and on a kick: the line's corner speed. */
function corner_speed(hold: number, lift: number, kick: number): number {
  // Over a crest the car goes light by v² times the road's vertical curvature, and its grip with it: v² = G R / (1 + G R k / g).
  // A 9% climb into a 9% drop in a 200 m bend at 38 m/s took a third of the load, and the field spun there.
  const v2 = hold * hold;
  // Under the take-off speed too: braked hard and late, a car met a crest in a 840 m bend at 52 m/s, flew 0.7 s wide
  // and landed on a lamp post (seed 30).
  const takeoff = lift > 0 ? Math.sqrt((CREST_HOLD * GRAVITY) / lift) : Infinity;
  // A step across the whole road is taken as a kicker is: at a pace that does not launch the car into what follows.
  const cap = kick ? JUMP_PACE : Infinity;
  return Math.min(Math.sqrt(v2 / (1 + Math.min(AI_TUNING.crest_light, (v2 * lift) / GRAVITY))), takeoff, cap);
}

/**
 * Corner speeds and braking from the corner model (`corners.ts`), in place: each corner's apex and exit speed scale the
 * line's own corner speeds through it, under `hold` (the car's measured grip), and its braking zone plans the m/s² that
 * puts the brake point where the model has it, between the line's braking and the model's hardest. All times the
 * `model_pace` and `model_brake` margins; either at 0 leaves its part to the line alone.
 */
function model_corners(speed: Float64Array, hold: Float64Array, brake: Float64Array, line: RaceLine, scale: PlanScale, car: Capability) {
  const { step, bend } = line;
  const n = speed.length;
  const plans = corner_plans(line, car, CORNER_MODEL);
  const base = speed.slice();
  if (AI_TUNING.model_pace > 0)
    for (const c of plans) {
      let low = Infinity;
      for (let i = c.from; ; i = wrap(i + 1, n)) {
        low = Math.min(low, base[i]);
        if (i === c.to) break;
      }
      const at_apex = Math.max(1, (Math.min(c.speed, hold[c.apex]) * AI_TUNING.model_pace) / low);
      const at_exit = Math.max(1, (Math.min(c.exit, hold[c.to]) * AI_TUNING.model_pace) / base[c.to]);
      const rise = Math.max(1, wrap(c.to - c.apex, n));
      for (let i = c.from, k = -wrap(c.apex - c.from, n); ; i = wrap(i + 1, n), k++) {
        const f = k <= 0 ? at_apex : at_apex + ((at_exit - at_apex) * k) / rise;
        speed[i] = Math.max(base[i], Math.min(base[i] * f, hold[i]));
        if (i === c.to) break;
      }
    }
  if (AI_TUNING.model_brake <= 0) return;
  const pulled = speed.slice();
  pull_pass(pulled, step, bend, scale, car, CORNER_MODEL.pull_bend);
  const floor = AI_TUNING.line_brake * scale.brake;
  const trim = trim_of(scale).brake;
  plans.forEach((c, k) => {
    const top = Math.max(floor, c.peak * trim * AI_TUNING.model_brake);
    const v = speed[c.apex];
    let at = c.apex;
    let run = 0;
    while (run < c.brake_m) {
      at = wrap(at - 1, n);
      run += step[at];
    }
    const want = run > 0 ? (pulled[at] ** 2 - v * v) / (2 * run) : top;
    const decel = Math.max(floor, Math.min(top, want * AI_TUNING.model_brake));
    const start = plans[wrap(k - 1, plans.length)].to;
    for (let i = c.apex; i !== start; i = wrap(i - 1, n)) brake[i] = decel;
  });
}

/** Vertical curvature (1/m) of the road at point i, positive over a crest, 0 in a dip. */
function crest(road: readonly RoadPoint[], step: Float64Array, i: number): number {
  const n = road.length;
  let before = 0;
  let after = 0;
  for (let k = 1; k <= CREST_SPAN; k++) {
    before += step[wrap(i - k, n)];
    after += step[wrap(i + k - 1, n)];
  }
  if (before < 1e-9 || after < 1e-9) return 0;
  const up = (road[i].y - road[wrap(i - CREST_SPAN, n)].y) / before;
  const down = (road[wrap(i + CREST_SPAN, n)].y - road[i].y) / after;
  return Math.max(0, (up - down) / ((before + after) / 2));
}

/**
 * Moves each point of `offset` sideways, inside `left`..`right`, until its curvature is the distance-weighted mean of
 * its neighbours', coarse spacing first; between passes the points in between follow by linear interpolation. Writes
 * the line's positions into `x`, `z`.
 */
function relax(road: readonly RoadPoint[], offset: Float64Array, x: Float64Array, z: Float64Array, left: Float64Array, right: Float64Array) {
  const n = road.length;
  const place = () => {
    for (let i = 0; i < n; i++) {
      x[i] = road[i].x + road[i].tz * offset[i];
      z[i] = road[i].z - road[i].tx * offset[i];
    }
  };
  place();
  const curvature = (a: number, mid: number, b: number) => inverse_radius(x[a], z[a], x[mid], z[mid], x[b], z[b]);
  for (let span = RELAX_TOP; span >= 1; span >>= 1) {
    for (let pass = Math.round(RELAX_PASSES * Math.sqrt(span)); pass > 0; pass--) {
      for (let i = 0; i < n; i += span) {
        const prev = wrap(i - span, n);
        const next = wrap(i + span, n);
        const want_prev = curvature(wrap(i - 2 * span, n), prev, i);
        const want_next = curvature(i, next, wrap(i + 2 * span, n));
        const l_prev = Math.sqrt((x[i] - x[prev]) ** 2 + (z[i] - z[prev]) ** 2);
        const l_next = Math.sqrt((x[i] - x[next]) ** 2 + (z[i] - z[next]) ** 2);
        const want = (l_next * want_prev + l_prev * want_next) / (l_prev + l_next);
        const p = road[i];
        const k0 = curvature(prev, i, next);
        const k1 = inverse_radius(x[prev], z[prev], x[i] + p.tz * NUDGE, z[i] - p.tx * NUDGE, x[next], z[next]);
        const slope = (k1 - k0) / NUDGE;
        if (Math.abs(slope) < 1e-12) continue;
        offset[i] = Math.max(left[i], Math.min(right[i], offset[i] + (RELAX_GAIN * (want - k0)) / slope));
        x[i] = p.x + p.tz * offset[i];
        z[i] = p.z - p.tx * offset[i];
      }
    }
    if (span > 1)
      for (let i = 0; i < n; i += span) {
        const next = Math.min(n, i + span);
        const to = offset[next % n];
        for (let k = i + 1; k < next; k++) offset[k] = Math.max(left[k], Math.min(right[k], offset[i] + ((to - offset[i]) * (k - i)) / (next - i)));
      }
    place();
  }
}

/**
 * Relaxes the centreline toward the least-curvature path inside the road, then plans speed on the result. Each pass
 * moves a point toward where its neighbours' second difference would vanish, clamped to the road less the car's half
 * width (`half_width`, m) and kept off what `ground` shows on the road. The plain midpoint (shortest path) is slower:
 * it bunches a bend's turn at the apex.
 */
export function race_line(road: readonly RoadPoint[], ramps: readonly Ramp[], half_width: number, ground?: LineGround, scale: PlanScale = UNIT_SCALE): RaceLine {
  const n = road.length;
  const step = new Float64Array(n);
  for (let i = 0; i < n; i++) step[i] = hypot(road[wrap(i + 1, n)].x - road[i].x, road[wrap(i + 1, n)].z - road[i].z);
  const room = new Float64Array(n).fill(Math.max(0, ROAD_HALF - half_width - EDGE_GAP));
  const ramp = new Int16Array(n).fill(-1);
  ramps.forEach((r, k) => {
    if (!r.road) return;
    const at = ramp_index(road, r);
    if (at < 0) return;
    for (let d = 0, i = at; d < r.length + r.landing + RAMP_PIN; d += step[i], i = wrap(i + 1, n)) room[i] = 0;
    for (let d = 0, i = at; d < RAMP_LOOK; i = wrap(i - 1, n), d += step[i]) {
      if (d < RAMP_PIN) room[i] = 0;
      ramp[i] = k;
    }
    for (let d = 0, i = at; d < r.length + r.landing; d += step[i], i = wrap(i + 1, n)) ramp[i] = k;
  });
  const offset = new Float64Array(n);
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  const left = room.map((r) => -r);
  relax(road, offset, x, z, left, room);
  const reach = Math.max(0, ROAD_HALF - half_width);
  let lo: Float64Array = new Float64Array(n).fill(-reach);
  let hi: Float64Array = new Float64Array(n).fill(reach);
  let steps: Uint8Array | null = null;
  if (ground) {
    // Read off the free line: a hazard moves the line to the clear side nearest where it ran, not across the road.
    const free = new Uint8Array(n);
    for (let i = 0; i < n; i++) free[i] = room[i] > 0 ? 1 : 0;
    ({ lo, hi, step: steps } = hazards(road, free, half_width, ground, offset));
    const right = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      left[i] = Math.max(-room[i], lo[i]);
      right[i] = Math.max(left[i], Math.min(room[i], hi[i]));
    }
    relax(road, offset, x, z, left, right);
  }
  const bend = new Float64Array(n);
  const lift = new Float64Array(n);
  const kick = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = wrap(i - CURVE_SPAN, n);
    const c = wrap(i + CURVE_SPAN, n);
    bend[i] = inverse_radius(x[a], z[a], x[i], z[i], x[c], z[c]);
    lift[i] = crest(road, step, i);
    kick[i] = ramp[i] >= 0 || steps?.[i] ? 1 : 0;
  }
  const empty = new Float64Array(0);
  return plan_for({ road, offset, x, z, speed: empty, late: empty, scale, lift, kick, bend, ramp, step, room, lo, hi }, scale);
}

/** `line` with its speeds planned anew for a car of `scale` over the coupe: the path and everything else shared. */
export function plan_for(line: RaceLine, scale: PlanScale): RaceLine {
  const { bend, lift, kick, step } = line;
  const n = bend.length;
  const car = scale.car;
  const trim = trim_of(scale);
  const speed = new Float64Array(n);
  const hold = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const radius = 1 / Math.max(1e-9, Math.abs(bend[i]));
    speed[i] = corner_speed(Math.sqrt(grip_at(bend[i], scale) * radius), lift[i], kick[i]);
    hold[i] = corner_speed(trimmed_hold(radius, car, trim), lift[i], kick[i]);
  }
  const brake = new Float64Array(n).fill(AI_TUNING.line_brake * scale.brake);
  model_corners(speed, hold, brake, line, scale, car);
  const late = speed.slice();
  const late_brake = brake.map((b) => Math.max(b, AI_TUNING.late_brake * scale.brake));
  brake_pass(speed, step, bend, lift, brake, scale);
  pull_pass(speed, step, bend, scale, car, 0);
  brake_pass(late, step, bend, lift, late_brake, scale);
  pull_pass(late, step, bend, scale, car, 0);
  return { ...line, speed, late, scale };
}

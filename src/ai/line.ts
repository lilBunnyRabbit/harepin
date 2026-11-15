import { ROAD_HALF, type Ramp, type RoadPoint } from "../worldgen/types";

/**
 * Cornering grip and braking (m/s²) the line plans on, for the stock coupe at pace 1 (`grip_pace` scales other cars). The
 * coupe holds 0.94 g on the skidpad; the driver's pursuit steering is the limit: at 6.5 a field runs wide in traffic
 * (spins and resets triple), and braking at 3 runs wide alone.
 */
export const LINE_GRIP = 6;
export const LINE_BRAKE = 2.5;
/** Braking (m/s²) a driver diving down the inside plans on: it brakes later and harder than the line, into the apex. */
export const LATE_BRAKE = 4;
/** Metres between the car's body and the road edge. */
const EDGE_GAP = 1.2;
/** Coarsest point spacing the relax starts at, and passes at spacing 1 (more at coarser ones, by the square root). */
const RELAX_TOP = 64;
const RELAX_PASSES = 100;
/** Metres a point is nudged to measure how its curvature moves with its offset. */
const NUDGE = 1e-3;
/** Share of the solved move a point takes per pass: the full move overshoots, as each point also bends its neighbours. */
const RELAX_GAIN = 0.3;
export const CURVE_SPAN = 5;
/** Fastest pace over a circuit kicker, and how far before its toe (m) the line slows for it: as the autopilot takes them. */
const JUMP_PACE = 32;
const RAMP_LOOK = 120;
/** Metres either side of a kicker's run the line keeps to the centre, lined up with the ramp. */
const RAMP_PIN = 20;

/**
 * A closed racing line over a circuit, built once at the start: per road point a signed lateral offset (along the
 * point's right normal, (tz, -tx)), the world position it gives, and the planned speed there.
 */
export interface RaceLine {
  readonly road: readonly RoadPoint[];
  readonly offset: Float64Array;
  readonly x: Float64Array;
  readonly z: Float64Array;
  /** m/s: the corner speed at each point, lowered by one backward pass so every bend can be braked for. */
  readonly speed: Float64Array;
  /** m/s: the same corner speeds braked for at LATE_BRAKE, the plan of a late braker diving down the inside. */
  readonly late: Float64Array;
  /** Signed 1/radius (1/m) of the line at each point; positive bends away from the right normal. */
  readonly bend: Float64Array;
  readonly ramp: Int16Array;
  /** Metres between point i and i + 1. */
  readonly step: Float64Array;
  /** How far the line may stray off the centre at each point (m). */
  readonly room: Float64Array;
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
  return Math.hypot(road[at].x - ramp.x, road[at].z - ramp.z) < ROAD_HALF ? at : -1;
}

/** Lowers each corner speed so every bend ahead can be braked for at `brake` m/s²: two laps backwards, as the braking curve from the slowest bend wraps past the start line. */
function brake_curve(speed: Float64Array, step: Float64Array, brake: number) {
  const n = speed.length;
  for (let k = 2 * n - 1; k >= 0; k--) {
    const i = wrap(k, n);
    const next = wrap(k + 1, n);
    speed[i] = Math.min(speed[i], Math.sqrt(speed[next] * speed[next] + 2 * brake * step[i]));
  }
}

/**
 * Relaxes the centreline toward the least-curvature path inside the road, then plans speed on the result. Each pass
 * moves a point toward where its neighbours' second difference would vanish, clamped to the road less the car's half
 * width (`half_width`, m). The plain midpoint (shortest path) is slower: it bunches a bend's turn at the apex.
 */
export function race_line(road: readonly RoadPoint[], ramps: readonly Ramp[], half_width: number): RaceLine {
  const n = road.length;
  const step = new Float64Array(n);
  for (let i = 0; i < n; i++) step[i] = Math.hypot(road[wrap(i + 1, n)].x - road[i].x, road[wrap(i + 1, n)].z - road[i].z);
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
  const place = () => {
    for (let i = 0; i < n; i++) {
      x[i] = road[i].x + road[i].tz * offset[i];
      z[i] = road[i].z - road[i].tx * offset[i];
    }
  };
  place();
  const curvature = (a: number, mid: number, b: number) => inverse_radius(x[a], z[a], x[mid], z[mid], x[b], z[b]);
  // Each point moves sideways until its curvature is the distance-weighted mean of its neighbours', coarse spacing
  // first; between passes the points in between follow by linear interpolation.
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
        offset[i] = Math.max(-room[i], Math.min(room[i], offset[i] + (RELAX_GAIN * (want - k0)) / slope));
        x[i] = p.x + p.tz * offset[i];
        z[i] = p.z - p.tx * offset[i];
      }
    }
    if (span > 1)
      for (let i = 0; i < n; i += span) {
        const next = Math.min(n, i + span);
        const to = offset[next % n];
        for (let k = i + 1; k < next; k++) offset[k] = Math.max(-room[k], Math.min(room[k], offset[i] + ((to - offset[i]) * (k - i)) / (next - i)));
      }
    place();
  }
  place();
  const speed = new Float64Array(n);
  const bend = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = wrap(i - CURVE_SPAN, n);
    const c = wrap(i + CURVE_SPAN, n);
    bend[i] = inverse_radius(x[a], z[a], x[i], z[i], x[c], z[c]);
    speed[i] = Math.min(Math.sqrt(LINE_GRIP / Math.abs(bend[i])), ramp[i] >= 0 ? JUMP_PACE : Infinity);
  }
  const late = speed.slice();
  brake_curve(speed, step, LINE_BRAKE);
  brake_curve(late, step, LATE_BRAKE);
  return { road, offset, x, z, speed, late, bend, ramp, step, room };
}

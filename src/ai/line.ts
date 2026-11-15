import { GRAVITY } from "../car/rigid-body";
import type { DeckIndex } from "../worldgen/deck";
import { ROAD_HALF, type Ramp, type RoadPoint } from "../worldgen/types";
import { AI_TUNING, BANK_OVER, BANK_STEEP } from "./tuning";

/** Bend radii (m) over which the line's grip eases from `AI_TUNING.line_grip` up to `fast_grip`. */
const HAIRPIN_RADIUS = 25;
const FAST_RADIUS = 80;

/** Grip (m/s²) the line plans a bend of signed curvature `bend` (1/m) on. */
export function grip_at(bend: number): number {
  const radius = 1 / Math.max(1e-9, Math.abs(bend));
  const { line_grip, fast_grip } = AI_TUNING;
  return line_grip + (fast_grip - line_grip) * Math.max(0, Math.min(1, (radius - HAIRPIN_RADIUS) / (FAST_RADIUS - HAIRPIN_RADIUS)));
}

/**
 * Speed (m/s) at which a bank holds the car through a bend with no side grip at all: v² = g R tan(bank). Under it a
 * bank steeper than the tyres can hold slides the car to the low rail; 0 off a bank or on one leaning out of the bend.
 */
export function bank_floor(bend: number, bank: number): number {
  const lean = bend < 0 ? -bank : bank;
  if (lean <= 0) return 0;
  return Math.sqrt((GRAVITY * Math.tan(Math.min(lean, BANK_MOST))) / Math.max(1e-9, Math.abs(bend)));
}

/**
 * Speed (m/s) a bend of signed curvature `bend` is planned at with `grip` (m/s²) on a deck banked `bank` rad (+ up on the
 * side of the road's right normal, the outside of a positive bend): the flat plan `flat`, raised to the bank's neutral
 * speed, held under BANK_OVER times it (past that the car bottoms out) and under the grip limit at that bank.
 */
export function bank_pace(bend: number, bank: number, grip: number, flat: number): number {
  const reach = 1 / Math.max(1e-9, Math.abs(bend));
  const tilt = (bend < 0 ? -bank : bank) + Math.atan(grip / GRAVITY);
  const limit = tilt >= Math.PI / 2 ? Infinity : Math.sqrt(GRAVITY * reach * Math.tan(Math.max(0, tilt)));
  const floor = bank_floor(bend, bank);
  return Math.min(limit, floor > 0 ? BANK_OVER * floor : Infinity, Math.max(flat, floor));
}

/** Most bank (rad) the neutral speed is read at: past it tan runs away, and a near-vertical wall has no speed to hold it. */
const BANK_MOST = (80 * Math.PI) / 180;

/**
 * Bank (rad, + up on the right normal's side) of the deck under each road point where it is at least BANK_STEEP, else 0;
 * null on a kind with no deck. Gentler banks plan flat, as they always have.
 */
export function road_banks(deck: DeckIndex | null, road: readonly RoadPoint[]): Float64Array | null {
  if (!deck) return null;
  const bank = new Float64Array(road.length);
  for (let i = 0; i < road.length; i++) {
    const p = road[i];
    const hit = deck.surface(p.x, p.z, p.y);
    const b = hit ? deck.at(hit.index, 5) : 0;
    bank[i] = Math.abs(b) >= BANK_STEEP ? b : 0;
  }
  return bank;
}

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
/** Road points either side a crest's vertical curvature is read over. */
const CREST_SPAN = 10;
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
  /** m/s: the same corner speeds braked for at `AI_TUNING.late_brake`, the plan of a late braker diving down the inside. */
  readonly late: Float64Array;
  /** Signed 1/radius (1/m) of the line at each point; positive bends away from the right normal. */
  readonly bend: Float64Array;
  readonly ramp: Int16Array;
  /** Metres between point i and i + 1. */
  readonly step: Float64Array;
  /** How far the line may stray off the centre at each point (m). */
  readonly room: Float64Array;
  /** Steep deck bank (rad) under each point, + up on the right normal's side; 0 on ground and gentle banks. */
  readonly bank: Float64Array;
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
 * Relaxes the centreline toward the least-curvature path inside the road, then plans speed on the result. Each pass
 * moves a point toward where its neighbours' second difference would vanish, clamped to the road less the car's half
 * width (`half_width`, m). The plain midpoint (shortest path) is slower: it bunches a bend's turn at the apex.
 */
export function race_line(road: readonly RoadPoint[], ramps: readonly Ramp[], half_width: number, banks: Float64Array | null = null): RaceLine {
  const n = road.length;
  const bank = banks ?? new Float64Array(n);
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
    // Over a crest the car goes light by v² times the road's vertical curvature, and its grip with it: v² = G R / (1 + G R k / g).
    // A 9% climb into a 9% drop in a 200 m bend at 38 m/s took a third of the load, and the field spun there.
    const grip = grip_at(bend[i]);
    const reach = grip / Math.max(1e-9, Math.abs(bend[i]));
    const flat = Math.sqrt(reach / (1 + Math.min(AI_TUNING.crest_light, (reach * crest(road, step, i)) / GRAVITY)));
    const corner = bank[i] === 0 ? flat : bank_pace(bend[i], bank[i], grip, flat);
    speed[i] = Math.min(corner, ramp[i] >= 0 ? JUMP_PACE : Infinity);
  }
  const late = speed.slice();
  brake_curve(speed, step, AI_TUNING.line_brake);
  brake_curve(late, step, AI_TUNING.late_brake);
  return { road, offset, x, z, speed, late, bend, ramp, step, room, bank };
}

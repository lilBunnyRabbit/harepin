import { mulberry32, sub } from "../rng";
import { flight, RIDE, ROAD_KICKER } from "./jumps";
import { circuit_route } from "./routes";
import { CELL, DECK_STRIDE, N, ROAD_HALF, SIZE, type Checkpoint, type DeckPiece, type OpenSection, type Ramp, type RoadPoint, type Solid, type WorldData } from "./types";

export const ABYSS = -2000;
/** How far below the deck under it a car counts as fallen off. */
export const FALL_DEPTH = 6;
const STEP = 2;
const SUBSTEPS = 8;
const ATTEMPTS = 400;
const START_Y = 270;
const Y_MIN = 140;
const Y_MAX = 400;
const BOUND = 880;
const SEPARATION = 44;
const SEPARATION_ALONG = 120;
/** Sections closer than SEPARATION in xz pass at least this far apart in height: a crossover. */
export const CLEARANCE = 10;
/** A crossover zone longer than this is a shallow overlap, not a crossing. */
const ZONE_MAX = 160;
const MAX_ZONES = 4;
/** Room before a crossover to climb or drop to its level. */
const ZONE_LEAD = 200;
const EIGHT_ODDS = 0.3;
const HELIX_ODDS = 0.45;
const HAIRPIN_ODDS = 0.35;
const MACRO_ODDS = 0.7;
const HAIRPIN_ANGLE = [2.6, 3.5] as const;
const HAIRPIN_RADIUS = [26, 40] as const;
const SWEEP_MIN = 0.35;
const SWEEP_MAX = 2.4;
/** Turning past one full coil, and the coil radius: small enough that a helix stays under the constant-curvature share. */
const HELIX_EXTRA = [0.6, 1.8] as const;
const HELIX_RADIUS = [40, 55] as const;
/** Straight each side of a helix, holding the ramp onto and off its grade. */
const HELIX_RUN = 50;
/** JUMP_BEFORE + the gap span + JUMP_AFTER is about 245 m. */
const JUMP_STRAIGHT = 260;
/** Vertical curve radius of every grade change: under 300 m the 2 m centreline steps the normal by over 0.5°. */
const VERTICAL_RADIUS = 320;
const MAX_CLIMB = 0.1;
const MAX_DROP = 0.25;
const EASE = 15;
const BANK_RATE = (1.2 * Math.PI) / 180;
const START_AHEAD = 60;
/** Flat straight before the start line: the grid spawns 80 m back on it. */
const START_BEHIND = 120;
const STRAIGHT_MIN = 40;
const STRETCH_MAX = 420;
/** Kept between a straight and its length limits by the spread, so the exact pair solve after it always fits. */
const CLOSE_SLACK = 2;
const CLOSE_SWEEPS = 300;
const CHECKPOINT_GAP = 300;
/** Flat deck before a gap's toe: a checkpoint JUMP_GATE before it, then the run-up. */
const JUMP_BEFORE = 70;
const JUMP_GATE = 60;
const JUMP_AFTER = 50;
const JUMP_APART = 300;
const MAX_JUMPS = 2;
/** Share of the lap left without a rail on one or both sides, and the shortest such stretch. */
const OPEN_SHARE = [0.15, 0.3] as const;
const OPEN_MIN = 60;
const OPEN_MAX = 220;
/** Flat arcs at least this wide may lose a rail: at 45 m/s that is under half the planning grip. */
const OPEN_RADIUS = 450;
/** Kept clear of a jump zone or a banked or tight piece on either side. */
const OPEN_CLEAR = 20;
const RAIL_BOTTOM = -0.6;
const RAIL_TOP = 1.2;
const RAIL_HALF = 0.25;
const GATE_POST = 1.7;
export const PAD_LENGTH = 12;
/** Painted half-width of a pad, inset from the deck edge; a car whose centre is over it gets the kick. */
export const PAD_HALF = ROAD_HALF - 1;
/** A pad ends PAD_LEAD before the foot of a climb, or starts PAD_EXIT into the straight after a bend. */
const PAD_LEAD = 15;
const PAD_EXIT = 20;
/** Straight deck left past a pad, so the kick is spent before the next bend. */
const PAD_RUNOUT = 80;
// Off the throttle, even in neutral, every car rolls from PAD_MAX back under GAP_FAST inside this (sky-pads.test.ts), so a pad
// adds nothing at the toe. On the throttle every car tops GAP_FAST on its own: holding the gap's speed is the driver's job.
export const PAD_GAP_CLEAR = 500;
const PAD_APART = 300;
export const MAX_PADS = 4;

interface Turn {
  angle: number;
  radius: number;
  bank: number;
}

interface PlanPiece {
  kind: "straight" | "arc";
  length: number;
  curve: number;
  ease: number;
  bank: number;
  min: number;
  stretch: boolean;
  helix: boolean;
}

interface Pose {
  x: number;
  z: number;
  h: number;
}

function heading_at(p: PlanPiece, h0: number, s: number): number {
  if (p.kind === "straight") return h0;
  const k = p.curve;
  const e = p.ease;
  if (s <= e) return h0 + (k * s * s) / (2 * e);
  const mid = p.length - 2 * e;
  if (s <= e + mid) return h0 + (k * e) / 2 + k * (s - e);
  const r = p.length - s;
  return h0 + k * (e + mid) - (k * r * r) / (2 * e);
}

function trace(p: PlanPiece, start: Pose, emit?: (x: number, z: number, h: number, s: number) => void): Pose {
  const n = Math.max(1, Math.ceil(p.length / STEP));
  const ds = p.length / n;
  let { x, z } = start;
  for (let i = 0; i < n; i++) {
    emit?.(x, z, heading_at(p, start.h, i * ds), i * ds);
    if (p.kind === "straight") {
      x += Math.sin(start.h) * ds;
      z += Math.cos(start.h) * ds;
      continue;
    }
    const sub_ds = ds / SUBSTEPS;
    for (let k = 0; k < SUBSTEPS; k++) {
      const h = heading_at(p, start.h, i * ds + (k + 0.5) * sub_ds);
      x += Math.sin(h) * sub_ds;
      z += Math.cos(h) * sub_ds;
    }
  }
  return { x, z, h: heading_at(p, start.h, p.length) };
}

function turn_angle(p: PlanPiece): number {
  return p.kind === "arc" ? p.curve * (p.length - p.ease) : 0;
}

function arc(t: Turn): PlanPiece {
  const ease = Math.max(EASE, Math.abs(t.bank) / (BANK_RATE * 0.95));
  const radius = Math.max(t.radius, (ease * 1.2) / Math.abs(t.angle));
  const curve = Math.sign(t.angle) / radius;
  return { kind: "arc", length: t.angle / curve + ease, curve, ease, bank: t.bank, min: 0, stretch: false, helix: false };
}

function straight(length: number, min: number, stretch = true): PlanPiece {
  return { kind: "straight", length, curve: 0, ease: 0, bank: 0, min, stretch, helix: false };
}

function hairpin(rng: () => number, angle: number): Turn {
  return { angle, radius: HAIRPIN_RADIUS[0] + rng() * (HAIRPIN_RADIUS[1] - HAIRPIN_RADIUS[0]), bank: rng() < 0.5 ? -Math.sign(angle) * (0.35 + rng() * 0.14) : 0 };
}

function hairpin_angle(rng: () => number, sign: number): number {
  return sign * (HAIRPIN_ANGLE[0] + rng() * (HAIRPIN_ANGLE[1] - HAIRPIN_ANGLE[0]));
}

/** A net-zero run of bends between two skeleton turns: S-bend, esses, chicane or switchback. */
function macro(rng: () => number): PlanPiece[] {
  const sign = rng() < 0.5 ? 1 : -1;
  const pick = rng();
  if (pick < 0.3) {
    const a = sign * (0.8 + rng() * 0.8);
    const r = 45 + rng() * 45;
    return [arc({ angle: a, radius: r, bank: 0 }), straight(10 + rng() * 30, 10, false), arc({ angle: -a, radius: r, bank: 0 })];
  }
  if (pick < 0.55) {
    const a = sign * (0.5 + rng() * 0.5);
    const b = sign * (0.5 + rng() * 0.5);
    const r = 50 + rng() * 40;
    return [a, -b, b, -a].map((angle) => arc({ angle, radius: r, bank: 0 }));
  }
  if (pick < 0.75) {
    const a = sign * (0.45 + rng() * 0.25);
    const r = 50 + rng() * 20;
    return [arc({ angle: a, radius: r, bank: 0 }), straight(12 + rng() * 10, 10, false), arc({ angle: -a, radius: r, bank: 0 })];
  }
  const a = hairpin_angle(rng, sign);
  return [arc(hairpin(rng, a)), straight(60 + rng() * 80, 50, false), arc(hairpin(rng, -a))];
}

/** Skeleton turns that share `total` exactly: some hairpins, the rest sweepers splitting what the hairpins leave. */
function skeleton(rng: () => number, total: number): Turn[] | null {
  const sign = Math.sign(total) || 1;
  const pins: number[] = [];
  let rest = total;
  while (rng() < HAIRPIN_ODDS * 2 && pins.length < 2) {
    const a = hairpin_angle(rng, sign);
    if (Math.abs(rest - a) < SWEEP_MIN * 2 || Math.sign(rest - a) !== sign) break;
    pins.push(a);
    rest -= a;
  }
  const count = Math.max(2, Math.round(Math.abs(rest) / (0.7 + rng() * 0.6)));
  const weights = Array.from({ length: count }, () => 0.5 + rng());
  const sum = weights.reduce((a, b) => a + b, 0);
  const turns: Turn[] = [];
  for (const w of weights) {
    const angle = (w / sum) * rest;
    if (Math.abs(angle) < SWEEP_MIN || Math.abs(angle) > SWEEP_MAX) return null;
    const banked = Math.abs(angle) > 1 && rng() < 0.7;
    turns.push({ angle, radius: banked ? 60 + rng() * 100 : 70 + rng() * 110, bank: banked ? -sign * (0.26 + rng() * 0.26) : 0 });
  }
  for (const a of pins) turns.splice(Math.floor(rng() * (turns.length + 1)), 0, hairpin(rng, a));
  return turns;
}

// Heading closes only if the turning totals 2π per lap: 0 for a figure-eight, plus 2π for a helix coil.
function draw_layout(rng: () => number): PlanPiece[] | null {
  const eight = rng() < EIGHT_ODDS;
  const coil = rng() < HELIX_ODDS ? (rng() < 0.5 ? 1 : -1) : 0;
  const helix_angle = coil * (2 * Math.PI + HELIX_EXTRA[0] + rng() * (HELIX_EXTRA[1] - HELIX_EXTRA[0]));
  const need = (eight ? 0 : 2 * Math.PI) + coil * 2 * Math.PI - helix_angle;
  let turns: Turn[] | null;
  if (eight) {
    const lefts = Math.PI * (1.2 + rng() * 0.8);
    const a = skeleton(rng, lefts);
    const b = skeleton(rng, need - lefts);
    turns = a && b ? [...a, ...b] : null;
  } else turns = skeleton(rng, need);
  if (!turns) return null;
  const last = turns.length - 1;
  const jump_at = Math.floor(rng() * last);
  const helix_at = coil ? Math.floor(rng() * last) : -1;
  const pieces: PlanPiece[] = [straight(START_AHEAD + rng() * 60, START_AHEAD)];
  turns.forEach((t, i) => {
    pieces.push(arc(t));
    if (i === last) {
      pieces.push(straight(START_BEHIND + rng() * 80, START_BEHIND));
      return;
    }
    pieces.push(i === jump_at ? straight(JUMP_STRAIGHT + rng() * 120, JUMP_STRAIGHT) : straight(STRAIGHT_MIN + rng() * 140, STRAIGHT_MIN));
    if (rng() < MACRO_ODDS) pieces.push(...macro(rng), straight(STRAIGHT_MIN + rng() * 100, STRAIGHT_MIN));
    if (i === helix_at) {
      const radius = HELIX_RADIUS[0] + rng() * (HELIX_RADIUS[1] - HELIX_RADIUS[0]);
      pieces.push(straight(HELIX_RUN + rng() * 40, HELIX_RUN, false), { ...arc({ angle: helix_angle, radius, bank: -coil * (0.3 + rng() * 0.1) }), helix: true }, straight(HELIX_RUN + rng() * 40, HELIX_RUN, false));
    }
  });
  let end: Pose = { x: 0, z: 0, h: 0 };
  for (const p of pieces) end = trace(p, end);
  const stretchy = pieces.flatMap((p, i) => (p.kind === "straight" && p.stretch ? [i] : []));
  const headings: number[] = [];
  let h = 0;
  for (const p of pieces) {
    headings.push(h);
    h += turn_angle(p);
  }
  // A twisty lap misses by more than any two straights can take up, so every stretchy straight takes a share first
  // (coordinate descent inside each one's length limits); one pair then closes the last few centimetres exactly.
  const dirs = stretchy.map((i) => [Math.sin(headings[i]), Math.cos(headings[i])] as const);
  const lo = stretchy.map((i) => pieces[i].min + CLOSE_SLACK - pieces[i].length);
  const hi = stretchy.map((i) => STRETCH_MAX - CLOSE_SLACK - pieces[i].length);
  const delta = stretchy.map(() => 0);
  let ex = end.x;
  let ez = end.z;
  for (let sweep = 0; sweep < CLOSE_SWEEPS && ex * ex + ez * ez > 0.01; sweep++)
    dirs.forEach(([dx, dz], k) => {
      const next = Math.max(lo[k], Math.min(hi[k], delta[k] - (dx * ex + dz * ez)));
      ex += dx * (next - delta[k]);
      ez += dz * (next - delta[k]);
      delta[k] = next;
    });
  if (ex * ex + ez * ez > 0.01) return null;
  stretchy.forEach((i, k) => (pieces[i].length += delta[k]));
  for (let a = 0; a < stretchy.length; a++)
    for (let b = a + 1; b < stretchy.length; b++) {
      const i = stretchy[a];
      const j = stretchy[b];
      const d1x = Math.sin(headings[i]);
      const d1z = Math.cos(headings[i]);
      const d2x = Math.sin(headings[j]);
      const d2z = Math.cos(headings[j]);
      const det = d1x * d2z - d1z * d2x;
      if (Math.abs(det) < 0.5) continue;
      const la = (-ex * d2z + ez * d2x) / det;
      const lb = (-d1x * ez + d1z * ex) / det;
      const na = pieces[i].length + la;
      const nb = pieces[j].length + lb;
      if (na < pieces[i].min + 4 || nb < pieces[j].min + 4 || na > STRETCH_MAX || nb > STRETCH_MAX) continue;
      pieces[i].length = na;
      pieces[j].length = nb;
      return pieces;
    }
  return null;
}

/** Slowest toe speed a gap is sized to clear, and the fastest its landing runs out. */
export const GAP_SLOW = 22;
// Past a 37 m/s toe (40 here, which the run-up arrives at 3 m/s down) the kaze yaws past 0.35 rad/s off every landing
// tried, flat included, and it does on the island's road kicker at 45 too.
export const GAP_FAST = 40;
/** Landing deck half-width: a little wider than the run-up for a car that took off with some slip. */
export const LANDING_HALF = 7.5;
/** The landing starts this far below the lip. */
const LANDING_DROP = 2;
// Nearly level, like the island's road kicker landing: on a 25% landing every car came down 0.35 rad steeper than the
// deck, bounced, and with a little slip yawed past 0.35 rad/s on the second touchdown.
export const LANDING_GRADE = -0.04;
/** Slowest touchdown lands this far onto the landing; the landing runs this far past the fastest one. */
const LANDING_SPARE = 6;
const LANDING_RUNOUT = 20;
/** Past the landing the deck narrows back to ROAD_HALF over this many metres, so the rail never steps in. */
const LANDING_TAPER = 40;
export const SKY_KICKER = ROAD_KICKER;
const KICKER_GRADE = SKY_KICKER.rise / SKY_KICKER.length;

export interface GapJump {
  gap: number;
  /** Straight landing at LANDING_GRADE before its sag curve back to level. */
  landing: number;
  sag: number;
  rise: number;
  drop: number;
  /** Run-up before the toe, then the whole span from the toe to the end of the sag. */
  span: number;
}

/** The kicker lip as a ramp at the origin heading +z, for the flight maths. */
export function gap_ramp(): Ramp {
  return { id: 0, kind: ROAD_KICKER.kind, x: 0, y: 0, z: 0, fx: 0, fz: 1, hw: ROAD_HALF, length: SKY_KICKER.length, rise: SKY_KICKER.rise, grade: 0, landing: 0, speed: GAP_SLOW, back: SKY_KICKER.back, road: true, deck: true };
}

/** Metres past the lip where a car that hit the toe at `speed` comes down on the landing. */
export function touchdown(speed: number, gap: number): number {
  const r = gap_ramp();
  const lip = SKY_KICKER.rise;
  const surface = (d: number) => lip - LANDING_DROP + Math.min(0, LANDING_GRADE * (d - gap)) + RIDE;
  let d = 0.5;
  while (d < 400 && flight(r, speed, d) > surface(d)) d += 0.25;
  return d;
}

export function size_gap(): GapJump {
  const r = gap_ramp();
  let d = 1;
  while (flight(r, GAP_SLOW, d) > SKY_KICKER.rise - LANDING_DROP + RIDE) d += 0.25;
  const gap = Math.floor(d - LANDING_SPARE);
  const landing = touchdown(GAP_FAST, gap) + LANDING_RUNOUT - gap;
  const sag = ramp_length(LANDING_GRADE, 0);
  return { gap, landing, sag, rise: SKY_KICKER.rise, drop: LANDING_DROP, span: SKY_KICKER.length + gap + landing + sag };
}

interface Sample {
  x: number;
  z: number;
  h: number;
  s: number;
  piece: number;
  bank: number;
}

function bank_at(p: PlanPiece, s: number): number {
  if (p.kind !== "arc" || p.bank === 0) return 0;
  const f = Math.min(1, s / p.ease, (p.length - s) / p.ease);
  return p.bank * f;
}

function sample_layout(pieces: PlanPiece[]): { samples: Sample[]; length: number; error: number } {
  const samples: Sample[] = [];
  let pose: Pose = { x: 0, z: 0, h: 0 };
  let s0 = 0;
  pieces.forEach((p, index) => {
    pose = trace(p, pose, (x, z, h, s) => samples.push({ x, z, h, s: s0 + s, piece: index, bank: bank_at(p, s) }));
    s0 += p.length;
  });
  return { samples, length: s0, error: Math.hypot(pose.x, pose.z) };
}

/** Sample pairs on sections that aren't neighbours and come closer than SEPARATION in xz; the first is the earlier one. */
function close_pairs(samples: readonly Sample[], length: number): [number, number][] {
  const grid = new Map<number, number[]>();
  const cell = (v: number) => Math.floor(v / SEPARATION) + 1000;
  const pairs: [number, number][] = [];
  samples.forEach((p, j) => {
    const cx = cell(p.x);
    const cz = cell(p.z);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        for (const i of grid.get((cx + dx) * 4096 + cz + dz) ?? []) {
          const q = samples[i];
          const along = p.s - q.s;
          if (Math.min(along, length - along) < SEPARATION_ALONG) continue;
          if ((p.x - q.x) ** 2 + (p.z - q.z) ** 2 < SEPARATION * SEPARATION) pairs.push([i, j]);
        }
    const key = cx * 4096 + cz;
    const list = grid.get(key);
    if (list) list.push(j);
    else grid.set(key, [j]);
  });
  return pairs;
}

/** Where the track passes over or under itself: `a0..a1` on the earlier pass, `s0..s1` on the later one, metres along the lap. */
export interface Zone {
  a0: number;
  a1: number;
  s0: number;
  s1: number;
  /** Both passes inside one helix, whose constant grade already keeps the coils apart. */
  helix: boolean;
}

const ZONE_JOIN = 20;
/** Flat deck kept past each end of a crossover, and between a crossover and a jump. */
const ZONE_MARGIN = 10;

function zones_of(samples: readonly Sample[], pairs: readonly [number, number][]): Zone[] {
  const zones: Zone[] = [];
  const near = (z: Zone, a: number, s: number) => s >= z.s0 - ZONE_JOIN && s <= z.s1 + ZONE_JOIN && a >= z.a0 - ZONE_JOIN && a <= z.a1 + ZONE_JOIN;
  for (const [i, j] of pairs) {
    const a = samples[i].s;
    const s = samples[j].s;
    const z = zones.find((z) => near(z, a, s));
    if (!z) {
      zones.push({ a0: a, a1: a, s0: s, s1: s, helix: false });
      continue;
    }
    z.a0 = Math.min(z.a0, a);
    z.a1 = Math.max(z.a1, a);
    z.s0 = Math.min(z.s0, s);
    z.s1 = Math.max(z.s1, s);
  }
  for (let merged = true; merged; ) {
    merged = false;
    for (let i = 0; i < zones.length && !merged; i++)
      for (let j = i + 1; j < zones.length && !merged; j++) {
        const a = zones[i];
        const b = zones[j];
        if (b.s0 > a.s1 + ZONE_JOIN || b.s1 < a.s0 - ZONE_JOIN || b.a0 > a.a1 + ZONE_JOIN || b.a1 < a.a0 - ZONE_JOIN) continue;
        zones[i] = { a0: Math.min(a.a0, b.a0), a1: Math.max(a.a1, b.a1), s0: Math.min(a.s0, b.s0), s1: Math.max(a.s1, b.s1), helix: false };
        zones.splice(j, 1);
        merged = true;
      }
  }
  return zones.sort((a, b) => a.s0 - b.s0);
}

export interface Twist {
  /** Total absolute heading change per km of lap (rad/km). */
  turn: number;
  /** Bends that turn at least CORNER_TURN; a change of direction starts a new one. */
  corners: number;
  /** Longest stretch of near-constant curvature, straights included, as a share of the lap. */
  constant: number;
  /** 4π·area / length²: 1 for a circle, near 0 for a figure-eight or a long thin lap. */
  roundness: number;
}

/** What a lap must reach to count as twisty; a layout that misses any is redrawn. */
export const TWIST = { turn: 4.5, corners: 12, constant: 0.14, roundness: 0.45 } as const;
const CORNER_CURVE = 1 / 300;
const CORNER_TURN = (20 * Math.PI) / 180;
const CONSTANT_BAND = 0.002;

/** Twistiness of a closed centreline whose points carry their unit tangent and are about evenly spaced. */
export function twistiness(points: readonly { x: number; z: number; tx: number; tz: number }[]): Twist {
  const n = points.length;
  const curve: number[] = [];
  const turn: number[] = [];
  const step: number[] = [];
  let length = 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const dh = Math.atan2(a.tz * b.tx - a.tx * b.tz, a.tx * b.tx + a.tz * b.tz);
    length += d;
    area += a.x * b.z - b.x * a.z;
    turn.push(dh);
    step.push(d);
    curve.push(d > 1e-6 ? dh / d : 0);
  }
  let corners = 0;
  let run = 0;
  let sign = 0;
  for (let i = 0; i <= n; i++) {
    const k = curve[i % n];
    const s = Math.abs(k) >= CORNER_CURVE ? Math.sign(k) : 0;
    if (s !== sign) {
      if (run >= CORNER_TURN) corners++;
      run = 0;
      sign = s;
    }
    if (s) run += Math.abs(turn[i % n]);
  }
  if (sign && run >= CORNER_TURN) corners++;
  let longest = 0;
  for (let i = 0; i < n; ) {
    const ref = curve[i];
    let j = i;
    let span = 0;
    while (j < i + n && Math.abs(curve[j % n] - ref) <= CONSTANT_BAND) span += step[j++ % n];
    longest = Math.max(longest, span);
    i = Math.max(j, i + 1);
  }
  const total = turn.reduce((sum, t) => sum + Math.abs(t), 0);
  return { turn: total / (length / 1000), corners, constant: longest / length, roundness: (2 * Math.PI * Math.abs(area)) / (length * length) };
}

export function twisty(t: Twist): boolean {
  return t.turn >= TWIST.turn && t.corners >= TWIST.corners && t.constant <= TWIST.constant && t.roundness <= TWIST.roundness;
}

export interface Grade {
  s0: number;
  s1: number;
  g0: number;
  g1: number;
  solid: boolean;
}

function ramp_length(g0: number, g1: number): number {
  return Math.abs(g1 - g0) * VERTICAL_RADIUS;
}

/** Grade of a rise or drop that changes height by `rise` in exactly `room` metres, ramps included; null when too steep. */
function solve_grade(rise: number, room: number, drop = MAX_DROP): number | null {
  if (Math.abs(rise) < 1e-9) return 0;
  const disc = room * room - 4 * VERTICAL_RADIUS * Math.abs(rise);
  if (disc < 0) return null;
  const g = (Math.sign(rise) * (room - Math.sqrt(disc))) / (2 * VERTICAL_RADIUS);
  return g > MAX_CLIMB || g < -drop ? null : g;
}

interface Helix {
  s0: number;
  s1: number;
  radius: number;
}

interface JumpEvent {
  kind: "jump";
  at: number;
  toe: number;
}

interface HelixEvent {
  kind: "helix";
  at: number;
  helix: Helix;
}

interface ZoneEvent {
  kind: "zone";
  at: number;
  zone: Zone;
}

type ProfileEvent = JumpEvent | HelixEvent | ZoneEvent;

/** Steepest a profile climbs or drops to reach a crossover's level, and a helix's descent; MAX_DROP is for the plunges. */
const ZONE_GRADE = 0.18;
const HELIX_DROP = 0.12;

function draw_profile(rng: () => number, length: number, toes: readonly number[], helices: readonly Helix[], zones: readonly Zone[]): Grade[] | null {
  const out: Grade[] = [];
  let s = START_AHEAD;
  let y = 0;
  const end = length - START_BEHIND;
  const push = (s0: number, s1: number, g0: number, g1: number) => {
    if (s1 > s0) out.push({ s0, s1, g0, g1, solid: true });
  };
  const feature = (at: number, g: number, hold: number) => {
    const ramp = ramp_length(0, g);
    push(s, at, 0, 0);
    push(at, at + ramp, 0, g);
    push(at + ramp, at + ramp + hold, g, g);
    push(at + ramp + hold, at + 2 * ramp + hold, g, 0);
    s = at + 2 * ramp + hold;
    y += g * (ramp + hold);
  };
  const reserve = Math.min(900, length * 0.25);
  const jump = size_gap();
  const gap_jump = (toe: number): boolean => {
    if (toe - JUMP_BEFORE < s) return false;
    push(s, toe, 0, 0);
    out.push({ s0: toe, s1: toe + SKY_KICKER.length, g0: KICKER_GRADE, g1: KICKER_GRADE, solid: true });
    const land = toe + SKY_KICKER.length + jump.gap;
    out.push({ s0: toe + SKY_KICKER.length, s1: land, g0: -jump.drop / jump.gap, g1: -jump.drop / jump.gap, solid: false });
    push(land, land + jump.landing, LANDING_GRADE, LANDING_GRADE);
    push(land + jump.landing, land + jump.landing + jump.sag, LANDING_GRADE, 0);
    s = toe + jump.span;
    y += SKY_KICKER.rise - jump.drop + LANDING_GRADE * jump.landing + (LANDING_GRADE / 2) * jump.sag;
    return true;
  };
  // Coils within SEPARATION of each other are a little under one turn apart along the deck, not a full one.
  const coil = (h: Helix): boolean => {
    const apart = h.radius * (2 * Math.PI - 2 * Math.asin(Math.min(1, SEPARATION / 2 / h.radius)));
    const steep = (CLEARANCE + 2) / apart;
    const climb_by = steep * (h.s1 - h.s0);
    const up = START_Y + y + climb_by > Y_MAX - 30 ? false : START_Y + y - climb_by < Y_MIN + 30 ? true : rng() < 0.5;
    const g = up ? steep : -steep;
    if (g > MAX_CLIMB || g < -HELIX_DROP) return false;
    const at = h.s0 - ramp_length(0, g);
    if (at < s) return false;
    feature(at, g, h.s1 - h.s0);
    return true;
  };
  const span_y = (a0: number, a1: number): [number, number] => {
    const climbs = climb(out);
    let lo = Infinity;
    let hi = -Infinity;
    for (let a = a0; a <= a1; a += STEP) {
      const h = height_at(out, climbs, a).y - START_Y;
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    return [lo, hi];
  };
  // The earlier pass is already built, so the later one climbs over it or drops under it and holds level through.
  const cross = (z: Zone): boolean => {
    const stop = z.s0 - ZONE_MARGIN;
    if (stop < s || z.a1 + ZONE_MARGIN > s) return false;
    const [lo, hi] = span_y(z.a0 - ZONE_MARGIN, z.a1 + ZONE_MARGIN);
    const over = hi + CLEARANCE + 1;
    const under = lo - CLEARANCE - 1;
    if (y < over && y > under) {
      const room = stop - s;
      const g = [over, under]
        .filter((t) => START_Y + t >= Y_MIN + 5 && START_Y + t <= Y_MAX - 5)
        .sort((a, b) => Math.abs(a - y) - Math.abs(b - y))
        .map((t) => solve_grade(t - y, room, ZONE_GRADE))
        .find((g) => g !== null);
      if (g === undefined || g === null) return false;
      feature(s, g, room - 2 * ramp_length(0, g));
    }
    push(s, z.s1 + ZONE_MARGIN, 0, 0);
    s = Math.max(s, z.s1 + ZONE_MARGIN);
    return true;
  };
  const events: ProfileEvent[] = [
    ...toes.map((toe): ProfileEvent => ({ kind: "jump", at: toe - JUMP_BEFORE, toe })),
    ...helices.map((helix): ProfileEvent => ({ kind: "helix", at: helix.s0 - HELIX_RUN, helix })),
    ...zones.filter((z) => !z.helix).map((zone): ProfileEvent => ({ kind: "zone", at: zone.s0 - ZONE_LEAD, zone })),
  ].sort((a, b) => a.at - b.at);
  for (;;) {
    const at = s + 20 + rng() * 140;
    const rise = y < -25 || (y < 25 && rng() < 0.45);
    const g = rise ? 0.04 + rng() * (MAX_CLIMB - 0.04) : -(0.08 + rng() * (MAX_DROP - 0.08));
    const hold = rise ? 30 + rng() * 120 : 20 + rng() * 60;
    const done = at + 2 * ramp_length(0, g) + hold;
    const next = events[0];
    if (next && (done > next.at || done > end - reserve)) {
      events.shift();
      const ok = next.kind === "jump" ? gap_jump(next.toe) : next.kind === "helix" ? coil(next.helix) : cross(next.zone);
      if (!ok) return null;
      continue;
    }
    if (done > end - reserve) break;
    feature(at, g, hold);
  }
  const at = s + 10;
  const room = end - 10 - at;
  const g = room > 0 ? solve_grade(-y, room) : null;
  if (g === null) return null;
  if (g !== 0) feature(at, g, room - 2 * ramp_length(0, g));
  push(s, length, 0, 0);
  return out;
}

function climb(profile: readonly Grade[]): number[] {
  let y = 0;
  return profile.map((g) => (y += ((g.g0 + g.g1) / 2) * (g.s1 - g.s0)));
}

function height_at(profile: readonly Grade[], climbs: readonly number[], s: number): { y: number; g: number; solid: boolean } {
  let lo = 0;
  let hi = profile.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (profile[mid].s1 <= s) lo = mid + 1;
    else hi = mid;
  }
  const p = profile[lo];
  const t = s - p.s0;
  const span = p.s1 - p.s0;
  const g = p.g0 + ((p.g1 - p.g0) * t) / span;
  const before = lo > 0 ? climbs[lo - 1] : 0;
  return { y: START_Y + before + ((p.g0 + g) / 2) * t, g, solid: p.solid };
}

export interface SkyLayout {
  pieces: PlanPiece[];
  samples: Sample[];
  length: number;
  error: number;
  profile: Grade[];
  attempt: number;
  /** Toe of every gap jump, metres along the lap. */
  toes: number[];
  zones: Zone[];
  twist: Twist;
}

/** A gap on every straight long enough for the checkpoint, run-up, jump and run-out, MAX_JUMPS at most, kept apart and off crossovers. */
function jump_toes(pieces: readonly PlanPiece[], length: number, zones: readonly Zone[]): number[] {
  const span = size_gap().span;
  const toes: number[] = [];
  let s0 = 0;
  pieces.forEach((p, i) => {
    const room = p.length - JUMP_BEFORE - span - JUMP_AFTER;
    if (p.kind === "straight" && i > 0 && i < pieces.length - 1 && room >= 0 && toes.length < MAX_JUMPS) {
      const toe = s0 + JUMP_BEFORE + room / 2;
      const a = toe - JUMP_BEFORE - ZONE_MARGIN;
      const b = toe + span + JUMP_AFTER + ZONE_MARGIN;
      const clear = zones.every((z) => (z.s1 < a || z.s0 > b) && (z.a1 < a || z.a0 > b));
      if (clear && toe > START_AHEAD + JUMP_BEFORE && toe + span < length - START_BEHIND && toes.every((t) => toe - t > JUMP_APART)) toes.push(toe);
    }
    s0 += p.length;
  });
  return toes;
}

/** Drawn for a seed whose every attempt failed; sky.test.ts proves it draws on its own. */
export const FALLBACK_SEED = 1;
const PROFILE_TRIES = 6;

function helices_of(pieces: readonly PlanPiece[]): Helix[] {
  const out: Helix[] = [];
  let s0 = 0;
  for (const p of pieces) {
    if (p.helix) out.push({ s0, s1: s0 + p.length, radius: 1 / Math.abs(p.curve) });
    s0 += p.length;
  }
  return out;
}

/** Crossovers the profile can build: few, short, off the start straights, and never inside a helix but their own. */
function zones_fit(zones: Zone[], helices: readonly Helix[], length: number): boolean {
  for (const z of zones) z.helix = helices.some((h) => z.a0 >= h.s0 - HELIX_RUN - ZONE_JOIN && z.s1 <= h.s1 + HELIX_RUN + ZONE_JOIN);
  if (zones.filter((z) => !z.helix).length > MAX_ZONES) return false;
  return zones.every((z) => {
    if (z.a0 < START_AHEAD + ZONE_JOIN || z.s1 > length - START_BEHIND - ZONE_JOIN) return false;
    if (z.helix) return true;
    if (z.s1 - z.s0 > ZONE_MAX || z.a1 - z.a0 > ZONE_MAX || z.a1 + 2 * ZONE_MARGIN > z.s0) return false;
    return helices.every((h) => z.s1 < h.s0 - HELIX_RUN - ZONE_MARGIN || z.s0 > h.s1 + HELIX_RUN + ZONE_MARGIN);
  });
}

export function sky_layout(seed: number): SkyLayout {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rng = mulberry32(sub(seed, `sky:${attempt}`));
    const pieces = draw_layout(rng);
    if (!pieces) continue;
    const { samples, length, error } = sample_layout(pieces);
    if (length < 2400 || length > 5200) continue;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const p of samples) [x0, x1, z0, z1] = [Math.min(x0, p.x), Math.max(x1, p.x), Math.min(z0, p.z), Math.max(z1, p.z)];
    if (x1 - x0 > 2 * BOUND || z1 - z0 > 2 * BOUND) continue;
    const twist = twistiness(samples.map((p) => ({ x: p.x, z: p.z, tx: Math.sin(p.h), tz: Math.cos(p.h) })));
    if (!twisty(twist)) continue;
    const pairs = close_pairs(samples, length);
    const zones = zones_of(samples, pairs);
    const helices = helices_of(pieces);
    if (!zones_fit(zones, helices, length)) continue;
    const toes = jump_toes(pieces, length, zones);
    if (!toes.length) continue;
    for (let k = 0; k < PROFILE_TRIES; k++) {
      const profile = draw_profile(mulberry32(sub(seed, `sky:profile:${attempt}:${k}`)), length, toes, helices, zones);
      if (!profile) continue;
      const climbs = climb(profile);
      const ys = samples.map((p) => height_at(profile, climbs, p.s).y);
      if (Math.min(...ys) < Y_MIN || Math.max(...ys) > Y_MAX) continue;
      if (pairs.some(([i, j]) => Math.abs(ys[i] - ys[j]) < CLEARANCE)) continue;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      for (const p of samples) {
        p.x -= cx;
        p.z -= cz;
      }
      return { pieces, samples, length, error, profile, attempt, toes, zones, twist };
    }
  }
  if (seed === FALLBACK_SEED) throw new Error(`sky_layout: fallback seed ${seed} found no track`);
  return sky_layout(FALLBACK_SEED);
}

/** Rail-free stretches on straights and wide flat arcs, clear of banks, tight bends and jumps. */
function open_sections(seed: number, samples: readonly Sample[], pieces: readonly PlanPiece[], length: number, blocked: (s: number) => boolean): OpenSection[] {
  const rng = mulberry32(sub(seed, "sky:open"));
  const fit = (p: Sample) => {
    const piece = pieces[p.piece];
    return p.bank === 0 && (piece.kind === "straight" || Math.abs(1 / piece.curve) >= OPEN_RADIUS) && !blocked(p.s);
  };
  const runs: [number, number][] = [];
  let from = -1;
  samples.forEach((p, i) => {
    const ok = fit(p) && p.s > START_AHEAD && p.s < length - START_BEHIND;
    if (ok && from < 0) from = p.s;
    if ((!ok || i === samples.length - 1) && from >= 0) {
      runs.push([from + OPEN_CLEAR, p.s - OPEN_CLEAR]);
      from = -1;
    }
  });
  const target = length * (OPEN_SHARE[0] + rng() * (OPEN_SHARE[1] - OPEN_SHARE[0]));
  const out: OpenSection[] = [];
  let total = 0;
  const order = runs.filter(([a, b]) => b - a >= OPEN_MIN).sort((x, y) => y[1] - y[0] - (x[1] - x[0]));
  for (const [a, b] of order) {
    if (total >= target) break;
    const want = Math.min(b - a, OPEN_MAX, Math.max(OPEN_MIN, target - total));
    const s0 = a + rng() * (b - a - want);
    const straight = samples.every((p) => p.s < s0 || p.s > s0 + want || pieces[p.piece].kind === "straight");
    const pick = rng();
    const side: OpenSection["side"] = straight && pick < 0.3 ? 0 : pick < 0.65 ? 1 : -1;
    out.push({ s0, s1: s0 + want, side });
    total += want;
  }
  return out.sort((x, y) => x.s0 - y.s0);
}

export function rail_open(open: readonly OpenSection[], s: number, side: number): boolean {
  return open.some((o) => s >= o.s0 && s <= o.s1 && (o.side === 0 || o.side === side));
}

/** Boost pads on straights: first at the foot of climbs, then out of the tightest bends, never in a gap's reach. */
function boost_pads(pieces: readonly PlanPiece[], profile: readonly Grade[], toes: readonly number[], length: number, samples: readonly Sample[]): { s0: number; s1: number }[] {
  const span = size_gap().span;
  const straights: { s0: number; s1: number; turn: number }[] = [];
  let s0 = 0;
  pieces.forEach((p, i) => {
    if (p.kind === "straight") straights.push({ s0, s1: s0 + p.length, turn: i > 0 ? Math.abs(turn_angle(pieces[i - 1])) : 0 });
    s0 += p.length;
  });
  const fits = (a: number) => {
    const b = a + PAD_LENGTH;
    if (!straights.some((t) => a >= t.s0 && b + PAD_RUNOUT <= t.s1) || a < START_AHEAD + PAD_EXIT || b > length - START_BEHIND) return false;
    if (toes.some((t) => ((t - b + length) % length < PAD_GAP_CLEAR) || (a > t - JUMP_BEFORE && a < t + span + JUMP_AFTER))) return false;
    return samples.every((q) => q.s < a - STEP || q.s > b + STEP || q.bank === 0) && profile.every((g) => g.s1 < a || g.s0 > b || g.solid);
  };
  const climbs = profile.filter((g) => g.solid && g.g0 === 0 && g.g1 > 0).map((g) => g.s0 - PAD_LEAD - PAD_LENGTH);
  const exits = [...straights].sort((x, y) => y.turn - x.turn).map((t) => t.s0 + PAD_EXIT);
  const pads: { s0: number; s1: number }[] = [];
  for (const a of [...climbs, ...exits]) {
    if (pads.length >= MAX_PADS) break;
    if (!fits(a) || pads.some((p) => Math.min(Math.abs(p.s0 - a), length - Math.abs(p.s0 - a)) < PAD_APART)) continue;
    pads.push({ s0: a, s1: a + PAD_LENGTH });
  }
  return pads.sort((x, y) => x.s0 - y.s0);
}

export function generate_sky(seed: number): WorldData {
  const t0 = performance.now();
  const { pieces, samples, length, profile, toes, zones } = sky_layout(seed);
  const stacked = (s: number) => zones.some((z) => (s > z.s0 - ZONE_MARGIN && s < z.s1 + ZONE_MARGIN) || (s > z.a0 - ZONE_MARGIN && s < z.a1 + ZONE_MARGIN));
  const jump = size_gap();
  const climbs = climb(profile);
  // The toe, lip and landing edge get samples of their own, so the 2 m centreline doesn't round the lip off.
  for (const key of toes.flatMap((t) => [t, t + SKY_KICKER.length - 1e-6, t + SKY_KICKER.length + jump.gap])) {
    const i = samples.findIndex((q, k) => q.s < key && (samples[k + 1]?.s ?? Infinity) > key);
    const a = samples[i];
    const b = samples[i + 1];
    const f = (key - a.s) / (b.s - a.s);
    samples.splice(i + 1, 0, { ...a, x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, s: key });
  }
  const n = samples.length;
  const line = new Float64Array(n * DECK_STRIDE);
  const road: RoadPoint[] = [];
  samples.forEach((p, i) => {
    const { y, solid } = height_at(profile, climbs, p.s);
    const past = toes.map((t) => p.s - t - SKY_KICKER.length - jump.gap).find((d) => d >= 0 && d < jump.landing + LANDING_TAPER);
    const half = past === undefined ? ROAD_HALF : past < jump.landing ? LANDING_HALF : LANDING_HALF + ((ROAD_HALF - LANDING_HALF) * (past - jump.landing)) / LANDING_TAPER;
    const tx = Math.sin(p.h);
    const tz = Math.cos(p.h);
    line.set([p.x, y, p.z, tx, tz, p.bank, half, solid ? 1 : 0, p.s], i * DECK_STRIDE);
    road.push({ x: p.x, y, z: p.z, tx, tz });
  });
  const deck_pieces: DeckPiece[] = [];
  let s0 = 0;
  for (const p of pieces) {
    deck_pieces.push({ kind: p.kind, s0, length: p.length, curve: p.curve });
    s0 += p.length;
  }

  const ramps: Ramp[] = [];
  for (const toe of toes) {
    deck_pieces.push(
      { kind: "kicker", s0: toe, length: SKY_KICKER.length, curve: 0 },
      { kind: "gap", s0: toe + SKY_KICKER.length, length: jump.gap, curve: 0 },
      { kind: "landing", s0: toe + SKY_KICKER.length + jump.gap, length: jump.landing + jump.sag, curve: 0 },
    );
    const p = road[samples.findIndex((q) => q.s >= toe)];
    ramps.push({ ...gap_ramp(), id: ramps.length, x: p.x, y: p.y, z: p.z, fx: p.tx, fz: p.tz, speed: ROAD_KICKER.speed, landing: jump.gap + jump.landing + jump.sag });
  }
  const pads = boost_pads(pieces, profile, toes, length, samples);
  for (const p of pads) deck_pieces.push({ kind: "pad", s0: p.s0, length: PAD_LENGTH, curve: 0 });
  deck_pieces.sort((a, b) => a.s0 - b.s0);
  const open = open_sections(seed, samples, pieces, length, (s) => stacked(s) || toes.some((t) => s > t - JUMP_BEFORE - OPEN_CLEAR && s < t + jump.span + JUMP_AFTER));
  const solids: Solid[] = [];
  for (let i = 0; i < n; i += 2) {
    const a = i * DECK_STRIDE;
    const b = ((i + 2) % n) * DECK_STRIDE;
    if (!line[a + 7] || !line[b + 7]) continue;
    const mx = (line[a] + line[b]) / 2;
    const mz = (line[a + 2] + line[b + 2]) / 2;
    const dx = line[b] - line[a];
    const dz = line[b + 2] - line[a + 2];
    const len = Math.hypot(dx, dz);
    const tx = dx / len;
    const tz = dz / len;
    const y = (line[a + 1] + line[b + 1]) / 2;
    const slope = Math.tan((line[a + 5] + line[b + 5]) / 2);
    const half = (line[a + 6] + line[b + 6]) / 2;
    for (const side of [-1, 1]) {
      if (rail_open(open, (line[a + 8] + line[b + 8]) / 2, side)) continue;
      const off = side * (half + RAIL_HALF);
      solids.push({ kind: "box", x: mx + tz * off, y: y + side * half * slope, z: mz - tx * off, hw: RAIL_HALF, hd: len / 2 + 0.1, cos: tz, sin: tx, height: RAIL_TOP, bottom: RAIL_BOTTOM });
    }
  }

  const gates = toes.map((t) => t - JUMP_GATE);
  const in_jump = (s: number) => toes.some((t) => s > t - JUMP_GATE - 1 && s < t + jump.span);
  const eligible = (i: number) => samples[i].bank === 0 && pieces[samples[i].piece].kind === "straight" && line[i * DECK_STRIDE + 7] === 1 && !in_jump(samples[i].s) && !stacked(samples[i].s);
  const checkpoints: Checkpoint[] = [];
  const add_checkpoint = (i: number) => {
    const p = road[i];
    checkpoints.push({ x: p.x, y: p.y, z: p.z, heading: Math.atan2(p.tx, p.tz), index: checkpoints.length });
    for (const side of [-1, 1]) {
      const off = side * (ROAD_HALF + GATE_POST);
      solids.push({ kind: "circle", x: p.x - p.tz * off, y: p.y, z: p.z + p.tx * off, radius: 0.5, height: 7 });
    }
  };
  add_checkpoint(0);
  let last = 0;
  for (let i = 1; i < n; i++) {
    const s = samples[i].s;
    if (gates.some((g) => s >= g && samples[i - 1].s < g)) {
      add_checkpoint(i);
      last = i;
      continue;
    }
    const gap = s - samples[last].s;
    if (length - s < CHECKPOINT_GAP * 0.6) break;
    if (gap >= CHECKPOINT_GAP && eligible(i) && !gates.some((g) => g > s && g - s < CHECKPOINT_GAP * 0.4)) {
      add_checkpoint(i);
      last = i;
    }
  }

  const heights = new Float32Array((N + 1) * (N + 1)).fill(ABYSS);
  const road_dist = new Float32Array((N + 1) * (N + 1));
  return {
    kind: "sky",
    deck: { half: ROAD_HALF, pieces: deck_pieces, line, pads, open },
    terrain: { seed, size: SIZE, cell: CELL, n: N, heights, road_dist, surface: new Uint8Array(heights.length) },
    graph: { nodes: [{ id: 0, x: road[0].x, z: road[0].z, y: road[0].y, kind: "junction" }], edges: [{ id: 0, a: 0, b: 0, kind: "highway", half: ROAD_HALF, closed: true, points: road }] },
    towns: [],
    lots: [],
    buildings: [],
    props: [],
    parking: [],
    trees: [],
    solids,
    ramps,
    items: [],
    challenges: [],
    checkpoints,
    circuit: [0],
    road,
    routes: [circuit_route(road, checkpoints)],
    canyon: null,
    timings: [["sky", performance.now() - t0]],
  };
}

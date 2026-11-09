import { mulberry32, sub } from "../rng";
import { flight, RIDE, ROAD_KICKER } from "./jumps";
import { CELL, DECK_STRIDE, N, ROAD_HALF, SIZE, type Checkpoint, type DeckPiece, type Ramp, type RoadPoint, type Solid, type WorldData } from "./types";

export const ABYSS = -2000;
/** How far below the deck under it a car counts as fallen off. */
export const FALL_DEPTH = 6;
const STEP = 2;
const SUBSTEPS = 8;
const ATTEMPTS = 32;
const START_Y = 270;
const Y_MIN = 140;
const Y_MAX = 400;
const BOUND = 880;
const SEPARATION = 44;
const SEPARATION_ALONG = 120;
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
const CHECKPOINT_GAP = 300;
const RAIL_BOTTOM = -0.6;
const RAIL_TOP = 1.2;
const RAIL_HALF = 0.25;
const GATE_POST = 1.7;

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
  return { kind: "arc", length: t.angle / curve + ease, curve, ease, bank: t.bank, min: 0, stretch: false };
}

function straight(length: number, min: number, stretch = true): PlanPiece {
  return { kind: "straight", length, curve: 0, ease: 0, bank: 0, min, stretch };
}

/** Turns summing to exactly one left-hand lap, the straights between them, then two straights stretched to close it. */
function draw_layout(rng: () => number): PlanPiece[] | null {
  const lefts = 5 + Math.floor(rng() * 4);
  const rights = Math.floor(rng() * 3);
  const right_angles = Array.from({ length: rights }, () => -(0.4 + rng() * 0.6));
  const total = 2 * Math.PI - right_angles.reduce((a, b) => a + b, 0);
  const weights = Array.from({ length: lefts }, () => 0.4 + rng());
  const sum = weights.reduce((a, b) => a + b, 0);
  const angles = weights.map((w) => (w / sum) * total);
  if (angles.some((a) => a < 0.35 || a > 3.4)) return null;
  for (const r of right_angles) angles.splice(1 + Math.floor(rng() * (angles.length - 1)), 0, r);
  const turns: Turn[] = angles.map((angle) => {
    const banked = Math.abs(angle) > 1 && rng() < 0.7;
    const radius = banked ? 60 + rng() * 100 : 50 + rng() * 120;
    const bank = banked ? -Math.sign(angle) * (0.26 + rng() * 0.26) : 0;
    return { angle, radius, bank };
  });
  const pieces: PlanPiece[] = [straight(START_AHEAD + rng() * 60, START_AHEAD)];
  const chicane = rng() < 0.5 ? Math.floor(rng() * turns.length) : -1;
  turns.forEach((t, i) => {
    pieces.push(arc(t));
    if (i === chicane) {
      const a = 0.45 + rng() * 0.25;
      const r = 50 + rng() * 20;
      pieces.push(straight(30 + rng() * 40, STRAIGHT_MIN, false), arc({ angle: a, radius: r, bank: 0 }), straight(12 + rng() * 10, 10, false), arc({ angle: -a, radius: r, bank: 0 }));
    }
    pieces.push(i === turns.length - 1 ? straight(START_BEHIND + rng() * 80, START_BEHIND) : straight(110 + rng() * 300, STRAIGHT_MIN));
  });
  let end: Pose = { x: 0, z: 0, h: 0 };
  for (const p of pieces) end = trace(p, end);
  const ex = end.x;
  const ez = end.z;
  const stretchy = pieces.flatMap((p, i) => (p.kind === "straight" && p.stretch ? [i] : []));
  const headings: number[] = [];
  let h = 0;
  for (const p of pieces) {
    headings.push(h);
    h += turn_angle(p);
  }
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
      if (na < pieces[i].min + 4 || nb < pieces[j].min + 4 || na > 420 || nb > 420) continue;
      pieces[i].length = na;
      pieces[j].length = nb;
      return pieces;
    }
  return null;
}

/** Slowest toe speed a gap is sized to clear, and the fastest its landing runs out. */
export const GAP_SLOW = 22;
export const GAP_FAST = 45;
/** The landing starts this far below the lip and runs down at LANDING_GRADE. */
const LANDING_DROP = 4;
export const LANDING_GRADE = -0.25;
/** Slowest touchdown lands this far onto the landing; the landing runs this far past the fastest one. */
const LANDING_SPARE = 6;
const LANDING_RUNOUT = 20;
export const KICKER_GRADE = ROAD_KICKER.rise / ROAD_KICKER.length;

export interface GapJump {
  gap: number;
  /** Straight landing at LANDING_GRADE before its sag curve back to level. */
  landing: number;
  sag: number;
  /** Run-up before the toe, then the whole span from the toe to the end of the sag. */
  span: number;
}

/** The kicker lip as a ramp at the origin heading +z, for the flight maths. */
export function gap_ramp(): Ramp {
  return { id: 0, kind: ROAD_KICKER.kind, x: 0, y: 0, z: 0, fx: 0, fz: 1, hw: ROAD_HALF, length: ROAD_KICKER.length, rise: ROAD_KICKER.rise, grade: 0, landing: 0, speed: GAP_SLOW, back: ROAD_KICKER.back, road: true, deck: true };
}

/** Metres past the lip where a car that hit the toe at `speed` comes down on the landing. */
export function touchdown(speed: number, gap: number): number {
  const r = gap_ramp();
  const lip = ROAD_KICKER.rise;
  const surface = (d: number) => lip - LANDING_DROP + Math.min(0, LANDING_GRADE * (d - gap)) + RIDE;
  let d = 0.5;
  while (d < 400 && flight(r, speed, d) > surface(d)) d += 0.25;
  return d;
}

export function size_gap(): GapJump {
  const r = gap_ramp();
  let d = 1;
  while (flight(r, GAP_SLOW, d) > ROAD_KICKER.rise - LANDING_DROP + RIDE) d += 0.25;
  const gap = Math.floor(d - LANDING_SPARE);
  const landing = touchdown(GAP_FAST, gap) + LANDING_RUNOUT - gap;
  const sag = ramp_length(LANDING_GRADE, 0);
  return { gap, landing, sag, span: ROAD_KICKER.length + gap + landing + sag };
}

/** Rounded rectangle, for a seed whose every draw failed: always closes and keeps its distance. */
function fallback_layout(): PlanPiece[] {
  const quarter = (bank: number): PlanPiece => arc({ angle: Math.PI / 2, radius: 110, bank });
  return [straight(200, START_AHEAD), quarter(-0.4), straight(400, STRAIGHT_MIN), quarter(0), straight(520, STRAIGHT_MIN), quarter(-0.4), straight(400, STRAIGHT_MIN), quarter(0), straight(320, START_BEHIND)];
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

function separated(samples: readonly Sample[], length: number): boolean {
  for (let i = 0; i < samples.length; i++)
    for (let j = i + 1; j < samples.length; j++) {
      const along = samples[j].s - samples[i].s;
      if (Math.min(along, length - along) < SEPARATION_ALONG) continue;
      if ((samples[i].x - samples[j].x) ** 2 + (samples[i].z - samples[j].z) ** 2 < SEPARATION * SEPARATION) return false;
    }
  return true;
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

function draw_profile(rng: () => number, length: number): Grade[] | null {
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
  for (;;) {
    const at = s + 20 + rng() * 140;
    const rise = y < -25 || (y < 25 && rng() < 0.45);
    const g = rise ? 0.04 + rng() * (MAX_CLIMB - 0.04) : -(0.08 + rng() * (MAX_DROP - 0.08));
    const hold = rise ? 30 + rng() * 120 : 20 + rng() * 60;
    if (at + 2 * ramp_length(0, g) + hold > end - reserve) break;
    feature(at, g, hold);
  }
  const at = s + 10;
  const room = end - 10 - at;
  const need = -y;
  if (Math.abs(need) > 1e-9) {
    const disc = room * room - 4 * VERTICAL_RADIUS * Math.abs(need);
    if (disc < 0) return null;
    const g = (Math.sign(need) * (room - Math.sqrt(disc))) / (2 * VERTICAL_RADIUS);
    if (g > MAX_CLIMB || g < -MAX_DROP) return null;
    feature(at, g, room - 2 * ramp_length(0, g));
  }
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
}

export function sky_layout(seed: number): SkyLayout {
  for (let attempt = 0; attempt <= ATTEMPTS; attempt++) {
    const rng = mulberry32(sub(seed, `sky:${attempt}`));
    const pieces = attempt < ATTEMPTS ? draw_layout(rng) : fallback_layout();
    if (!pieces) continue;
    const { samples, length, error } = sample_layout(pieces);
    if (length < 2400 || length > 5200) continue;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const p of samples) [x0, x1, z0, z1] = [Math.min(x0, p.x), Math.max(x1, p.x), Math.min(z0, p.z), Math.max(z1, p.z)];
    if (x1 - x0 > 2 * BOUND || z1 - z0 > 2 * BOUND) continue;
    if (!separated(samples, length)) continue;
    const profile = draw_profile(mulberry32(sub(seed, `sky:profile:${attempt}`)), length);
    if (!profile) continue;
    const climbs = climb(profile);
    const ys = samples.map((p) => height_at(profile, climbs, p.s).y);
    if (Math.min(...ys) < Y_MIN || Math.max(...ys) > Y_MAX) continue;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    for (const p of samples) {
      p.x -= cx;
      p.z -= cz;
    }
    return { pieces, samples, length, error, profile, attempt };
  }
  throw new Error(`sky_layout: seed ${seed} found no track`);
}

export function generate_sky(seed: number): WorldData {
  const t0 = performance.now();
  const { pieces, samples, length, profile } = sky_layout(seed);
  const climbs = climb(profile);
  const n = samples.length;
  const line = new Float64Array(n * DECK_STRIDE);
  const road: RoadPoint[] = [];
  samples.forEach((p, i) => {
    const { y, solid } = height_at(profile, climbs, p.s);
    const tx = Math.sin(p.h);
    const tz = Math.cos(p.h);
    line.set([p.x, y, p.z, tx, tz, p.bank, ROAD_HALF, solid ? 1 : 0, p.s], i * DECK_STRIDE);
    road.push({ x: p.x, y, z: p.z, tx, tz });
  });
  const deck_pieces: DeckPiece[] = [];
  let s0 = 0;
  for (const p of pieces) {
    deck_pieces.push({ kind: p.kind, s0, length: p.length, curve: p.curve });
    s0 += p.length;
  }

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
    for (const side of [-1, 1]) {
      const off = side * (ROAD_HALF + RAIL_HALF);
      solids.push({ kind: "box", x: mx + tz * off, y: y + side * ROAD_HALF * slope, z: mz - tx * off, hw: RAIL_HALF, hd: len / 2 + 0.1, cos: tz, sin: tx, height: RAIL_TOP, bottom: RAIL_BOTTOM });
    }
  }

  const eligible = (i: number) => samples[i].bank === 0 && pieces[samples[i].piece].kind === "straight" && line[i * DECK_STRIDE + 7] === 1;
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
    const gap = samples[i].s - samples[last].s;
    if (length - samples[i].s < CHECKPOINT_GAP * 0.6) break;
    if (gap >= CHECKPOINT_GAP && eligible(i)) {
      add_checkpoint(i);
      last = i;
    }
  }

  const heights = new Float32Array((N + 1) * (N + 1)).fill(ABYSS);
  const road_dist = new Float32Array((N + 1) * (N + 1));
  return {
    kind: "sky",
    deck: { half: ROAD_HALF, pieces: deck_pieces, line, pads: [] },
    terrain: { seed, size: SIZE, cell: CELL, n: N, heights, road_dist },
    graph: { nodes: [{ id: 0, x: road[0].x, z: road[0].z, y: road[0].y, kind: "junction" }], edges: [{ id: 0, a: 0, b: 0, kind: "highway", half: ROAD_HALF, closed: true, points: road }] },
    towns: [],
    lots: [],
    buildings: [],
    props: [],
    parking: [],
    trees: [],
    solids,
    ramps: [],
    items: [],
    challenges: [],
    checkpoints,
    circuit: [0],
    road,
    timings: [["sky", performance.now() - t0]],
  };
}

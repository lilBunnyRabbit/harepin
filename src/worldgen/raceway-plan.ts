import { mulberry32, sub } from "../rng";
import { cos, sin } from "../sim-math";
import { resample, type Path } from "./path";

const DEG = Math.PI / 180;
const STEP = 2;
const TRACE_STEP = 0.5;
export const ATTEMPTS = 600;
/** A seed that draws on its first attempts: the lap of any seed that runs out of them. */
export const FALLBACK_SEED = 0;
export const LAP_LENGTH = [2800, 4200] as const;
export const BOUND = 880;
/** Closest two stretches may come in plan, centre to centre: two road halves plus both stamps' shoulders. */
export const CLEARANCE = 44;
/** Stretches within this many metres of each other along the lap are neighbours, and may be closer than CLEARANCE: a hairpin's legs. */
export const NEIGHBOUR = 120;
/** Curvature eases in and out of an arc over this share of its radius, at most EASE_MAX metres and EASE_SHARE of its length. */
const EASE = 0.5;
const EASE_MAX = 40;
const EASE_SHARE = 0.8;
const ARC_MAX = 340;
const PIT_AHEAD = { draw: [260, 420], min: 250, max: 460 } as const;
const PIT_BEHIND = { draw: [150, 230], min: 150, max: 240 } as const;
const BACK = { draw: [500, 800], min: 450, max: 900 } as const;
const LINK = { draw: [60, 240], min: 40, max: 400 } as const;
const SOLVE_MIN = 0.05;
const CLOSED = 1e-6;

export const Corner = { HAIRPIN: "hairpin", SWEEPER: "sweeper", COUNTER: "counter", KINK: "kink", DOUBLE: "double", ESSES: "esses", CHICANE: "chicane" } as const;
export type Corner = (typeof Corner)[keyof typeof Corner];

/** `angle` is signed, + turns left; `radius` is the arc's tightest, held between its eased ends. */
type Piece = { kind: "straight"; length: number; min: number; max: number } | { kind: "arc"; angle: number; radius: number };

interface Turn {
  kind: Corner;
  pieces: Piece[];
}

export interface Lap {
  path: Path;
  corners: Corner[];
  length: number;
  /** The draw that made it; ATTEMPTS when the fallback seed's lap stands in. */
  attempt: number;
}

const arc = (angle: number, radius: number): Piece => ({ kind: "arc", angle, radius: Math.min(radius, ARC_MAX / Math.abs(angle)) });
const fixed = (length: number): Piece => ({ kind: "straight", length, min: length, max: length });

function turns(next: () => number, dir: number): Turn[] | null {
  const range = (lo: number, hi: number) => lo + (hi - lo) * next();
  const side = () => (next() < 0.5 ? 1 : -1);
  const out: Turn[] = [];
  let turned = 0;
  const add = (kind: Corner, pieces: Piece[]) => {
    out.push({ kind, pieces });
    for (const p of pieces) if (p.kind === "arc") turned += p.angle * dir;
  };
  const hairpins = next() < 0.3 ? 2 : 1;
  for (let k = 0; k < hairpins; k++) add(Corner.HAIRPIN, [arc(dir * range(150, 185) * DEG, range(27, 36))]);
  const counters = next() < 0.5 ? 2 : 1;
  for (let k = 0; k < counters; k++) add(Corner.COUNTER, [arc(-dir * range(40, 100) * DEG, range(50, 140))]);
  if (next() < 0.4) add(Corner.DOUBLE, [arc(dir * 70 * DEG, 90), fixed(range(20, 40)), arc(dir * 100 * DEG, 60)]);
  if (next() < 0.5) add(Corner.KINK, [arc(side() * range(15, 35) * DEG, range(250, 400))]);
  const swing = side();
  const leans = Array.from({ length: next() < 0.5 ? 3 : 5 }, (_, k) => (k % 2 ? -1 : 1) * swing * range(15, 27) * DEG);
  add(Corner.ESSES, [...leans, 0].map((lean, k) => arc(lean - (leans[k - 1] ?? 0), range(60, 110))));
  if (next() < 0.6) {
    const angle = side() * range(25, 40) * DEG;
    const radius = range(20, 35);
    add(Corner.CHICANE, [arc(angle, radius), fixed(range(10, 20)), arc(-angle, radius)]);
  }
  const rest = 2 * Math.PI - turned;
  const sweepers = Math.max(1, Math.min(4, Math.round(rest / (90 * DEG))));
  const shares = Array.from({ length: sweepers }, () => range(0.6, 1.4));
  const whole = shares.reduce((a, b) => a + b, 0);
  for (const share of shares) {
    const angle = (rest * share) / whole;
    if (angle < 40 * DEG || angle > 140 * DEG) return null;
    add(Corner.SWEEPER, [arc(dir * angle, range(120, 300))]);
  }
  return out;
}

function ordered(next: () => number, list: Turn[]): Turn[] | null {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  const last = list.findIndex((t) => t.kind === Corner.SWEEPER);
  list.push(...list.splice(last, 1));
  return list.some((t, i) => t.kind === Corner.HAIRPIN && list[i + 1]?.kind === Corner.HAIRPIN) ? null : list;
}

function draw(next: () => number): { pieces: Piece[]; corners: Corner[] } | null {
  const range = (lo: number, hi: number) => lo + (hi - lo) * next();
  const straight = (s: { draw: readonly [number, number]; min: number; max: number }): Piece => ({ kind: "straight", length: range(s.draw[0], s.draw[1]), min: s.min, max: s.max });
  const dir = next() < 0.5 ? 1 : -1;
  const list = turns(next, dir);
  const order = list && ordered(next, list);
  if (!order) return null;
  // The one heavy braking zone: the back straight ends in the first hairpin, or in a later corner when the pit straight already does.
  const hairpin = order.findIndex((t) => t.kind === Corner.HAIRPIN);
  const back = hairpin > 0 ? hairpin : 1 + Math.floor(next() * (order.length - 1));
  const pieces: Piece[] = [straight(PIT_AHEAD)];
  order.forEach((turn, i) => {
    if (i > 0) pieces.push(straight(i === back ? BACK : LINK));
    pieces.push(...turn.pieces);
  });
  pieces.push(straight(PIT_BEHIND));
  return { pieces, corners: order.map((t) => t.kind) };
}

interface Trace {
  points: Path;
  headings: number[];
  x: number;
  z: number;
}

const ease_of = (radius: number, sweep: number) => Math.min(EASE * radius, EASE_MAX, EASE_SHARE * sweep);

/**
 * Walks the pieces from the origin. An arc's curvature climbs to 1/radius over its ease, holds, and falls back; each of
 * the three runs takes a whole number of midpoint steps, so the heading it ends on is its angle exactly.
 */
function trace(pieces: readonly Piece[], heading: number): Trace {
  const points: Path = [[0, 0]];
  const headings: number[] = [];
  let x = 0;
  let z = 0;
  let h = heading;
  const run = (length: number, k0: number, k1: number) => {
    const steps = Math.max(1, Math.ceil(length / TRACE_STEP));
    const ds = length / steps;
    for (let i = 0; i < steps; i++) {
      const k = k0 + ((k1 - k0) * (i + 0.5)) / steps;
      const mid = h + (k * ds) / 2;
      x += cos(mid) * ds;
      z += sin(mid) * ds;
      h += k * ds;
      points.push([x, z]);
    }
  };
  for (const piece of pieces) {
    headings.push(h);
    if (piece.kind === "straight") {
      if (piece.length > 0) run(piece.length, 0, 0);
      continue;
    }
    const sweep = Math.abs(piece.angle) * piece.radius;
    const ease = ease_of(piece.radius, sweep);
    const k = Math.sign(piece.angle) / piece.radius;
    run(ease, 0, k);
    run(sweep - ease, k, k);
    run(ease, k, 0);
  }
  return { points, headings, x, z };
}

/**
 * Stretches the straights so the lap ends where it started: the least change that closes it, and a straight pushed past
 * its limits stays on the limit while the others take up what is left. False when they cannot.
 */
function close(pieces: Piece[], headings: readonly number[], miss_x: number, miss_z: number): boolean {
  const free = pieces.flatMap((p, i) => (p.kind === "straight" && p.max > p.min ? [{ p, dx: cos(headings[i]), dz: sin(headings[i]) }] : []));
  let rx = -miss_x;
  let rz = -miss_z;
  while (free.length >= 2) {
    let xx = 0;
    let xz = 0;
    let zz = 0;
    for (const f of free) {
      xx += f.dx * f.dx;
      xz += f.dx * f.dz;
      zz += f.dz * f.dz;
    }
    const det = xx * zz - xz * xz;
    if (det < SOLVE_MIN) return false;
    const lx = (zz * rx - xz * rz) / det;
    const lz = (xx * rz - xz * rx) / det;
    const over = free.filter((f) => {
      const length = f.p.length + f.dx * lx + f.dz * lz;
      return length < f.p.min || length > f.p.max;
    });
    if (!over.length) {
      for (const f of free) f.p.length += f.dx * lx + f.dz * lz;
      return true;
    }
    for (const f of over) {
      const length = Math.max(f.p.min, Math.min(f.p.max, f.p.length + f.dx * lx + f.dz * lz));
      rx -= (length - f.p.length) * f.dx;
      rz -= (length - f.p.length) * f.dz;
      f.p.length = length;
      free.splice(free.indexOf(f), 1);
    }
  }
  return false;
}

export function crowded(path: Path): boolean {
  const n = path.length;
  const apart = Math.ceil(NEIGHBOUR / STEP);
  const cells = new Map<number, number[]>();
  const key = (x: number, z: number) => Math.floor(x / CLEARANCE) * 4096 + Math.floor(z / CLEARANCE);
  path.forEach(([x, z], i) => {
    const k = key(x, z);
    const cell = cells.get(k);
    if (cell) cell.push(i);
    else cells.set(k, [i]);
  });
  for (let i = 0; i < n; i++) {
    const [x, z] = path[i];
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        for (const j of cells.get(key(x + dx * CLEARANCE, z + dz * CLEARANCE)) ?? []) {
          if (j <= i || Math.min(j - i, n - j + i) < apart) continue;
          const ox = path[j][0] - x;
          const oz = path[j][1] - z;
          if (ox * ox + oz * oz < CLEARANCE * CLEARANCE) return true;
        }
  }
  return false;
}

function attempt(seed: number, k: number): Omit<Lap, "attempt"> | null {
  const next = mulberry32(sub(seed, `raceway:${k}`));
  const heading = next() * 2 * Math.PI;
  const drawn = draw(next);
  if (!drawn) return null;
  const { pieces, corners } = drawn;
  const first = trace(pieces, heading);
  if (!close(pieces, first.headings, first.x, first.z)) return null;
  const length = pieces.reduce((sum, p) => sum + (p.kind === "straight" ? p.length : Math.abs(p.angle) * p.radius + ease_of(p.radius, Math.abs(p.angle) * p.radius)), 0);
  if (length < LAP_LENGTH[0] || length > LAP_LENGTH[1]) return null;
  const closed = trace(pieces, heading);
  if (Math.abs(closed.x) > CLOSED || Math.abs(closed.z) > CLOSED) return null;
  const dense = closed.points.slice(0, -1);
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [x, z] of dense) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  if (x1 - x0 > 2 * BOUND || z1 - z0 > 2 * BOUND) return null;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const path = resample(dense.map(([x, z]): [number, number] => [x - cx, z - cz]), STEP, true);
  return crowded(path) ? null : { path, corners, length };
}

export function raceway_lap(seed: number): Lap {
  for (let k = 0; k < ATTEMPTS; k++) {
    const lap = attempt(seed, k);
    if (lap) return { ...lap, attempt: k };
  }
  if (seed === FALLBACK_SEED) throw new Error("raceway: the fallback seed drew no lap");
  return { ...raceway_lap(FALLBACK_SEED), attempt: ATTEMPTS };
}

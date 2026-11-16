import type { RoadPoint } from "../../src/worldgen/types";
import { SPIN, type Trace } from "./drive";

export interface Sample {
  t: number;
  rp: number;
  x: number;
  z: number;
  v: number;
  throttle: number;
  brake: number;
  steer: number;
  slip: number;
}

export interface TracedTrial {
  pack: string;
  rev: number;
  id: string;
  car: string;
  hash: string;
  map: string;
  route: string;
  status: string;
  /** The aids the trial ran on, as the `#trial` line names them (`assist`: `on`). */
  aids: Record<string, string>;
  points: number;
  full: boolean;
  samples: Sample[];
  resets: number[];
}

/** Why a lap is not clean; every one but `rewind` also spoils the route points it happened on. */
export const Flaw = { OFF: "off", SPIN: "spin", RESET: "reset", REWIND: "rewind", GAP: "gap" } as const;
export type Flaw = (typeof Flaw)[keyof typeof Flaw];
const FLAWS: readonly Flaw[] = Object.values(Flaw);

export interface OwnerLap {
  /** 0 is the standing lap from the route's first point. */
  lap: number;
  start: number;
  /** s, with the time each rewind threw away taken out again (to about one sample). */
  t: number;
  clean: boolean;
  flaws: Flaw[];
  /** Per route point, as `drive.ts` records the AI's lap: the last pass over it, so a rewound stretch reads as its retry. */
  trace: Trace;
  /** Metres off the route's centre along its right normal (tz, -tx), per route point. */
  offset: number[];
  /** Per route point, the flaw that makes its numbers no reference; null where they are one. */
  spoilt: (Flaw | null)[];
}

/** Route points a lap may skip in a row: a sample a point is the rule, a few at 60 m/s are not. */
const MAX_SKIP = 6;
/** A placement's ` r` time has 3 decimals and a sample's 2: the sample after it can read this much earlier. */
const T_HALF = 0.005;
/** A move with no placement farther than the two samples' speeds carry, with rounding and slack, is a rewind. */
const T_ROUND = 0.02;
const SLACK = 1.2;
const JUMP_M = 5;

function fail(line: number, why: string): never {
  throw new Error(`export line ${line + 1}: ${why}`);
}

/** Every trial with a trace in one or more pasted Copy blocks; the rest of a block is skipped. */
export function read_export(text: string): TracedTrial[] {
  const out: TracedTrial[] = [];
  let pack = "";
  let rev = 0;
  let trial: TracedTrial | null = null;
  text.split(/\r?\n/).forEach((raw, k) => {
    const line = raw.replace(/^>\s?/, "");
    const word = line.trimStart().split(/\s+/);
    if (line.startsWith("#lab ")) {
      pack = word[1];
      rev = Number(word[2].slice(1));
      trial = null;
    } else if (line.startsWith("#trial ")) {
      const place = word.find((w) => /^[^/#]+\/[^/]+$/.test(w) && !w.startsWith("spec#"));
      const hash = word.find((w) => w.startsWith("spec#"))?.slice(5) ?? fail(k, "no spec#");
      const [map, route] = place?.split("/") ?? fail(k, "no <map>/<route>");
      const status = word.find((w) => ["done", "stopped", "running", "skipped"].includes(w)) ?? fail(k, "no status");
      const aids = Object.fromEntries(word.slice(word.indexOf(status) + 1).flatMap((w) => (w.includes("=") ? [w.split("=", 2)] : [])));
      trial = { pack, rev, id: word[1], car: word[2], hash, map, route, status, aids, points: 0, full: false, samples: [], resets: [] };
    } else if (line.startsWith(" trace ")) {
      if (!trial) fail(k, "trace outside a trial");
      trial.points = Number(word[2]);
      trial.full = word[3] === "full";
      if (!(trial.points > 0)) fail(k, "no route point count");
      out.push(trial);
    } else if (line.startsWith(" s ")) {
      const v = word.slice(1).map(Number);
      if (!trial?.points || v.length !== 9 || v.some((x) => !Number.isFinite(x))) fail(k, "not a sample of 9 numbers");
      const [t, rp, x, z, speed, throttle, brake, steer, slip] = v;
      if (!Number.isInteger(rp) || rp < 0 || rp >= trial.points) fail(k, `route point ${rp} outside 0-${trial.points - 1}`);
      trial.samples.push({ t, rp, x, z, v: speed, throttle, brake, steer, slip });
    } else if (line.startsWith(" r ")) {
      if (!trial?.points) fail(k, "reset outside a trace");
      trial.resets.push(Number(word[1]));
    }
  });
  return out;
}

interface Timeline {
  progress: number[];
  placed: boolean[];
  landed: boolean[];
  t: number[];
}

/**
 * A rewind leaves no ` r`: the recorder does not step while it runs, so the next sample lands where the car was seconds
 * ago, farther than its speed carries it (and the trace searches the whole route for it, as after a placement). The
 * time it threw away is the time since the car was last there.
 */
function timeline(trial: TracedTrial, n: number): Timeline {
  const { samples, resets } = trial;
  const progress: number[] = [];
  const placed: boolean[] = [];
  let wraps = 0;
  let r = 0;
  samples.forEach((s, k) => {
    const was = k === 0 ? 0 : progress[k - 1];
    const now = r < resets.length && resets[r] <= s.t + T_HALF;
    while (r < resets.length && resets[r] <= s.t + T_HALF) r++;
    if (now) wraps = Math.round((was - s.rp) / n);
    else if (k > 0 && s.rp < samples[k - 1].rp - n / 2) wraps++;
    else if (k > 0 && s.rp > samples[k - 1].rp + n / 2) wraps--;
    placed.push(now);
    progress.push(wraps * n + s.rp);
  });
  const landed: boolean[] = samples.map(() => false);
  const t: number[] = [];
  let shift = 0;
  samples.forEach((s, k) => {
    const a = samples[k - 1];
    const jumped = a && !placed[k] && Math.hypot(s.x - a.x, s.z - a.z) > Math.max(a.v, s.v) * (s.t - a.t + T_ROUND) * SLACK + JUMP_M;
    if (jumped && progress[k] < progress[k - 1]) {
      landed[k] = true;
      let m = k - 1;
      while (m > 0 && progress[m] > progress[k]) m--;
      shift = s.t - t[m];
    }
    t.push(s.t - shift);
  });
  return { progress, placed, landed, t };
}

const empty = (n: number): Trace => ({ t: Array(n).fill(NaN), speed: Array(n).fill(NaN), throttle: Array(n).fill(NaN), brake: Array(n).fill(NaN), steer: Array(n).fill(NaN), slide: Array(n).fill(NaN) });
const KEYS = ["t", "speed", "throttle", "brake", "steer", "slide"] as const;

/**
 * The trace cut into laps at each pass of the route's start, as the game counts them (the last pass when a rewind took
 * the first back), resampled to one value per route point from the last pass over it, a skipped point filled from the
 * one after. An off, a slide past the AI's spin line, a placement or a hole spoils the points it happened on and makes
 * the lap not clean; a rewind replaces the stretch it took back, offs and all.
 */
export function owner_laps(trial: TracedTrial, road: readonly RoadPoint[], off: (x: number, z: number) => boolean): OwnerLap[] {
  const n = road.length;
  if (n !== trial.points) throw new Error(`trace taken on ${trial.points} route points, the route has ${n}: another world or route`);
  const { samples } = trial;
  const { progress, placed, landed, t } = timeline(trial, n);
  const first: number[] = [0];
  let best = -Infinity;
  progress.forEach((p, k) => {
    if (p > best && p >= first.length * n) first.push(k);
    best = Math.max(best, p);
  });
  const starts = first.map((f, lap) => {
    let at = f;
    for (let k = f + 1, was = progress[f]; lap > 0 && k < (first[lap + 1] ?? samples.length); k++) {
      if (was < lap * n && progress[k] >= lap * n) at = k;
      was = progress[k];
    }
    return at;
  });
  const laps: OwnerLap[] = [];
  for (let lap = 0; lap + 1 < starts.length; lap++) {
    const [a, b] = [starts[lap], starts[lap + 1]];
    const trace = empty(n);
    const offset: number[] = Array(n).fill(NaN);
    const spoilt: (Flaw | null)[] = Array(n).fill(null);
    let rewound = false;
    let reach = -1;
    const at = (k: number) => Math.min(n - 1, Math.max(0, progress[k] - lap * n));
    for (let k = a; k < b; k++) {
      const s = samples[k];
      const i = progress[k] - lap * n;
      if (i < 0 || i >= n) continue;
      if (landed[k]) {
        rewound = true;
        spoilt.fill(null, i, reach + 1);
      }
      const flaw = off(s.x, s.z) ? Flaw.OFF : s.slip > SPIN ? Flaw.SPIN : null;
      if (flaw) spoilt[i] = flaw;
      if (i === reach) continue;
      for (let j = i + 1; j <= reach; j++) {
        for (const key of KEYS) trace[key][j] = NaN;
        offset[j] = NaN;
      }
      reach = i;
      trace.t[i] = t[k] - t[a];
      trace.speed[i] = s.v;
      trace.throttle[i] = s.throttle;
      trace.brake[i] = s.brake;
      trace.steer[i] = s.steer;
      trace.slide[i] = s.slip;
      const p = road[i];
      offset[i] = (s.x - p.x) * p.tz - (s.z - p.z) * p.tx;
    }
    for (let k = a + 1; k < b; k++) if (placed[k]) spoilt.fill(Flaw.RESET, Math.min(at(k - 1), at(k)), Math.max(at(k - 1), at(k)) + 1);
    let skip = 0;
    for (let i = n - 1, next = -1; i >= -1; i--) {
      if (i < 0 || !Number.isNaN(trace.t[i])) {
        if (skip > MAX_SKIP) spoilt.fill(Flaw.GAP, i + 1, i + 1 + skip);
        next = i;
        skip = 0;
        continue;
      }
      skip++;
      if (next < 0) continue;
      for (const key of KEYS) trace[key][i] = trace[key][next];
      offset[i] = offset[next];
    }
    const flaws = FLAWS.filter((f) => (f === Flaw.REWIND ? rewound : spoilt.includes(f)));
    laps.push({ lap, start: samples[a].t, t: t[b] - t[a], clean: !flaws.length, flaws, trace, offset, spoilt });
  }
  return laps;
}

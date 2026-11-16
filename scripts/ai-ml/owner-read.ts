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

export interface OwnerLap {
  /** 0 is the standing lap from the route's first point. */
  lap: number;
  start: number;
  t: number;
  clean: boolean;
  why: "" | "reset" | "off" | "spin" | "gap";
  /** Per route point, as `drive.ts` records the AI's lap. */
  trace: Trace;
  /** Metres off the route's centre along its right normal (tz, -tx), per route point. */
  offset: number[];
}

/** Route points a clean lap may skip in a row: a sample a point is the rule, a few at 60 m/s are not. */
const MAX_SKIP = 6;

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

const empty = (n: number): Trace => ({ t: Array(n).fill(NaN), speed: Array(n).fill(NaN), throttle: Array(n).fill(NaN), brake: Array(n).fill(NaN), steer: Array(n).fill(NaN), slide: Array(n).fill(NaN) });

/**
 * The trace cut into laps at each first pass of the route's start, as the game counts them, each judged clean (no
 * placement, never `off` the road, no slide past the AI's spin line, no hole in the trace) and resampled to one value
 * per route point: the first sample there, a skipped point filled from the one after.
 */
export function owner_laps(trial: TracedTrial, road: readonly RoadPoint[], off: (x: number, z: number) => boolean): OwnerLap[] {
  const n = road.length;
  if (n !== trial.points) throw new Error(`trace taken on ${trial.points} route points, the route has ${n}: another world or route`);
  const { samples, resets } = trial;
  const progress: number[] = [];
  let wraps = 0;
  let r = 0;
  samples.forEach((s, k) => {
    const was = k === 0 ? 0 : progress[k - 1];
    const placed = r < resets.length && resets[r] <= s.t;
    while (r < resets.length && resets[r] <= s.t) r++;
    if (placed) wraps = Math.round((was - s.rp) / n);
    else if (k > 0 && s.rp < samples[k - 1].rp - n / 2) wraps++;
    else if (k > 0 && s.rp > samples[k - 1].rp + n / 2) wraps--;
    progress.push(wraps * n + s.rp);
  });
  // A lap starts at the sample that first gets past lap * n: a rewind back over the line never starts one twice.
  const starts: number[] = [0];
  let best = -Infinity;
  progress.forEach((p, k) => {
    if (p > best && p >= starts.length * n) starts.push(k);
    best = Math.max(best, p);
  });
  const laps: OwnerLap[] = [];
  for (let lap = 0; lap + 1 < starts.length; lap++) {
    const [a, b] = [starts[lap], starts[lap + 1]];
    const t0 = samples[a].t;
    const trace = empty(n);
    const offset: number[] = Array(n).fill(NaN);
    let why: OwnerLap["why"] = resets.some((t) => t > t0 && t <= samples[b].t) ? "reset" : "";
    for (let k = a; k < b; k++) {
      const s = samples[k];
      const i = progress[k] - lap * n;
      if (!why && off(s.x, s.z)) why = "off";
      if (!why && s.slip > SPIN) why = "spin";
      if (i < 0 || i >= n || !Number.isNaN(trace.t[i])) continue;
      trace.t[i] = s.t - t0;
      trace.speed[i] = s.v;
      trace.throttle[i] = s.throttle;
      trace.brake[i] = s.brake;
      trace.steer[i] = s.steer;
      trace.slide[i] = s.slip;
      const p = road[i];
      offset[i] = (s.x - p.x) * p.tz - (s.z - p.z) * p.tx;
    }
    let skip = 0;
    for (let i = n - 1, next = -1; i >= 0; i--) {
      if (!Number.isNaN(trace.t[i])) {
        next = i;
        skip = 0;
        continue;
      }
      if (++skip > MAX_SKIP && !why) why = "gap";
      if (next < 0) continue;
      for (const key of ["t", "speed", "throttle", "brake", "steer", "slide"] as const) trace[key][i] = trace[key][next];
      offset[i] = offset[next];
    }
    laps.push({ lap, start: t0, t: samples[b].t - t0, clean: !why, why, trace, offset });
  }
  return laps;
}

import { answers_key } from "./answers";
import type { TrialResult } from "./lab";
import type { Pack, Resolved } from "./pack";
import { MAX_LAPS, type Metrics } from "./recorder";

export const results_key = (pack: Pack) => `${answers_key(pack)}.results`;

/** Typed against `Metrics`, so a new metric the reader misses fails to compile. */
const FIELDS: Record<keyof Metrics, true> = {
  time: true,
  laps: true,
  segment: true,
  lat_peak: true,
  lat_mean: true,
  ring_kmh: true,
  slip_peak: true,
  slip_mean: true,
  held: true,
  chain: true,
  spins: true,
  yaw_lag: true,
  recovery: true,
  to_100: true,
  stop_m: true,
  stop_from: true,
  top_kmh: true,
  wheelspin: true,
  spin_peak: true,
  air: true,
  landing: true,
  bounces: true,
  offs: true,
  resets: true,
  lock: true,
  throttle: true,
  handbrake: true,
  reversals: true,
};

interface Stored {
  /** The spec hash the numbers were driven on: a deploy that moved the car drops them. */
  hash: string;
  status: "done" | "stopped";
  metrics: Metrics;
}

/** Finished and stopped trials by id; JSON writes a never-measured NaN as null. */
export function results_json(trials: readonly Resolved[], results: readonly TrialResult[]): string {
  const out: Record<string, Stored> = {};
  trials.forEach((r, i) => {
    const { status, metrics } = results[i];
    if (metrics && (status === "done" || status === "stopped")) out[r.trial.id] = { hash: r.hash, status, metrics };
  });
  return JSON.stringify(out);
}

function metrics_of(raw: unknown): Metrics | null {
  if (typeof raw !== "object" || raw === null) return null;
  const given = raw as Record<string, unknown>;
  const laps = given.laps;
  if (!Array.isArray(laps) || laps.length > MAX_LAPS || !laps.every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  const out: Record<string, number | number[]> = { laps: laps as number[] };
  for (const key of Object.keys(FIELDS)) {
    if (key === "laps") continue;
    const v = given[key];
    if (v === null) out[key] = NaN;
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else return null;
  }
  return out as unknown as Metrics;
}

/** Stored numbers are untrusted: a trial keeps them only when its id, spec hash, status and every metric check out. */
export function read_results(trials: readonly Resolved[], raw: unknown): TrialResult[] {
  const given = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return trials.map((r): TrialResult => {
    const row = given[r.trial.id];
    if (typeof row !== "object" || row === null) return { status: "new", metrics: null };
    const { hash, status, metrics } = row as Record<string, unknown>;
    const checked = metrics_of(metrics);
    if (hash !== r.hash || (status !== "done" && status !== "stopped") || !checked) return { status: "new", metrics: null };
    return { status, metrics: checked };
  });
}

import { WorldKind } from "../worldgen/types";
import { world_key } from "../worldgen/kinds/kinds";

export const MAX_STARS = 3;
export const SILVER_SHARE = 1.25;

export interface StarRun {
  stars: number;
  /** Run time in ms, penalties included. */
  ms: number;
  /** Points, for modes that rank by score instead of time; higher wins. */
  score?: number;
}

export type Runs = Record<string, StarRun>;

export interface Recorded {
  runs: Runs;
  improved: boolean;
  first: boolean;
}

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function stars_for(ms: number, par: number): number {
  if (ms <= par) return 3;
  return ms <= par * SILVER_SHARE ? 2 : 1;
}

export function better(a: StarRun | undefined, b: StarRun): boolean {
  if (!a) return true;
  if (b.stars !== a.stars) return b.stars > a.stars;
  if (a.score !== undefined && b.score !== undefined && a.score !== b.score) return b.score > a.score;
  return b.ms < a.ms;
}

export function unlocked(runs: Readonly<Runs>, ids: readonly string[]): number {
  let open = Math.min(1, ids.length);
  while (open < ids.length && runs[ids[open - 1]]) open++;
  return open;
}

export function total_stars(runs: Readonly<Runs>, ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + (runs[id]?.stars ?? 0), 0);
}

export function record(runs: Readonly<Runs>, id: string, run: StarRun): Recorded {
  const old = runs[id];
  // A starless run is no finish: it sets no best and opens nothing.
  const improved = run.stars >= 1 && better(old, run);
  return { runs: improved ? { ...runs, [id]: run } : { ...runs }, improved, first: !old };
}

const is_run = (value: unknown): value is StarRun => {
  if (!value || typeof value !== "object") return false;
  const { stars, ms, score } = value as Record<string, unknown>;
  if (score !== undefined && !(typeof score === "number" && Number.isFinite(score) && score >= 0)) return false;
  return Number.isInteger(stars) && (stars as number) >= 1 && (stars as number) <= MAX_STARS && typeof ms === "number" && Number.isFinite(ms) && ms > 0;
};

/** A save from storage: anything malformed counts as not played, entry by entry, never an error. */
export function parse_runs(raw: unknown): Runs {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const runs: Runs = {};
  for (const [id, run] of Object.entries(raw)) if (is_run(run)) runs[id] = run.score === undefined ? { stars: run.stars, ms: run.ms } : { stars: run.stars, ms: run.ms, score: run.score };
  return runs;
}

export function read_json(store: Store | null, key: string): unknown {
  let text: string | null = null;
  try {
    text = store?.getItem(key) ?? null;
  } catch (error) {
    console.warn(`storage unavailable, ${key} not loaded`, error);
    return null;
  }
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn(`corrupt ${key} ignored`, error);
    return null;
  }
}

export function write_json(store: Store | null, key: string, value: unknown) {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`storage unavailable, ${key} not saved`, error);
  }
}

export function local_store(): Store | null {
  try {
    return localStorage;
  } catch (error) {
    console.warn("localStorage unavailable, progress stays in memory", error);
    return null;
  }
}

export class Track {
  private runs_: Runs;
  private readonly key: string;

  constructor(
    mode: string,
    seed: number,
    readonly ids: readonly string[],
    private readonly store: Store | null,
    kind: WorldKind = WorldKind.ISLAND,
    levels: readonly number[] = [],
  ) {
    this.key = `harepin:${mode}:${world_key(seed, kind, levels)}`;
    this.runs_ = parse_runs(read_json(store, this.key));
  }

  get runs(): Readonly<Runs> {
    return this.runs_;
  }

  get open(): number {
    return unlocked(this.runs_, this.ids);
  }

  get stars(): number {
    return total_stars(this.runs_, this.ids);
  }

  is_open(id: string): boolean {
    const index = this.ids.indexOf(id);
    return index >= 0 && index < this.open;
  }

  record(id: string, run: StarRun): Recorded {
    const result = record(this.runs_, id, run);
    if (result.improved) {
      this.runs_ = result.runs;
      write_json(this.store, this.key, this.runs_);
    }
    return result;
  }
}

export interface RaceRecord {
  best: Record<string, number>;
  podiums: number;
  wins: number;
}

const PODIUM = 3;
// Below this many racers third place is automatic, so a podium needs a full field.
const PODIUM_FIELD = 4;

export interface Placing {
  win: boolean;
  podium: boolean;
}

/** `place` 1-based; `racers` includes you. A win needs at least one rival. */
export function placing(place: number, racers: number): Placing {
  return { win: place === 1 && racers >= 2, podium: place >= 1 && place <= PODIUM && racers >= PODIUM_FIELD };
}

export function parse_race_record(raw: unknown): RaceRecord {
  const record: RaceRecord = { best: {}, podiums: 0, wins: 0 };
  if (!raw || typeof raw !== "object") return record;
  const { best, podiums, wins } = raw as Record<string, unknown>;
  if (Number.isInteger(podiums) && (podiums as number) > 0) record.podiums = podiums as number;
  if (Number.isInteger(wins) && (wins as number) > 0) record.wins = wins as number;
  if (best && typeof best === "object" && !Array.isArray(best))
    for (const [laps, ms] of Object.entries(best)) if (/^\d{1,2}$/.test(laps) && typeof ms === "number" && Number.isFinite(ms) && ms > 0) record.best[laps] = ms;
  return record;
}

/** `laps` null counts the placing only: bests are kept per lap count of the circuit, not per route. */
export function add_race(record: RaceRecord, laps: number | null, ms: number, { win, podium }: Placing): { record: RaceRecord; improved: boolean } {
  const improved = laps !== null && (record.best[laps] === undefined || ms < record.best[laps]);
  return {
    record: { best: improved ? { ...record.best, [laps]: ms } : record.best, podiums: record.podiums + (podium ? 1 : 0), wins: record.wins + (win ? 1 : 0) },
    improved,
  };
}

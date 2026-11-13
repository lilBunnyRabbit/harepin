import { Track, read_json, write_json, type Store } from "../modes/track";
import type { WorldKind } from "../worldgen/types";
import { Difficulty, RunSource, season_of, utc_date, type RunPick } from "./runs";

export const RUNS_KEY = "harepin:runs";
/** Season stars a day from endless and built runs, against farming; the daily's own stars come on top. */
export const FREE_CAP = 10;

interface RunsSave {
  season: string;
  stars: number;
  /** Daily stars by UTC date, this season. */
  days: Record<string, number>;
  /** Season stars from endless and built runs by UTC date, today's held to `FREE_CAP`. */
  free: Record<string, number>;
}

const counts = (raw: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [date, value] of Object.entries(raw)) if (Number.isInteger(value) && (value as number) > 0) out[date] = value as number;
  return out;
};

export function parse_runs_save(raw: unknown, season: string): RunsSave {
  const fresh = { season, stars: 0, days: {}, free: {} };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fresh;
  const save = raw as Record<string, unknown>;
  // A new season starts from nothing; the old one's dates can't count toward it.
  if (save.season !== season) return fresh;
  const stars = Number.isInteger(save.stars) && (save.stars as number) > 0 ? (save.stars as number) : 0;
  return { season, stars, days: counts(save.days), free: counts(save.free) };
}

export interface RunGain {
  /** Season stars this finish added. */
  gain: number;
  /** The daily cap held some back. */
  capped: boolean;
}

export class Runs {
  private save: RunsSave;
  version = 0;

  constructor(
    private readonly store: Store | null,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.save = parse_runs_save(read_json(store, RUNS_KEY), season_of(this.today));
  }

  get today(): string {
    return utc_date(this.now());
  }

  private get current(): RunsSave {
    const season = season_of(this.today);
    if (this.save.season !== season) this.save = parse_runs_save(null, season);
    return this.save;
  }

  get season(): string {
    return this.current.season;
  }

  get stars(): number {
    return this.current.stars;
  }

  daily(date: string): number {
    return this.current.days[date] ?? 0;
  }

  get free_left(): number {
    return Math.max(0, FREE_CAP - (this.current.free[this.today] ?? 0));
  }

  /**
   * A daily started on its own date earns up to its stars once, by that date even when it ends past midnight; anything
   * else, an old daily included, draws on today's free cap. `started`: the UTC date the run began.
   */
  record(pick: RunPick, stars: number, started = this.today): RunGain {
    const save = this.current;
    const today = this.today;
    let gain: number;
    let capped = false;
    if (pick.source === RunSource.DAILY && pick.date === started) {
      const day = pick.date;
      gain = Math.max(0, stars - (save.days[day] ?? 0));
      if (gain) save.days = { ...save.days, [day]: stars };
    } else {
      gain = Math.min(stars, this.free_left);
      capped = gain < stars;
      if (gain) save.free = { [today]: (save.free[today] ?? 0) + gain };
    }
    if (!gain) return { gain, capped };
    save.stars += gain;
    this.version++;
    write_json(this.store, RUNS_KEY, save);
    return { gain, capped };
  }
}

/** A run's best times: per date for a daily, `harepin:run:<date>:<world_key>`; else per map, lap count and difficulty, `harepin:run[:l<laps>][:<difficulty>]:<world_key>`. */
export function run_track(pick: RunPick, level: string, store: Store | null, seed: number, kind: WorldKind, levels: readonly number[]): Track {
  const laps = pick.laps > 1 ? `:l${pick.laps}` : "";
  const difficulty = pick.difficulty === Difficulty.NORMAL ? "" : `:${pick.difficulty}`;
  const scope = pick.date ? `run:${pick.date}` : `run${laps}${difficulty}`;
  return new Track(scope, seed, [level], store, kind, levels);
}

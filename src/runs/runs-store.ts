import { CUP_RECORD } from "../modes/championship";
import { Track, read_json, write_json, type Store } from "../modes/track";
import { clean_daily, type DailyTime } from "../net/daily";
import { NAME_LENGTH } from "../net/room-name";
import type { WorldKind } from "../worldgen/types";
import { daily_order, key_date, type BoardEntry } from "./daily-board";
import { Difficulty, RunSource, iso_week, season_of, utc_date, type Resolved, type RunPick } from "./runs";
import { clean_tint, clean_title, reached, type NameTag } from "./season";

export const RUNS_KEY = "harepin:runs";
/** Season stars a day from endless and built runs, against farming; the daily's own stars come on top. */
export const FREE_CAP = 10;

interface RunsSave {
  season: string;
  stars: number;
  /** Daily stars by UTC date, this season. */
  days: Record<string, number>;
  /** Weekly championship stars (0-5) by ISO week, this season. */
  weeks: Record<string, number>;
  /** Season stars from endless and built runs by UTC date, today's held to `FREE_CAP`. */
  free: Record<string, number>;
}

const counts = (raw: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [date, value] of Object.entries(raw)) if (Number.isInteger(value) && (value as number) > 0) out[date] = value as number;
  return out;
};

/** Kept past the season, beside its fields in the save: the rewards reached, the tag worn, today's daily board. */
interface RunsKeep {
  /** Reward codes (`season.ts`). */
  owned: string[];
  wear: NameTag;
  board: DailyBoard;
}

interface DailyBoard {
  date: string;
  own: DailyTime | null;
  seen: BoardEntry[];
}

// Against a flood of names in a busy room.
export const SEEN_MAX = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const name_fits = (name: string) => name.length > 0 && [...name].length <= NAME_LENGTH;

const real_season = (raw: unknown): raw is string => typeof raw === "string" && DATE.test(raw) && !Number.isNaN(Date.parse(raw)) && season_of(raw) === raw;

function parse_board(raw: unknown, today: string): DailyBoard {
  const board: DailyBoard = { date: today, own: null, seen: [] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return board;
  const { date, own, seen } = raw as Record<string, unknown>;
  if (date !== today) return board;
  const mine = clean_daily(own);
  if (mine && key_date(mine.k) === today) board.own = mine;
  if (Array.isArray(seen))
    for (const entry of seen.slice(0, SEEN_MAX)) {
      const time = clean_daily(entry);
      const name = (entry as Record<string, unknown> | null)?.name;
      if (time && key_date(time.k) === today && typeof name === "string" && name_fits(name)) board.seen.push({ name, ...time });
    }
  return board;
}

export function parse_runs_keep(raw: unknown, today: string): RunsKeep {
  const save = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const owned = Array.isArray(save.owned) ? save.owned.filter((code): code is string => clean_tint(code) !== null || clean_title(code) !== null) : [];
  const worn = save.wear && typeof save.wear === "object" ? (save.wear as Record<string, unknown>) : {};
  const wear: NameTag = {};
  const title = clean_title(worn.title);
  const tint = clean_tint(worn.tint);
  if (title) wear.title = title;
  if (tint) wear.tint = tint;
  return { owned: [...new Set(owned)], wear, board: parse_board(save.board, today) };
}

export function parse_runs_save(raw: unknown, season: string): RunsSave {
  const fresh = { season, stars: 0, days: {}, weeks: {}, free: {} };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fresh;
  const save = raw as Record<string, unknown>;
  // A new season starts from nothing; the old one's dates can't count toward it.
  if (save.season !== season) return fresh;
  const stars = Number.isInteger(save.stars) && (save.stars as number) > 0 ? (save.stars as number) : 0;
  return { season, stars, days: counts(save.days), weeks: counts(save.weeks), free: counts(save.free) };
}

const season_in = (raw: unknown): string | null => {
  const season = raw && typeof raw === "object" ? (raw as Record<string, unknown>).season : null;
  return real_season(season) ? season : null;
};

const most = (a: Record<string, number>, b: Record<string, number>): Record<string, number> => {
  const out = { ...a };
  for (const [key, value] of Object.entries(b)) out[key] = Math.max(out[key] ?? 0, value);
  return out;
};

function merge_season(kept: unknown, other: unknown): { save: RunsSave | null; folded: string[] } {
  const a = season_in(kept);
  const b = season_in(other);
  if (a === null && b === null) return { save: null, folded: [] };
  if (b === null || (a !== null && a > b)) return { save: parse_runs_save(kept, a as string), folded: b === null ? [] : reached(parse_runs_save(other, b).stars, b) };
  if (a === null || b > a) return { save: parse_runs_save(other, b), folded: a === null ? [] : reached(parse_runs_save(kept, a).stars, a) };
  const x = parse_runs_save(kept, a);
  const y = parse_runs_save(other, b);
  return { save: { season: a, stars: Math.max(x.stars, y.stars), days: most(x.days, y.days), weeks: most(x.weeks, y.weeks), free: most(x.free, y.free) }, folded: [] };
}

/**
 * Two saves of the season track: the same season keeps the most stars per day, week and free day; across seasons the
 * later one's save stands and the earlier one pays out the rewards it reached, as `Runs` does when a season ends.
 * Rewards union; the tag worn and the daily board are `kept`'s unless it has none.
 */
export function merge_runs_save(kept: unknown, other: unknown): Record<string, unknown> {
  const { save, folded } = merge_season(kept, other);
  const a = parse_runs_keep(kept, "");
  const b = parse_runs_keep(other, "");
  const owned = [...new Set([...a.owned, ...b.owned, ...folded])];
  const wear = a.wear.title || a.wear.tint ? a.wear : b.wear;
  const board = (kept as Record<string, unknown> | null)?.board ?? (other as Record<string, unknown> | null)?.board;
  return { ...save, owned, wear, ...(board === undefined ? {} : { board }) };
}

export interface RunGain {
  /** Season stars this finish added. */
  gain: number;
  /** The daily cap held some back. */
  capped: boolean;
}

export class Runs {
  private save: RunsSave;
  private readonly keep: RunsKeep;
  // Not saved: a weekly's stages as its built map resolves them, known this session once the map has loaded.
  private readonly plans = new Map<string, readonly (Resolved | null)[]>();
  version = 0;

  constructor(
    private readonly store: Store | null,
    private readonly now: () => Date = () => new Date(),
  ) {
    const raw = read_json(store, RUNS_KEY);
    this.save = parse_runs_save(raw, season_of(this.today));
    this.keep = parse_runs_keep(raw, this.today);
    // A season that ended while the game was closed still pays out the steps it reached.
    const last = (raw as Record<string, unknown> | null)?.season;
    if (real_season(last) && last !== this.save.season && this.fold(parse_runs_save(raw, last))) this.write();
  }

  private write() {
    write_json(this.store, RUNS_KEY, { ...this.save, ...this.keep });
  }

  private fold(save: RunsSave): boolean {
    const fresh = reached(save.stars, save.season).filter((code) => !this.keep.owned.includes(code));
    if (fresh.length) this.keep.owned = [...this.keep.owned, ...fresh];
    return fresh.length > 0;
  }

  get today(): string {
    return utc_date(this.now());
  }

  private get current(): RunsSave {
    const season = season_of(this.today);
    if (this.save.season !== season) {
      const ended = this.fold(this.save);
      this.save = parse_runs_save(null, season);
      if (ended) this.write();
    }
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

  weekly(week: string): number {
    return this.current.weeks[week] ?? 0;
  }

  /** The weekly's stages as its map resolved them, aligned with `pick.stages`; null until that map has loaded. */
  week_plan(week: string): readonly (Resolved | null)[] | null {
    return this.plans.get(week) ?? null;
  }

  plan_week(week: string, plan: readonly (Resolved | null)[]) {
    this.plans.set(week, plan);
    this.version++;
  }

  get free_left(): number {
    return Math.max(0, FREE_CAP - (this.current.free[this.today] ?? 0));
  }

  /**
   * A daily started on its own date earns up to its stars once, by that date even when it ends past midnight; a weekly
   * started in its own week likewise by the week. Anything else, an old daily or weekly included, draws on today's free
   * cap. `started`: the UTC date the run began.
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
    } else if (pick.source === RunSource.WEEKLY && pick.date === iso_week(started)) {
      const week = pick.date;
      gain = Math.max(0, stars - (save.weeks[week] ?? 0));
      if (gain) save.weeks = { ...save.weeks, [week]: stars };
    } else {
      gain = Math.min(stars, this.free_left);
      capped = gain < stars;
      if (gain) save.free = { [today]: (save.free[today] ?? 0) + gain };
    }
    if (!gain) return { gain, capped };
    save.stars += gain;
    this.fold(save);
    this.version++;
    this.write();
    return { gain, capped };
  }

  get owned(): readonly string[] {
    this.fold(this.current);
    return this.keep.owned;
  }

  /** What the player wears, less anything it doesn't own (a save edited by hand). */
  get tag(): NameTag | null {
    const owned = this.owned;
    const tag: NameTag = {};
    const { title, tint } = this.keep.wear;
    if (title && owned.includes(title)) tag.title = title;
    if (tint && owned.includes(tint)) tag.tint = tint;
    return tag.title || tag.tint ? tag : null;
  }

  wear(tag: NameTag) {
    this.keep.wear = { ...(tag.title ? { title: tag.title } : {}), ...(tag.tint ? { tint: tag.tint } : {}) };
    this.version++;
    this.write();
  }

  private get board(): DailyBoard {
    const today = this.today;
    if (this.keep.board.date !== today) this.keep.board = { date: today, own: null, seen: [] };
    return this.keep.board;
  }

  get own_daily(): DailyTime | null {
    return this.board.own;
  }

  /** A finish of today's daily, kept and sent to peers when it beats the best on its key. */
  post_daily(time: DailyTime): boolean {
    const board = this.board;
    if (key_date(time.k) !== board.date) return false;
    if (board.own?.k === time.k && daily_order(board.own, time) <= 0) return false;
    board.own = time;
    this.version++;
    this.write();
    return true;
  }

  get seen_dailies(): readonly BoardEntry[] {
    return this.board.seen;
  }

  /** Peers' times join the cache, the best per name and key, so the board outlives the session. */
  see_dailies(entries: readonly BoardEntry[]) {
    const board = this.board;
    let changed = false;
    for (const entry of entries) {
      if (key_date(entry.k) !== board.date || !name_fits(entry.name)) continue;
      const at = board.seen.findIndex((seen) => seen.name === entry.name && seen.k === entry.k);
      if (at >= 0 && daily_order(board.seen[at], entry) <= 0) continue;
      if (at < 0 && board.seen.length >= SEEN_MAX) continue;
      const next: BoardEntry = { name: entry.name, k: entry.k, ms: entry.ms, ...(entry.score === undefined ? {} : { score: entry.score }) };
      board.seen = at >= 0 ? board.seen.map((seen, i) => (i === at ? next : seen)) : [...board.seen, next];
      changed = true;
    }
    if (changed) this.write();
  }
}

/**
 * A run's best times: per date for a daily, `harepin:run:<date>:<world_key>`, per ISO week for a weekly (its stages and
 * `CUP_RECORD`); else per map, lap count and difficulty, `harepin:run[:l<laps>][:<difficulty>]:<world_key>`.
 */
export function run_track(pick: RunPick, levels: readonly string[], store: Store | null, seed: number, kind: WorldKind, map_levels: readonly number[]): Track {
  const laps = pick.laps > 1 ? `:l${pick.laps}` : "";
  const difficulty = pick.difficulty === Difficulty.NORMAL ? "" : `:${pick.difficulty}`;
  const scope = pick.date ? `run:${pick.date}` : `run${laps}${difficulty}`;
  return new Track(scope, seed, levels, store, kind, map_levels);
}

/** A weekly's best championship total so far, off its records on the plain map it runs on; null before a finish. */
export function weekly_best(pick: RunPick, store: Store | null): number | null {
  return run_track(pick, [], store, pick.seed, pick.kind, []).runs[CUP_RECORD]?.score ?? null;
}

/** The points a finished weekly pays season stars on: its best total in its own week, else the cup just run (`total`). */
export function week_points(pick: RunPick, best: number, total: number, started: string): number {
  return pick.date === iso_week(started) ? best : total;
}

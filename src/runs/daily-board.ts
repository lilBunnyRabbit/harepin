import type { DailyTime } from "../net/daily";

const SEP = "|";

/** Two builds can pick different events for one date, so the key carries what decides the event: map, level, records key. */
export const daily_key = (date: string, map: string, level: string, world: string): string => [date, map, level, world].join(SEP);

/** `want` from a player who has not run today's daily yet has no level (its map isn't built): any level matches. */
export function same_daily(want: string, k: string): boolean {
  const a = want.split(SEP);
  const b = k.split(SEP);
  return a.length === 4 && b.length === 4 && a.every((part, i) => part === b[i] || (i === 2 && part === ""));
}

export const key_date = (k: string): string => k.split(SEP)[0];

/** Below zero when `a` ranks first: a score higher first when both have one, else the faster time. */
export function daily_order(a: Omit<DailyTime, "k">, b: Omit<DailyTime, "k">): number {
  if (a.score !== undefined && b.score !== undefined && a.score !== b.score) return b.score - a.score;
  return a.ms - b.ms;
}

export interface BoardEntry extends DailyTime {
  name: string;
}

export interface BoardRow {
  name: string;
  ms: number;
  score?: number;
  you: boolean;
  here: boolean;
}

export interface Board {
  rows: BoardRow[];
  /** Entries left out as another version of today's daily: another level, or scored where this one is timed. */
  hidden: number;
}

/**
 * Rows on `want`, the best per name. Without a level in `want` (today's daily not run yet) levels can differ, so only
 * the biggest group by full key shows. A score ranks only against scores, so rows scored unlike the board (this
 * player's own entry, else most rows) are left out: mixing them makes the order cyclic.
 */
export function board_rows(want: string, own: BoardEntry | null, peers: readonly BoardEntry[], cached: readonly BoardEntry[]): Board {
  const mine = own && same_daily(want, own.k) ? own : null;
  const best = new Map<string, BoardEntry & { here: boolean }>();
  const take = (entry: BoardEntry, here: boolean) => {
    if (!same_daily(mine?.k ?? want, entry.k)) return;
    const id = JSON.stringify([entry.k, entry.name]);
    const old = best.get(id);
    best.set(id, old && daily_order(old, entry) <= 0 ? { ...old, here: old.here || here } : { ...entry, here: here || (old?.here ?? false) });
  };
  for (const entry of cached) take(entry, false);
  for (const entry of peers) take(entry, true);
  const all = [...best.values()];
  const groups = new Map<string, number>();
  for (const entry of all) groups.set(entry.k, (groups.get(entry.k) ?? 0) + 1);
  const biggest = [...groups].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
  const key = mine?.k ?? biggest;
  const group = all.filter((entry) => entry.k === key);
  const scored = mine ? mine.score !== undefined : group.filter((entry) => entry.score !== undefined).length * 2 > group.length;
  const kept = group.filter((entry) => (entry.score !== undefined) === scored);
  const row = ({ name, ms, score }: BoardEntry, you: boolean, here: boolean): BoardRow => ({ name, ms, ...(score === undefined ? {} : { score }), you, here });
  const rows = kept.map((entry) => row(entry, false, entry.here));
  if (mine) rows.push(row(mine, true, true));
  return { rows: rows.sort(daily_order), hidden: all.length - kept.length };
}

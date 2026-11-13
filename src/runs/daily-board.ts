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

export function board_rows(want: string, own: BoardEntry | null, peers: readonly BoardEntry[], cached: readonly BoardEntry[]): BoardRow[] {
  const rows = new Map<string, BoardRow>();
  const row = ({ name, ms, score }: BoardEntry, you: boolean, here: boolean): BoardRow => ({ name, ms, ...(score === undefined ? {} : { score }), you, here });
  for (const entry of cached) if (same_daily(want, entry.k)) rows.set(entry.name, row(entry, false, false));
  for (const entry of peers) {
    if (!same_daily(want, entry.k)) continue;
    const old = rows.get(entry.name);
    rows.set(entry.name, old && daily_order(old, entry) <= 0 ? { ...old, here: true } : row(entry, false, true));
  }
  const list = [...rows.values()];
  if (own && same_daily(want, own.k)) list.push(row(own, true, true));
  return list.sort(daily_order);
}

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

export interface BoardEntry extends DailyTime {
  name: string;
}

export interface BoardRow {
  name: string;
  ms: number;
  you: boolean;
  here: boolean;
}

export function board_rows(want: string, own: BoardEntry | null, peers: readonly BoardEntry[], cached: readonly BoardEntry[]): BoardRow[] {
  const rows = new Map<string, BoardRow>();
  for (const entry of cached) if (same_daily(want, entry.k)) rows.set(entry.name, { name: entry.name, ms: entry.ms, you: false, here: false });
  for (const entry of peers) {
    if (!same_daily(want, entry.k)) continue;
    const old = rows.get(entry.name);
    rows.set(entry.name, { name: entry.name, ms: old ? Math.min(old.ms, entry.ms) : entry.ms, you: false, here: true });
  }
  const list = [...rows.values()];
  if (own && same_daily(want, own.k)) list.push({ name: own.name, ms: own.ms, you: true, here: true });
  return list.sort((a, b) => a.ms - b.ms);
}

/**
 * A best time on today's daily, `k` its date, map code, level and `world_key` (`daily-board.ts`). A type alias, not an
 * interface: it rides in `Hello`, which trystero's DataPayload needs index-signature compatible.
 */
export type DailyTime = { k: string; ms: number };

const DAILY_KEY = /^\d{4}-\d{2}-\d{2}\|[^|]*\|[^|]*\|[^|]*$/;
const DAILY_KEY_MAX = 160;
const DAILY_MS_MAX = 86_400_000;

export function clean_daily(raw: unknown): DailyTime | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { k, ms } = raw as Record<string, unknown>;
  if (typeof k !== "string" || k.length > DAILY_KEY_MAX || !DAILY_KEY.test(k) || /\p{C}/u.test(k)) return null;
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 && ms < DAILY_MS_MAX ? { k, ms } : null;
}

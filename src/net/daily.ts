/**
 * A best run on today's daily, `k` its date, map code, level and `world_key` (`daily-board.ts`); `score` for a mode
 * that ranks by points, km/h or metres. A type alias, not an interface: it rides in `Hello`, which trystero's
 * DataPayload needs index-signature compatible.
 */
export type DailyTime = { k: string; ms: number; score?: number };

const DAILY_KEY = /^\d{4}-\d{2}-\d{2}\|[^|]*\|[^|]*\|[^|]*$/;
const DAILY_KEY_MAX = 160;
const DAILY_MS_MAX = 86_400_000;
const DAILY_SCORE_MAX = 1e9;

export function clean_daily(raw: unknown): DailyTime | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { k, ms, score } = raw as Record<string, unknown>;
  if (typeof k !== "string" || k.length > DAILY_KEY_MAX || !DAILY_KEY.test(k) || /\p{C}/u.test(k)) return null;
  if (!(typeof ms === "number" && Number.isFinite(ms) && ms > 0 && ms < DAILY_MS_MAX)) return null;
  if (score === undefined) return { k, ms };
  return typeof score === "number" && Number.isFinite(score) && score >= 0 && score < DAILY_SCORE_MAX ? { k, ms, score } : null;
}

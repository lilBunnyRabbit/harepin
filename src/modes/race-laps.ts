/**
 * D4: about four minutes a race, in laps of the route's par; an island circuit's one lap already takes that (D3's three
 * laps do not fit), and a town loop of a quarter kilometre runs ten or more.
 */
const RACE_MS = 240_000;
export const MAX_LAPS = 15;

/** Laps an AI race runs. A timed race runs the most laps a field may, so no car stops at the line before the clock does. */
export const race_laps = (par_ms: number, limit_ms: number | null) => (limit_ms ? MAX_LAPS : Math.max(1, Math.min(MAX_LAPS, Math.round(RACE_MS / par_ms))));

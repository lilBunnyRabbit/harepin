import { player_of, result_points, type EventResult, type Season, type SeriesEvent } from "./series";

/** Credits a series point pays: every finish pays, a retry too, so a player short of class can grind (G1). */
export const CREDITS_PER_POINT = 100;
export const FINAL_FACTOR = 2;

export function event_credits(season: Season, event: SeriesEvent, result: EventResult): number {
  const points = result_points(season, event, result, player_of(season));
  return points * CREDITS_PER_POINT * (event.final ? FINAL_FACTOR : 1);
}

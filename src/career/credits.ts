import { CLASS_FACTOR, RERUN_SHARE, ROUND_MAX, ROUND_STEP } from "./prices";
import { KIND_PODIUM, place_of, player_of, result_points, type EventResult, type Season, type SeriesEvent } from "./series";

/** Credits a series point pays: every finish pays, a retry too, so a player short of class can grind (G1). */
export const CREDITS_PER_POINT = 100;
export const FINAL_FACTOR = 2;

export interface EventPay {
  /** Points x `CREDITS_PER_POINT`, a final's doubled. */
  readonly base: number;
  readonly class_factor: number;
  readonly round_factor: number;
  readonly share: number;
  readonly credits: number;
}

export const round_factor = (round: number) => Math.min(ROUND_MAX, 1 + ROUND_STEP * Math.max(0, round));

export const podiumed = (season: Season, event: SeriesEvent, result: EventResult | undefined): boolean =>
  result !== undefined && place_of(result, player_of(season)) <= KIND_PODIUM[event.kind];

/** `rerun`: the event was podiumed before this round. `round`: the season's replay round. */
export function event_pay(season: Season, event: SeriesEvent, result: EventResult, rerun = false, round = 0): EventPay {
  const points = result_points(season, event, result, player_of(season));
  const base = points * CREDITS_PER_POINT * (event.final ? FINAL_FACTOR : 1);
  const class_factor = CLASS_FACTOR[season.cap];
  const rounds = round_factor(round);
  const share = rerun ? RERUN_SHARE : 1;
  return { base, class_factor, round_factor: rounds, share, credits: Math.round(base * class_factor * rounds * share) };
}

export const event_credits = (season: Season, event: SeriesEvent, result: EventResult, rerun = false, round = 0): number => event_pay(season, event, result, rerun, round).credits;

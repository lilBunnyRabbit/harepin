import { ordinal, place_of, player_of, result_points, type EventState, type Season, type SeriesEvent, type SeriesProgress, type Standing } from "../career/series";
import { credits_text, type WalletState } from "../career/wallet";
import type { Build } from "../car/build";
import { within } from "../car/car-pick";
import { CARS, type CarId } from "../car/cars";
import { CLASS_LABELS, rating } from "../car/pi";

export interface SeasonTab {
  name: string;
  open: boolean;
  done: boolean;
}

export interface SeriesView {
  season: Season;
  progress: SeriesProgress;
  states: readonly EventState[];
  table: readonly Standing[];
  done: boolean;
  wallet: WalletState;
  onstart: (id: string) => void;
  onback: () => void;
  onreset: () => void;
  /** Every season, the one shown at `at`; switching shows another. */
  seasons: readonly SeasonTab[];
  at: number;
  onseason: (at: number) => void;
  /** Why the season shown is shut, or null once it is open. */
  lock: string | null;
  /** Why the car in the garage can't race this season, or null when it can. */
  car: string | null;
  ongarage: () => void;
}

export interface EventScore {
  place: number;
  points: number;
}

export const event_art = (event: SeriesEvent) => `${import.meta.env.BASE_URL}series/${event.id}.webp`;

export function event_score(season: Season, progress: SeriesProgress, event: SeriesEvent): EventScore | null {
  const result = progress.results[event.id];
  if (!result) return null;
  const player = player_of(season);
  return { place: place_of(result, player), points: result_points(season, event, result, player) };
}

export function next_event(season: Season, progress: SeriesProgress, states: readonly EventState[]): number {
  const fresh = season.events.findIndex((event, i) => states[i] === "open" && !progress.results[event.id]);
  return fresh >= 0 ? fresh : states.indexOf("open");
}

export const lock_line = (event: SeriesEvent) => (event.final ? "Podium every event to open" : "Any podium opens it");

export const season_lock = (before: Season) => `Finish the ${before.name} series to open`;

export const place_text = (score: EventScore) => ordinal(score.place);

export const cap_line = (season: Season) => `Class ${CLASS_LABELS[season.cap]} · your own cars`;

export const round_line = (progress: SeriesProgress) => (progress.round ? `Run ${progress.round + 1}` : null);

/** The final's prize: the car while the player does not own it, the credits on the season's first run only; null when nothing is left. */
export function reward_line(season: Season, wallet: WalletState, progress: SeriesProgress): string | null {
  const { car, credits } = season.reward;
  const parts = [...(wallet.cars.includes(car) ? [] : [CARS[car].name]), ...(progress.round === 0 ? [credits_text(credits)] : [])];
  return parts.length ? parts.join(" + ") : null;
}

/** Points between the player and the rival: positive when the player leads. */
export function rival_gap(season: Season, table: readonly Standing[]): { rival: Standing; you: Standing; gap: number } | null {
  const rival = table.find((row) => row.driver === season.rival);
  const you = table.find((row) => row.you);
  return rival && you ? { rival, you, gap: you.points - rival.points } : null;
}

export const duel_text = (gap: number) => (gap > 0 ? `You lead by ${gap}` : gap < 0 ? `You trail by ${-gap}` : "Level");

export const terms_line = (season: Season) => `${season.events.length} events · points by finishing place · ${cap_line(season)}`;

export const step_focus = (focus: number, dir: 1 | -1, count: number) => Math.min(Math.max(focus + dir, 0), count - 1);

/** Why the car in the garage can't race this season, in the card's words; null when it can. Mirrors `car_fault`. */
export function car_note(season: Season, build: Build, owned: readonly CarId[]): string | null {
  const name = CARS[build.car].name;
  if (!owned.includes(build.car)) return `The ${name} isn't yours yet. This series races your own cars only.`;
  const rated = rating(build).class;
  return within(rated, season.cap) ? null : `Your ${name} is class ${CLASS_LABELS[rated]}. This series takes ${CLASS_LABELS[season.cap]} or below.`;
}

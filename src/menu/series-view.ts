import { car_fault, Gate, ordinal, place_of, player_of, result_points, type EventState, type Season, type SeriesEvent, type SeriesProgress, type Standing } from "../career/series";
import { credits_text, type WalletState } from "../career/wallet";
import type { Build } from "../car/build";
import { within } from "../car/car-pick";
import { CARS, type CarId } from "../car/cars";
import { CLASS_LABELS, rating } from "../car/pi";

export interface SeasonTab {
  name: string;
  kicker: string;
  beginner: boolean;
  open: boolean;
  done: boolean;
}

export const season_title = (season: Season) => (season.loaner ? season.name : `${season.name} series`);

export function season_kicker(seasons: readonly Season[], season: Season): string {
  if (season.loaner) return `One-make cup${season.beginner ? " · start here" : ""}`;
  const chain = seasons.filter((each) => !each.always_open);
  return `Season ${chain.indexOf(season) + 1} of ${chain.length}`;
}

export function season_tabs(seasons: readonly Season[], open: readonly boolean[], done: readonly boolean[]): SeasonTab[] {
  return seasons.map((season, i) => ({
    name: season_title(season),
    kicker: season_kicker(seasons, season),
    beginner: season.beginner === true,
    open: open[i],
    done: done[i],
  }));
}

export interface SeriesView {
  season: Season;
  progress: SeriesProgress;
  states: readonly EventState[];
  table: readonly Standing[];
  done: boolean;
  wallet: WalletState;
  onstart: (id: string) => void;
  /** The card in front changed: an index into the season's events, or one past them for the standings. */
  onfront?: (at: number) => void;
  onreset: () => void;
  /** Every season, the one shown at `at`; switching shows another. */
  seasons: readonly SeasonTab[];
  at: number;
  onseason: (at: number) => void;
  /** Why the season shown is shut, or null once it is open. */
  lock: string | null;
  /** The page is on screen: each time it comes on, the flow turns to `start_card`. */
  shown?: boolean;
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

const fresh_event = (season: Season, progress: SeriesProgress, states: readonly EventState[]) => season.events.findIndex((event, i) => states[i] === "open" && !progress.results[event.id]);

export function next_event(season: Season, progress: SeriesProgress, states: readonly EventState[]): number {
  const fresh = fresh_event(season, progress, states);
  return fresh >= 0 ? fresh : states.indexOf("open");
}

/** The card the flow opens on: the first open race not run yet, else the last one run, else the first. */
export function start_card(season: Season, progress: SeriesProgress, states: readonly EventState[]): number {
  const fresh = fresh_event(season, progress, states);
  return fresh >= 0 ? fresh : Math.max(season.events.findLastIndex((event) => progress.results[event.id]), 0);
}

export function lock_line(season: Season, event: SeriesEvent): string {
  if (season.gate === Gate.FINISH) return "Finish the round before to open";
  return event.final ? "Podium every event to open" : "Any podium opens it";
}

export const season_lock = (before: Season) => `Finish the ${before.name} series to open`;

export const place_text = (score: EventScore) => ordinal(score.place);

export const loaner_line = (car: CarId) => `Loaner: stock ${CARS[car].name}`;

export const cap_line = (season: Season) => (season.loaner ? `${loaner_line(season.loaner)} for everyone` : `Class ${CLASS_LABELS[season.cap]} · your own cars`);

export const goal_line = (season: Season) => (season.gate === Gate.FINISH ? `finish every round to keep the ${CARS[season.reward.car].name}` : "points by finishing place");

export const round_line = (progress: SeriesProgress) => (progress.round ? `Run ${progress.round + 1}` : null);

/** The final's prize: the car while the player does not own it, the credits on the season's first run only; null when nothing is left. */
export function reward_line(season: Season, wallet: WalletState, progress: SeriesProgress): string | null {
  const { car, credits } = season.reward;
  const parts = [...(wallet.cars.includes(car) ? [] : [CARS[car].name]), ...(progress.round === 0 && credits > 0 ? [credits_text(credits)] : [])];
  return parts.length ? parts.join(" + ") : null;
}

/** Points between the player and the rival: positive when the player leads. */
export function rival_gap(season: Season, table: readonly Standing[]): { rival: Standing; you: Standing; gap: number } | null {
  const rival = table.find((row) => row.driver === season.rival);
  const you = table.find((row) => row.you);
  return rival && you ? { rival, you, gap: you.points - rival.points } : null;
}

export const duel_text = (gap: number) => (gap > 0 ? `You lead by ${gap}` : gap < 0 ? `You trail by ${-gap}` : "Level");

export const terms_line = (season: Season) => `${season.events.length} ${season.gate === Gate.FINISH ? "rounds" : "events"} · ${goal_line(season)} · ${cap_line(season)}`;

export const step_focus = (focus: number, dir: 1 | -1, count: number) => Math.min(Math.max(focus + dir, 0), count - 1);

/** Why the car in the garage can't race this season, in the card's words; null when it can. `car_fault` decides, so the
 * card never offers a race the start would refuse; a fault without card words of its own reads as `car_fault` says. */
export interface CarNote {
  why: string;
  /** The season's rule it breaks; a short card drops it. */
  rule: string;
}

export function car_note(season: Season, build: Build, owned: readonly CarId[]): CarNote | null {
  const fault = car_fault(season, build, owned);
  if (!fault) return null;
  const name = CARS[build.car].name;
  if (!owned.includes(build.car)) return { why: `The ${name} isn't yours yet.`, rule: "This series races your own cars only." };
  const rated = rating(build).class;
  return within(rated, season.cap) ? { why: fault, rule: "" } : { why: `Your ${name} is class ${CLASS_LABELS[rated]}.`, rule: `This series takes ${CLASS_LABELS[season.cap]} or below.` };
}

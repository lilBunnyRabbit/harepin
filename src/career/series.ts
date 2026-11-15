import type { Build } from "../car/build";
import { limit_text, within } from "../car/car-pick";
import { CARS, type CarId } from "../car/cars";
import { rating, type CarClass } from "../car/pi";
import type { FieldOutcome } from "../modes/mode";
import type { WorldKind } from "../worldgen/types";

/** `?series` (dev and review builds): the Harepin Series page; `?series=<event id>` starts that event on its map. */
export const SERIES_PARAM = "series";
export const SERIES_PAGE = "series";

export const SeriesKind = {
  RACE: "race",
  KNOCKOUT: "knockout",
  HEAD_TO_HEAD: "head-to-head",
  ENDURANCE: "endurance",
} as const;
export type SeriesKind = (typeof SeriesKind)[keyof typeof SeriesKind];

export const KIND_NAMES: Record<SeriesKind, string> = {
  [SeriesKind.RACE]: "Race",
  [SeriesKind.KNOCKOUT]: "Knockout",
  [SeriesKind.HEAD_TO_HEAD]: "Head to head",
  [SeriesKind.ENDURANCE]: "Endurance",
};

export const KIND_RULES: Record<SeriesKind, string> = {
  [SeriesKind.RACE]: "Grid start against the whole field; finish order scores.",
  [SeriesKind.KNOCKOUT]: "Last place is out each time the leader passes another share of the race; the last car left wins.",
  [SeriesKind.HEAD_TO_HEAD]: "You against the series rival, one on one.",
  [SeriesKind.ENDURANCE]: "Race the clock out: when time is up, whoever has gone farthest wins.",
};

export interface SeriesDriver {
  readonly name: string;
  readonly aggression: number;
  readonly mistakes: number;
}

export interface SeriesEvent {
  /** Stable: progress keys on it. */
  readonly id: string;
  readonly name: string;
  readonly kind: SeriesKind;
  readonly seed: number;
  /** A closed route on that seed's world: the only kind a field races. */
  readonly route: string;
  readonly final?: true;
  /** ms: an endurance event ends here, placed by distance. */
  readonly limit_ms?: number;
}

/** What a season's final pays on top of its race each time the season is completed; the car only the first time. */
export interface SeasonReward {
  readonly car: CarId;
  readonly credits: number;
}

export interface Season {
  readonly id: string;
  readonly name: string;
  readonly world: WorldKind;
  readonly cap: CarClass;
  readonly reward: SeasonReward;
  /** Seeds a replay draws its events' maps from (C5): each has every route the season's events race, closed. */
  readonly replays: readonly number[];
  readonly field: readonly SeriesDriver[];
  /** Index in `field` of the season's rival (F1): head to head is against them. */
  readonly rival: number;
  readonly events: readonly SeriesEvent[];
}

export const POINTS = [10, 8, 6, 5, 4, 3, 2] as const;
export const PODIUM = 3;
/** Points by place, P1 first, per kind; past a table a finish scores nothing. A duel's P2 is a loss, not a near win. */
export const KIND_POINTS: Record<SeriesKind, readonly number[]> = {
  [SeriesKind.RACE]: POINTS,
  [SeriesKind.KNOCKOUT]: POINTS,
  [SeriesKind.HEAD_TO_HEAD]: [10, 4],
  [SeriesKind.ENDURANCE]: POINTS,
};
/** The place a kind needs to open the next event (D2): a podium, but only a win in a two-car duel. */
export const KIND_PODIUM: Record<SeriesKind, number> = {
  [SeriesKind.RACE]: PODIUM,
  [SeriesKind.KNOCKOUT]: PODIUM,
  [SeriesKind.HEAD_TO_HEAD]: 1,
  [SeriesKind.ENDURANCE]: PODIUM,
};
/** Events open at a season's start; each podium opens one more, and the final opens once every other has one (C1). */
export const OPEN_AT_START = 3;

export const Bonus = {
  CLEAN: "clean",
  LED: "led",
  FASTEST: "fastest",
  FROM_BACK: "back",
} as const;
export type Bonus = (typeof Bonus)[keyof typeof Bonus];

export const BONUS_POINTS: Record<Bonus, number> = { [Bonus.CLEAN]: 2, [Bonus.LED]: 1, [Bonus.FASTEST]: 1, [Bonus.FROM_BACK]: 2 };
export const BONUS_NAMES: Record<Bonus, string> = { [Bonus.CLEAN]: "Clean race", [Bonus.LED]: "Led at halfway", [Bonus.FASTEST]: "Fastest lap", [Bonus.FROM_BACK]: "Won from the back" };
const BONUSES = Object.values(Bonus);
/** What each kind can pay. Fastest lap only where there is more than one lap (Endurance): on one lap it is the win again. */
export const KIND_BONUSES: Record<SeriesKind, readonly Bonus[]> = {
  [SeriesKind.RACE]: [Bonus.CLEAN, Bonus.LED, Bonus.FROM_BACK],
  [SeriesKind.KNOCKOUT]: [Bonus.CLEAN, Bonus.LED, Bonus.FROM_BACK],
  [SeriesKind.HEAD_TO_HEAD]: [Bonus.CLEAN, Bonus.LED, Bonus.FROM_BACK],
  [SeriesKind.ENDURANCE]: [Bonus.CLEAN, Bonus.LED, Bonus.FASTEST, Bonus.FROM_BACK],
};

/** One run of an event: who finished where, as indices into the season's field, the player being `field.length`. */
export interface EventResult {
  readonly order: readonly number[];
  readonly bonus: readonly Bonus[];
}

export interface SeriesProgress {
  readonly season: string;
  /** Completed runs of the season before this one: 0 on the authored maps, each replay on new seeds and a stronger field. */
  readonly round: number;
  readonly results: Readonly<Record<string, EventResult>>;
}

export const player_of = (season: Season) => season.field.length;

export const event_of = (season: Season, id: string | null) => season.events.find((e) => e.id === id) ?? null;

/** The season's drivers an event races, in the table's order: the order they grid in and the field's cars are numbered by. */
export function event_field(season: Season, event: SeriesEvent, progress: SeriesProgress): number[] {
  if (event.kind === SeriesKind.HEAD_TO_HEAD) return [season.rival];
  return standings(season, progress).filter((row) => !row.you).map((row) => row.driver);
}

export const empty_progress = (season: Season, round = 0): SeriesProgress => ({ season: season.id, round, results: {} });

const LEVEL_MIN = 1;
const LEVEL_MAX = 5;

/** The season as round `round` races it: the same events on the next seeds of `replays`, each driver a level bolder and steadier. */
export function season_round(season: Season, round: number): Season {
  if (round <= 0) return season;
  const n = season.events.length;
  return {
    ...season,
    field: season.field.map((d) => ({ ...d, aggression: Math.min(LEVEL_MAX, d.aggression + round), mistakes: Math.max(LEVEL_MIN, d.mistakes - round) })),
    events: season.events.map((e, i) => ({ ...e, seed: season.replays[((round - 1) * n + i) % season.replays.length] })),
  };
}

/** Why the player's car may not race the season, or null: only their own cars (base car start), within the class cap. */
export function car_fault(season: Season, build: Build, owned: readonly CarId[]): string | null {
  if (!owned.includes(build.car)) return `${season.name} series: your own cars only (${owned.map((id) => CARS[id].name).join(", ")})`;
  return within(rating(build).class, season.cap) ? null : `${season.name} series: ${limit_text(season.cap)}`;
}

const is_index = (v: unknown, below: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v < below;

function parse_result(season: Season, raw: unknown): EventResult | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { order, bonus } = raw as { order?: unknown; bonus?: unknown };
  const size = player_of(season) + 1;
  if (!Array.isArray(order) || !order.length || order.length > size || !order.every((i) => is_index(i, size))) return null;
  if (new Set(order).size !== order.length || !order.includes(player_of(season))) return null;
  const bonuses = Array.isArray(bonus) ? bonus.filter((b): b is Bonus => BONUSES.includes(b as Bonus)) : [];
  return { order: order as number[], bonus: [...new Set(bonuses)] };
}

/** Stored progress is untrusted: anything that does not fit the season's events and field drops out. */
export function parse_progress(season: Season, raw: unknown): SeriesProgress {
  const out: Record<string, EventResult> = {};
  if (typeof raw !== "object" || raw === null) return empty_progress(season);
  const { season: id, round: stored, results } = raw as { season?: unknown; round?: unknown; results?: unknown };
  const round = typeof stored === "number" && Number.isInteger(stored) && stored >= 0 ? stored : 0;
  if (id !== season.id || typeof results !== "object" || results === null) return empty_progress(season);
  for (const event of season.events) {
    const result = parse_result(season, (results as Record<string, unknown>)[event.id]);
    if (result) out[event.id] = result;
  }
  return { season: season.id, round, results: out };
}

export const place_of = (result: EventResult, driver: number) => result.order.indexOf(driver) + 1;

export const place_points = (event: SeriesEvent, place: number) => (place >= 1 ? (KIND_POINTS[event.kind][place - 1] ?? 0) : 0);

export const bonus_points = (bonus: readonly Bonus[]) => bonus.reduce((sum, b) => sum + BONUS_POINTS[b], 0);

export function result_points(season: Season, event: SeriesEvent, result: EventResult, driver: number): number {
  const place = place_of(result, driver);
  if (place < 1) return 0;
  return place_points(event, place) + (driver === player_of(season) ? bonus_points(result.bonus) : 0);
}

/**
 * A new run replaces the stored one when it takes a podium the stored one missed, or else more points: a retry never
 * costs the podium that opens the next event (bonuses can lift a fourth place over a plain third), nor points.
 */
export function better(season: Season, event: SeriesEvent, next: EventResult, before: EventResult | undefined): boolean {
  if (!before) return true;
  const up = podium(season, event, next);
  if (up !== podium(season, event, before)) return up;
  const player = player_of(season);
  return result_points(season, event, next, player) > result_points(season, event, before, player);
}

export const podium = (season: Season, event: SeriesEvent, result: EventResult | undefined) => result !== undefined && place_of(result, player_of(season)) <= KIND_PODIUM[event.kind];

export type EventState = "locked" | "open" | "podium";

export function event_states(season: Season, progress: SeriesProgress): EventState[] {
  const podiums = season.events.filter((e) => !e.final && podium(season, e, progress.results[e.id])).length;
  const rest = season.events.filter((e) => !e.final);
  return season.events.map((event) => {
    if (podium(season, event, progress.results[event.id])) return "podium";
    if (event.final) return podiums === rest.length ? "open" : "locked";
    return rest.indexOf(event) < OPEN_AT_START + podiums ? "open" : "locked";
  });
}

export const is_open = (season: Season, progress: SeriesProgress, event: SeriesEvent) => event_states(season, progress)[season.events.indexOf(event)] !== "locked";

/** The season ends with a podium in its final (C4: losing it means another go, the standings kept). */
export const season_done = (season: Season, progress: SeriesProgress) => season.events.every((e) => !e.final || podium(season, e, progress.results[e.id]));

export interface Standing {
  driver: number;
  name: string;
  points: number;
  you: boolean;
  rival: boolean;
}

/** The series table: everyone's points over every event run so far, most first; a tie goes to the better last result. */
export function standings(season: Season, progress: SeriesProgress, you = "You"): Standing[] {
  const player = player_of(season);
  const rows: Standing[] = [...season.field.map((d, i) => ({ driver: i, name: d.name, points: 0, you: false, rival: i === season.rival })), { driver: player, name: you, points: 0, you: true, rival: false }];
  for (const event of season.events) {
    const result = progress.results[event.id];
    if (result) for (const row of rows) row.points += result_points(season, event, result, row.driver);
  }
  return rows.sort((a, b) => b.points - a.points || a.driver - b.driver);
}

/** The player's grid slot (0 on pole) for an event: behind every driver of its field ahead of them in the table. */
export function grid_slot(season: Season, progress: SeriesProgress, event: SeriesEvent): number {
  const drivers = event_field(season, event, progress);
  const table = standings(season, progress);
  const me = table.findIndex((row) => row.you);
  return table.slice(0, me).filter((row) => drivers.includes(row.driver)).length;
}

export const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

export function event_line(season: Season, event: SeriesEvent, result: EventResult): string {
  const player = player_of(season);
  const winner = result.order[0];
  const place = place_of(result, player);
  if (winner === player) return `${event.name}: you win${result.bonus.length ? `, ${result.bonus.map((b) => BONUS_NAMES[b].toLowerCase()).join(", ")}` : ""}.`;
  const name = season.field[winner].name;
  return `${event.name}: ${name} wins${winner === season.rival ? ", the rival" : ""}; you finish ${ordinal(place)}.`;
}


/** The field race's indices (AI cars in `field`'s order, then the player) as the season's driver indices. */
export function event_result(season: Season, event: SeriesEvent, field: readonly number[], outcome: FieldOutcome): EventResult {
  const drivers = [...field, player_of(season)];
  const order = outcome.order.map((car) => drivers[car]);
  const won = order[0] === player_of(season);
  const bonus: Bonus[] = [];
  if (outcome.clean) bonus.push(Bonus.CLEAN);
  if (outcome.led) bonus.push(Bonus.LED);
  if (outcome.fastest) bonus.push(Bonus.FASTEST);
  if (won && outcome.from_back) bonus.push(Bonus.FROM_BACK);
  return { order, bonus: bonus.filter((b) => KIND_BONUSES[event.kind].includes(b)) };
}

import { WorldKind } from "../worldgen/types";
import { rating } from "../car/pi";
import { event_of, Gate, season_done, SeriesKind, stock_build, type Season, type SeriesEvent, type SeriesProgress } from "./series";

export const SEASON_1: Season = {
  id: "s1",
  name: "Island",
  world: WorldKind.ISLAND,
  cap: "c",
  gate: Gate.PODIUM,
  reward: { car: "sajin", credits: 5000 },
  replays: [6, 7, 16, 33, 34, 36, 38, 46, 52, 58, 59],
  field: [
    { name: "Kai Moreno", aggression: 4, mistakes: 2 },
    { name: "Mara Voss", aggression: 3, mistakes: 3 },
    { name: "Teo Lind", aggression: 2, mistakes: 3 },
    { name: "Iris Kade", aggression: 4, mistakes: 4 },
    { name: "Niko Hale", aggression: 3, mistakes: 2 },
    { name: "Sana Ortiz", aggression: 2, mistakes: 4 },
  ],
  rival: 0,
  events: [
    { id: "s1-opener", name: "Opening race", kind: SeriesKind.RACE, seed: 13, route: "circuit" },
    { id: "s1-knockout", name: "Harbour knockout", kind: SeriesKind.KNOCKOUT, seed: 2, route: "circuit" },
    { id: "s1-reverse", name: "Reverse run", kind: SeriesKind.RACE, seed: 9, route: "circuit-rev" },
    { id: "s1-rival", name: "Rival duel", kind: SeriesKind.HEAD_TO_HEAD, seed: 4, route: "circuit" },
    { id: "s1-endurance", name: "Eight minutes", kind: SeriesKind.ENDURANCE, seed: 5, route: "circuit", limit_ms: 480_000 },
    { id: "s1-final", name: "Island final", kind: SeriesKind.RACE, seed: 0, route: "circuit", final: true },
  ],
};

/** Each later season keeps the one before's rival in its field: the champion you beat races on. */
export const SEASON_2: Season = {
  id: "s2",
  name: "Alpine",
  world: WorldKind.ALPINE,
  cap: "b",
  gate: Gate.PODIUM,
  reward: { car: "rally", credits: 7500 },
  replays: [11, 15, 21, 28, 30, 32, 33, 37],
  field: [
    { name: "Elsa Brandt", aggression: 4, mistakes: 2 },
    { name: "Kai Moreno", aggression: 4, mistakes: 2 },
    { name: "Luca Ferri", aggression: 3, mistakes: 3 },
    { name: "Hana Sato", aggression: 3, mistakes: 2 },
    { name: "Pavel Novak", aggression: 4, mistakes: 3 },
    { name: "Ines Ruiz", aggression: 3, mistakes: 3 },
  ],
  rival: 0,
  events: [
    { id: "s2-opener", name: "Valley opener", kind: SeriesKind.RACE, seed: 6, route: "circuit" },
    { id: "s2-knockout", name: "Switchback knockout", kind: SeriesKind.KNOCKOUT, seed: 20, route: "circuit" },
    { id: "s2-reverse", name: "Downhill reverse", kind: SeriesKind.RACE, seed: 14, route: "circuit-rev" },
    { id: "s2-rival", name: "Brandt duel", kind: SeriesKind.HEAD_TO_HEAD, seed: 24, route: "circuit" },
    { id: "s2-endurance", name: "Eight minutes up high", kind: SeriesKind.ENDURANCE, seed: 27, route: "circuit", limit_ms: 480_000 },
    { id: "s2-final", name: "Alpine final", kind: SeriesKind.RACE, seed: 1, route: "circuit", final: true },
  ],
};

/** The Dune sea: Big dunes has no closed road for a field to lap. */
export const SEASON_3: Season = {
  id: "s3",
  name: "Dunes",
  world: WorldKind.DESERT,
  cap: "b",
  gate: Gate.PODIUM,
  reward: { car: "sturm", credits: 10_000 },
  replays: [3, 8, 13, 18, 23, 24, 29, 30, 39],
  field: [
    { name: "Omar Haddad", aggression: 5, mistakes: 2 },
    { name: "Elsa Brandt", aggression: 4, mistakes: 2 },
    { name: "Yara Nasser", aggression: 4, mistakes: 2 },
    { name: "Jonas Berg", aggression: 3, mistakes: 1 },
    { name: "Lea Fontaine", aggression: 4, mistakes: 3 },
    { name: "Ravi Menon", aggression: 3, mistakes: 2 },
  ],
  rival: 0,
  events: [
    { id: "s3-opener", name: "Sand run", kind: SeriesKind.RACE, seed: 14, route: "circuit" },
    { id: "s3-knockout", name: "Mirage knockout", kind: SeriesKind.KNOCKOUT, seed: 9, route: "circuit" },
    { id: "s3-rival", name: "Haddad duel", kind: SeriesKind.HEAD_TO_HEAD, seed: 2, route: "circuit" },
    { id: "s3-race", name: "Turbine race", kind: SeriesKind.RACE, seed: 17, route: "circuit" },
    { id: "s3-endurance", name: "Heat of the day", kind: SeriesKind.ENDURANCE, seed: 33, route: "circuit", limit_ms: 480_000 },
    { id: "s3-final", name: "Dunes final", kind: SeriesKind.RACE, seed: 0, route: "circuit", final: true },
  ],
};

/** Every event laps the biggest town's main street: a field races a streamed world only on a loop that compact (`field_races`). */
export const SEASON_4: Season = {
  id: "s4",
  name: "Mainland",
  world: WorldKind.MAINLAND,
  cap: "a",
  gate: Gate.PODIUM,
  reward: { car: "formula", credits: 15_000 },
  replays: [31, 34, 36, 37, 72, 85, 93, 99],
  field: [
    { name: "Vera Lund", aggression: 5, mistakes: 1 },
    { name: "Omar Haddad", aggression: 5, mistakes: 2 },
    { name: "Theo Grant", aggression: 4, mistakes: 1 },
    { name: "Mina Park", aggression: 4, mistakes: 2 },
    { name: "Arlo Reyes", aggression: 5, mistakes: 2 },
    { name: "Sofia Kral", aggression: 4, mistakes: 1 },
  ],
  rival: 0,
  events: [
    { id: "s4-town", name: "Main street", kind: SeriesKind.RACE, seed: 18, route: "town" },
    { id: "s4-knockout", name: "Town knockout", kind: SeriesKind.KNOCKOUT, seed: 42, route: "town" },
    { id: "s4-race", name: "Old town race", kind: SeriesKind.RACE, seed: 35, route: "town" },
    { id: "s4-rival", name: "Lund duel", kind: SeriesKind.HEAD_TO_HEAD, seed: 44, route: "town" },
    { id: "s4-endurance", name: "Four minutes downtown", kind: SeriesKind.ENDURANCE, seed: 51, route: "town", limit_ms: 240_000 },
    { id: "s4-final", name: "Mainland final", kind: SeriesKind.RACE, seed: 43, route: "town", final: true },
  ],
};

export const SEASONS: readonly Season[] = [SEASON_1, SEASON_2, SEASON_3, SEASON_4];

export const RALLY_TRIAL: Season = {
  id: "rt",
  name: "Rally Trial",
  world: WorldKind.ALPINE,
  cap: rating(stock_build("rally")).class,
  gate: Gate.FINISH,
  loaner: "rally",
  always_open: true,
  beginner: true,
  reward: { car: "rally", credits: 0 },
  replays: [15, 28, 32, 33, 37, 6],
  field: [
    { name: "Juno Pike", aggression: 2, mistakes: 4 },
    { name: "Edda Holm", aggression: 2, mistakes: 3 },
    { name: "Remy Calder", aggression: 3, mistakes: 4 },
    { name: "Noor Saleh", aggression: 2, mistakes: 4 },
    { name: "Bo Strand", aggression: 3, mistakes: 3 },
  ],
  rival: 0,
  events: [
    { id: "rt-opener", name: "Gravel opener", kind: SeriesKind.RACE, seed: 11, route: "circuit" },
    { id: "rt-duel", name: "Pike duel", kind: SeriesKind.HEAD_TO_HEAD, seed: 21, route: "circuit" },
    { id: "rt-final", name: "Four minutes on the pass", kind: SeriesKind.ENDURANCE, seed: 30, route: "circuit", limit_ms: 240_000, final: true },
  ],
};

export const CUPS: readonly Season[] = [RALLY_TRIAL];

/** The Series page's list: the cups lead, so a new player's first pick is a cup that hands over a car. */
export const SERIES_LIST: readonly Season[] = [...CUPS, ...SEASONS];

/** A season has been finished once: its final podiumed now, or a replay begun (a reset only counts up a finished season). */
export const completed = (season: Season, progress: SeriesProgress) => progress.round > 0 || season_done(season, progress);

export function chain_before(seasons: readonly Season[], at: number): Season | null {
  if (seasons[at]?.always_open) return null;
  return seasons.slice(0, at).findLast((season) => !season.always_open) ?? null;
}

/** Which seasons open, in list order: a cup always, a season once the one before it in the chain has been completed. */
export function seasons_open(seasons: readonly Season[], done: readonly boolean[]): boolean[] {
  return seasons.map((_, i) => {
    const before = chain_before(seasons, i);
    return before === null || done[seasons.indexOf(before)];
  });
}

export function series_event(id: string | null): { season: Season; event: SeriesEvent } | null {
  for (const season of SERIES_LIST) {
    const event = event_of(season, id);
    if (event) return { season, event };
  }
  return null;
}

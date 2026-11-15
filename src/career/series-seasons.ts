import { WorldKind } from "../worldgen/types";
import { event_of, SeriesKind, type Season, type SeriesEvent } from "./series";

export const SEASON_1: Season = {
  id: "s1",
  name: "Island",
  world: WorldKind.ISLAND,
  cap: "c",
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

export const SEASONS: readonly Season[] = [SEASON_1];

export function series_event(id: string | null): { season: Season; event: SeriesEvent } | null {
  for (const season of SEASONS) {
    const event = event_of(season, id);
    if (event) return { season, event };
  }
  return null;
}

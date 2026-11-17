import { EVENT_PARAM, GO_PARAM, TUNE_PARAM, event_of, type CareerEvent } from "../career/career";
import { SERIES_PARAM, type Season, type SeriesEvent } from "../career/series";
import { series_event } from "../career/series-seasons";
import { LOBBY_ROOM, clean_room } from "../net/room-name";
import { RUN_PARAM, run_of, type RunPick } from "../runs/runs";
import type { MapSpec } from "../worldgen/kinds/kinds";
import { map_code, read_pick } from "../worldgen/kinds/map-code";
import { short_name_of } from "../worlds/map-name";
import { pick_world, type SavedPick } from "./world-pick";

export type Travel = { from: string | null; to: string; map: MapSpec } & ({ event: CareerEvent; /** Starts as the map loads, its car picked before the travel. */ go: boolean } | { run: RunPick } | { series: { season: Season; event: SeriesEvent } });

// A room the player chose stays theirs across events; without one the event runs solo.
const KEPT_ON_TRAVEL = ["room", "car", TUNE_PARAM];

/** The search a travel reloads with: `to`, plus what this load keeps. A car `taken` in the picker wins over `?car=`. */
export function travel_query(to: Record<string, string>, here: URLSearchParams, taken: boolean): URLSearchParams {
  const query = new URLSearchParams(to);
  for (const kept of KEPT_ON_TRAVEL) {
    const value = here.get(kept);
    if (value !== null && !(taken && kept === "car")) query.set(kept, value);
  }
  return query;
}

// A travel reloads this page with a new search, so the referrer still holds the map it left.
export function came_from(referrer: string, here: URL): URLSearchParams | null {
  if (!URL.canParse(referrer)) return null;
  const from = new URL(referrer);
  return from.origin === here.origin && from.pathname === here.pathname ? from.searchParams : null;
}

const map_of = (params: URLSearchParams, saved: SavedPick) => read_pick(pick_world(params, clean_room(params.get("room")) ?? LOBBY_ROOM, saved));

export function travel_of(params: URLSearchParams, before: URLSearchParams | null, saved: SavedPick): Travel | null {
  const event = event_of(params.get(EVENT_PARAM));
  const run = event ? null : run_of(params.get(RUN_PARAM));
  const series = event || run ? null : series_event(params.get(SERIES_PARAM));
  const map = map_of(params, saved);
  const left = before && map_of(before, saved);
  const where = { from: left && map_code(left) !== map_code(map) ? short_name_of(left) : null, to: short_name_of(map), map };
  if (event) return { ...where, event, go: params.has(GO_PARAM) };
  if (run) return { ...where, run };
  return series && { ...where, series };
}

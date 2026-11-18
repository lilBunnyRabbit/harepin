import { AI_DRIVE_PARAM } from "../ai/difficulty";
import { EVENT_PARAM, TUNE_PARAM, event_of, type CareerEvent } from "../career/career";
import { SERIES_PARAM, type Season, type SeriesEvent } from "../career/series";
import { series_event } from "../career/series-seasons";
import { CUSTOM_PARAM, type CustomRace } from "../modes/custom-race";
import { LOBBY_ROOM, clean_room } from "../net/room-name";
import { RUN_PARAM, run_of, type RunPick } from "../runs/runs";
import type { MapSpec } from "../worldgen/kinds/kinds";
import { map_code, read_pick } from "../worldgen/kinds/map-code";
import { short_name_of } from "../worlds/map-name";
import { pick_world, type SavedPick } from "./world-pick";

export type Travel = { from: string | null; to: string; map: MapSpec } & ({ event: CareerEvent } | { run: RunPick } | { series: { season: Season; event: SeriesEvent } } | { custom: CustomRace });

// A room the player chose stays theirs across events; without one the event runs solo. The dev autopilot drives on through a series' travels.
const KEPT_ON_TRAVEL = ["room", "car", TUNE_PARAM, AI_DRIVE_PARAM];

/** The search a travel reloads with: `to`, plus what this load keeps. A car `taken` in the picker wins over `?car=`. */
export function travel_query(to: Record<string, string>, here: URLSearchParams, taken: boolean): URLSearchParams {
  const query = new URLSearchParams(to);
  for (const kept of KEPT_ON_TRAVEL) {
    const value = here.get(kept);
    if (value !== null && !(taken && kept === "car")) query.set(kept, value);
  }
  return query;
}

/** The car this load's start runs on unasked: the briefing shows the player's own above Start, taken or not. No briefing, none taken. */
export const briefed_car = (travel: Travel | null, own: string): string | null => (travel ? own : null);

// A travel reloads this page with a new search, so the referrer still holds the map it left.
export function came_from(referrer: string, here: URL): URLSearchParams | null {
  if (!URL.canParse(referrer)) return null;
  const from = new URL(referrer);
  return from.origin === here.origin && from.pathname === here.pathname ? from.searchParams : null;
}

const map_of = (params: URLSearchParams, saved: SavedPick) => read_pick(pick_world(params, clean_room(params.get("room")) ?? LOBBY_ROOM, saved));

/** `custom`: the remembered custom race, which `?custom` starts on the map the load names. */
export function travel_of(params: URLSearchParams, before: URLSearchParams | null, saved: SavedPick, custom: CustomRace | null = null): Travel | null {
  const event = event_of(params.get(EVENT_PARAM));
  const run = event ? null : run_of(params.get(RUN_PARAM));
  const series = event || run ? null : series_event(params.get(SERIES_PARAM));
  const map = map_of(params, saved);
  const left = before && map_of(before, saved);
  const where = { from: left && map_code(left) !== map_code(map) ? short_name_of(left) : null, to: short_name_of(map), map };
  if (event) return { ...where, event };
  if (run) return { ...where, run };
  if (series) return { ...where, series };
  return custom && params.has(CUSTOM_PARAM) ? { ...where, custom } : null;
}

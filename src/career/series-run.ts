import type { FieldEvent, FieldHost } from "../modes/mode";
import { line } from "../modes/result";
import { plain_map } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import type { MapSpec } from "../worldgen/kinds/kinds";
import {
  BONUS_NAMES,
  BONUS_POINTS,
  event_field,
  event_result,
  grid_slot,
  ordinal,
  place_of,
  place_points,
  player_of,
  SeriesKind,
  standings,
  type EventResult,
  type Season,
  type SeriesEvent,
} from "./series";
import type { Series } from "./series-store";

export const series_map = (season: Season, event: SeriesEvent): MapSpec => plain_map(season.world, event.seed);

export const on_series_map = (season: Season, event: SeriesEvent, built: MapSpec) => map_code(series_map(season, event)) === map_code(built);

function result_lines(series: Series, event: SeriesEvent, result: EventResult, kept: boolean): HTMLElement[] {
  const { season } = series;
  const place = place_of(result, player_of(season));
  const lines = [line("points", `+${place_points(event, place)} for ${ordinal(place)}`)];
  for (const b of result.bonus) lines.push(line(BONUS_NAMES[b].toLowerCase(), `+${BONUS_POINTS[b]}`));
  const table = standings(season, series.progress);
  const me = table.findIndex((row) => row.you);
  lines.push(line("series", `${ordinal(me + 1)} · ${table[me].points} pts`));
  if (!kept) lines.push(line("kept", "your better run here still counts"));
  return lines;
}

export type SeriesBase = Omit<FieldHost, "cars" | "event" | "attach">;

/** The field a series event races: its drivers' levels and names, scored into `series` as the player's race ends. */
export function series_host(base: SeriesBase, series: Series, event: SeriesEvent, next: FieldEvent["next"]): FieldHost {
  const { season } = series;
  const drivers = event_field(season, event).map((i) => season.field[i]);
  const rules: FieldEvent = {
    name: event.name,
    names: drivers.map((d) => d.name),
    knockout: event.kind === SeriesKind.KNOCKOUT,
    limit_ms: event.limit_ms ?? null,
    grid: grid_slot(season, series.progress, event),
    finish: (outcome) => {
      const result = event_result(season, event, outcome);
      return result_lines(series, event, result, series.record(event, result));
    },
    next,
  };
  return { ...base, cars: drivers.map(({ aggression, mistakes }) => ({ aggression, mistakes })), event: rules };
}

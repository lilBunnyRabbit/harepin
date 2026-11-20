import { RivalPick, type RivalCars } from "../ai/field-pick";
import { CARS } from "../car/cars";
import { CLASS_LABELS } from "../car/pi";
import type { FieldEvent, FieldHost } from "../modes/mode";
import { line, type NextCard } from "../modes/result";
import { plain_map } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import type { MapSpec } from "../worldgen/kinds/kinds";
import type { Place } from "./place";
import {
  BONUS_NAMES,
  BONUS_POINTS,
  event_field,
  event_result,
  Gate,
  grid_slot,
  loaner_code,
  KIND_NAMES,
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
import type { Payout, Series } from "./series-store";
import { credits_text } from "./wallet";

const ONE_MAKE: RivalCars = { pick: RivalPick.ONE_MAKE };

export const series_map =(season: Season, event: SeriesEvent): MapSpec => plain_map(season.world, event.seed);

/** The round a result's Next starts, for its card. */
export function series_ticket(season: Season, event: SeriesEvent, place: Place): NextCard {
  return {
    eyebrow: `Next · Round ${season.events.indexOf(event) + 1} of ${season.events.length}`,
    title: event.name,
    place,
    mode: KIND_NAMES[event.kind],
    kind: season.world,
  };
}

export const on_series_map = (season: Season, event: SeriesEvent, built: MapSpec) => map_code(series_map(season, event)) === map_code(built);

const times = (factor: number) => `×${Number(factor.toFixed(2))}`;

/** How the race's credits came to what they are, past the plain points: only the factors that moved them, then the daily bonus. */
export function pay_lines(season: Season, paid: Pick<Payout, "pay" | "bonus">): [string, string][] {
  const { pay } = paid;
  const lines: [string, string][] = [];
  if (pay.class_factor !== 1) lines.push([`class ${CLASS_LABELS[season.cap]}`, times(pay.class_factor)]);
  if (pay.round_factor !== 1) lines.push(["replay round", times(pay.round_factor)]);
  if (pay.share !== 1) lines.push(["rerun", `${Math.round(pay.share * 100)}%, podium already earned here`]);
  if (paid.bonus) lines.push(["first podium today", `+${credits_text(paid.bonus)}`]);
  return lines;
}

function result_lines(series: Series, event: SeriesEvent, result: EventResult, paid: Payout): HTMLElement[] {
  const { season } = series;
  const place = place_of(result, player_of(season));
  const lines = [line("points", `+${place_points(event, place)} for ${ordinal(place)}`)];
  for (const b of result.bonus) lines.push(line(BONUS_NAMES[b].toLowerCase(), `+${BONUS_POINTS[b]}`));
  const table = standings(season, series.progress);
  const me = table.findIndex((row) => row.you);
  lines.push(line("series", `${ordinal(me + 1)} · ${table[me].points} pts`));
  if (!paid.kept) lines.push(line("kept", "your better run here still counts"));
  lines.push(line("credits", `+${credits_text(paid.credits)}`));
  for (const [label, value] of pay_lines(season, paid)) lines.push(line(label, value));
  const prize = [...(paid.season_credits ? [`+${credits_text(paid.season_credits)}`] : []), ...(paid.car ? [`${CARS[paid.car].name} is yours`] : [])];
  if (prize.length) lines.push(line(season.gate === Gate.FINISH ? "series done" : "season won", prize.join(" · ")));
  if (paid.trophy) lines.push(line("trophy", paid.trophy));
  return lines;
}

export type SeriesBase = Omit<FieldHost, "cars" | "event" | "attach">;

/** The field a series event races: its drivers' levels and names, scored into `series` as the player's race ends. */
export function series_host(base: SeriesBase, series: Series, event: SeriesEvent, next: FieldEvent["next"]): FieldHost {
  const { season } = series;
  const field = event_field(season, event, series.progress);
  const drivers = field.map((i) => season.field[i]);
  const loaner = loaner_code(season);
  const rules: FieldEvent = {
    name: event.name,
    ...(loaner ? { loaner } : {}),
    names: drivers.map((d) => d.name),
    knockout: event.kind === SeriesKind.KNOCKOUT,
    limit_ms: event.limit_ms ?? null,
    grid: grid_slot(season, series.progress, event),
    finish: (outcome) => {
      const result = event_result(season, event, field, outcome);
      return result_lines(series, event, result, series.record(event, result));
    },
    next,
  };
  return { ...base, cars: drivers.map(({ aggression, mistakes }) => ({ aggression, mistakes })), event: rules, ...(loaner ? { rivals: ONE_MAKE } : {}) };
}

import type { CareerEvent } from "../career/career";
import { event_map } from "../career/career-store";
import { MODES } from "../modes/modes";
import { points_text, run_text } from "../modes/result";
import type { StarRun } from "../modes/track";
import { plain_map, snow_of } from "../worldgen/kinds/kinds";
import { WORLDS } from "../worlds/worlds";

export function world_label(event: CareerEvent): string {
  const map = event_map(event);
  const name = WORLDS[map.kind].name;
  const winter = snow_of(map) !== null && snow_of(plain_map(map.kind, map.seed)) === null;
  return winter ? `Winter ${name.toLowerCase()}` : name;
}

export const mode_name = (event: CareerEvent) => (event.stages ? "Championship" : undefined) ?? MODES.find((mode) => mode.id === event.mode)?.name ?? event.mode;

export const best_text = (event: CareerEvent, run: StarRun) => (event.stages ? points_text(run.score ?? 0) : run_text(run, MODES.find((mode) => mode.id === event.mode)?.score_text));

export const event_note = (event: CareerEvent) => `${mode_name(event)} · ${world_label(event)}`;

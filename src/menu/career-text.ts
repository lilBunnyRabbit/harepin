import type { CareerEvent } from "../career/career";
import { event_map } from "../career/career-store";
import { MODES } from "../modes/modes";
import { plain_map, snow_of } from "../worldgen/kinds/kinds";
import { WORLDS } from "../worlds/worlds";

export function world_label(event: CareerEvent): string {
  const map = event_map(event);
  const name = WORLDS[map.kind].name;
  const winter = snow_of(map) !== null && snow_of(plain_map(map.kind, map.seed)) === null;
  return winter ? `Winter ${name.toLowerCase()}` : name;
}

export const mode_name = (event: CareerEvent) => MODES.find((mode) => mode.id === event.mode)?.name ?? event.mode;

export const event_note = (event: CareerEvent) => `${mode_name(event)} · ${world_label(event)}`;

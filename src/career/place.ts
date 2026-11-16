import type { MapSpec } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import type { WorldKind } from "../worldgen/types";
import { short_name_of } from "../worlds/map-name";
import type { CareerEvent } from "./career";
import { event_map } from "./career-store";

export type Place = { here: true } | { here: false; name: string; kind: WorldKind };

export interface MapGroup {
  code: string;
  place: Place;
  events: CareerEvent[];
}

export function place_of(map: MapSpec, here: MapSpec): Place {
  if (map_code(map) === map_code(here)) return { here: true };
  return { here: false, name: short_name_of(map), kind: map.kind };
}

export function by_map(events: readonly CareerEvent[], here: MapSpec): MapGroup[] {
  const groups = new Map<string, MapGroup>();
  for (const event of events) {
    const map = event_map(event);
    const code = map_code(map);
    let group = groups.get(code);
    if (!group) groups.set(code, (group = { code, place: place_of(map, here), events: [] }));
    group.events.push(event);
  }
  const all = [...groups.values()];
  return [...all.filter((g) => g.place.here), ...all.filter((g) => !g.place.here)];
}

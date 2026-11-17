import { limit_text } from "../car/car-pick";
import { EVENTS, MAX_EVENT_STARS, TIERS, tier_of, tier_open, type CareerEvent, type Stars } from "../career/career";
import { event_map } from "../career/career-store";
import { by_map, place_of, type Place } from "../career/place";
import { mode_name } from "../modes/modes";
import type { TierBadge } from "../net/net";
import type { MapSpec } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import { name_of } from "../worlds/map-name";

export const MAPS_PAGE = "maps";
export const MAKE_PAGE = "world";

const KM = 1000;
const METRE_STEP = 10;
const NAMED_MAPS = 2;

export interface MapEvent {
  id: string;
  tier: TierBadge;
  eyebrow: string;
  title: string;
  note: string;
  stars: number;
  open: boolean;
}

export interface MapStop {
  code: string;
  map: MapSpec;
  place: Place;
  name: string;
  events: MapEvent[];
  got: number;
  of: number;
}

export function map_event(event: CareerEvent, stars: Stars): MapEvent {
  const tier = tier_of(event);
  const at = TIERS.indexOf(tier);
  const open = tier_open(stars, tier);
  const before = TIERS[at - 1];
  return {
    id: event.id,
    tier: (at + 1) as TierBadge,
    eyebrow: `${tier.name} ${tier.events.indexOf(event) + 1} · ${mode_name(event)}`,
    title: event.name,
    note: open || !before ? car_line(event) : `Opens at ${tier.opens_at} ★ in ${before.name}`,
    stars: stars[event.id] ?? 0,
    open,
  };
}

const car_line = (event: CareerEvent) => ("preset" in event.car ? `The ${event.car.preset} is lent` : limit_text(event.car.cap));

export function map_stops(stars: Stars, here: MapSpec, here_name: string): MapStop[] {
  const stops: MapStop[] = [];
  for (const group of by_map(EVENTS, here)) {
    const events = group.events.map((event) => map_event(event, stars));
    if (!group.place.here && !events.some((event) => event.open)) continue;
    const open = events.filter((event) => event.open);
    stops.push({
      code: group.code,
      map: event_map(group.events[0]),
      place: group.place,
      name: group.place.here ? here_name : name_of(event_map(group.events[0])),
      events,
      got: open.reduce((sum, event) => sum + event.stars, 0),
      of: open.length * MAX_EVENT_STARS,
    });
  }
  if (!stops[0]?.place.here) stops.unshift({ code: map_code(here), map: here, place: { here: true }, name: here_name, events: [], got: 0, of: 0 });
  return stops;
}

/** The event a map opens on: the first open one short of full stars, else its first open one, else its first. */
export function first_pick(events: readonly MapEvent[]): MapEvent | null {
  return events.find((event) => event.open && event.stars < MAX_EVENT_STARS) ?? events.find((event) => event.open) ?? events[0] ?? null;
}

export interface MapPin {
  id: string;
  x: number;
  z: number;
  label: string;
  ink: string;
}

export interface Elsewhere {
  count: number;
  line: string;
}

export function elsewhere(stars: Stars, here: MapSpec): Elsewhere | null {
  const names: string[] = [];
  let count = 0;
  for (const event of EVENTS) {
    if ((stars[event.id] ?? 0) >= MAX_EVENT_STARS || !tier_open(stars, tier_of(event))) continue;
    const place = place_of(event_map(event), here);
    if (place.here) continue;
    count++;
    if (!names.includes(place.name)) names.push(place.name);
  }
  if (!count) return null;
  const named = names.slice(0, NAMED_MAPS);
  const rest = names.length - named.length;
  const line = rest ? `on ${named.join(", ")} and ${rest} more ${rest === 1 ? "map" : "maps"}` : `on ${named.join(" and ")}`;
  return { count, line };
}

export function distance_text(metres: number): string {
  if (metres >= KM) return `${(metres / KM).toFixed(1)} km`;
  return `${Math.round(metres / METRE_STEP) * METRE_STEP} m`;
}

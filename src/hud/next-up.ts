import { EVENTS, MAX_EVENT_STARS, suggested, tier_of, tier_open, type CareerEvent, type Stars } from "../career/career";
import { event_map } from "../career/career-store";
import { place_of, type Place } from "../career/place";
import type { MapSpec } from "../worldgen/kinds/kinds";

export interface NextUp {
  event: CareerEvent;
  place: Place;
}

// Only the last tier can be all 3-starred while open; then any open event short of 3 stars counts.
function open_picks(stars: Stars): CareerEvent[] {
  const here = suggested(stars, EVENTS.length);
  if (here.length) return here;
  return EVENTS.filter((event) => (stars[event.id] ?? 0) < MAX_EVENT_STARS && tier_open(stars, tier_of(event)));
}

export function next_up(stars: Stars, here: MapSpec): NextUp | null {
  const picks = open_picks(stars).map((event) => ({ event, place: place_of(event_map(event), here) }));
  return picks.find((pick) => pick.place.here) ?? picks[0] ?? null;
}

/** Degrees, clockwise, to turn an up arrow from a car at `heading` toward (`dx`, `dz`): the car's right is -x at heading 0. */
export function arrow_turn(heading: number, dx: number, dz: number): number {
  const off = Math.atan2(dx, dz) - heading;
  return (-Math.atan2(Math.sin(off), Math.cos(off)) * 180) / Math.PI;
}

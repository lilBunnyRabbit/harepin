import type { TierBadge } from "../net/net";
import { TIERS, tier_of, type CareerEvent } from "./career";
import type { Place } from "./place";

/** A career event as a ticket shows it: its tier badge, where it sits in the tier, and its map. */
export interface EventTicket {
  tier: TierBadge;
  eyebrow: string;
  title: string;
  place: Place;
}

export function event_ticket(event: CareerEvent, place: Place): EventTicket {
  const tier = tier_of(event);
  return {
    tier: (TIERS.indexOf(tier) + 1) as TierBadge,
    eyebrow: place.here ? `Next up · ${tier.name} ${tier.events.indexOf(event) + 1} of ${tier.events.length}` : "Next up · on another map",
    title: event.name,
    place,
  };
}

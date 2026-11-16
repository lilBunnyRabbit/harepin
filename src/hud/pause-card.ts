import type { CarId } from "../car/cars";
import { current_tier, tier_max, tier_stars, type Stars } from "../career/career";
import { event_map } from "../career/career-store";
import type { MapSpec } from "../worldgen/kinds/kinds";
import { $ } from "./hud";
import { next_up } from "./next-up";
import type { RoamCard, RunCard } from "./pause-view.svelte";

export interface RoamFacts {
  stars: Stars;
  here: MapSpec;
  map: string;
  flags: number;
  players: number;
  car: CarId;
}

export function roam_card({ stars, here, map, flags, players, car }: RoamFacts): RoamCard {
  const up = next_up(stars, here);
  const tier = current_tier(stars);
  return {
    kind: "roam",
    map,
    world: here.kind,
    next: up ? `${up.event.name} · ${up.place.here ? "on this map" : `on ${up.place.name}`}` : null,
    next_world: up ? event_map(up.event).kind : null,
    flags,
    tier: `${tier.name} ${tier_stars(stars, tier)}/${tier_max(tier)} ★`,
    players,
    car,
  };
}

// The run's status line already holds its name, clock and standing; while paused it no longer moves.
export function run_card(mode: string): RunCard {
  const facts = [$("mode-status-more").textContent, $("mode-status-clock").textContent].filter((fact): fact is string => Boolean(fact));
  return { kind: "event", mode, title: $("mode-status-name").textContent ?? mode, facts };
}

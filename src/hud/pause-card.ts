import { current_tier, tier_max, tier_stars, type Stars } from "../career/career";
import type { MapSpec } from "../worldgen/kinds/kinds";
import { $ } from "./hud";
import { next_up } from "./next-up";
import type { PauseCard } from "./pause-view.svelte";

export interface RoamFacts {
  stars: Stars;
  here: MapSpec;
  map: string;
  flags: number;
  players: number;
}

export function roam_card({ stars, here, map, flags, players }: RoamFacts): PauseCard {
  const up = next_up(stars, here);
  const tier = current_tier(stars);
  const facts = [`${tier.name} ${tier_stars(stars, tier)}/${tier_max(tier)} ★`, `${flags} ${flags === 1 ? "flag" : "flags"} here`];
  if (players > 1) facts.push(`${players} drivers`);
  if (up) facts.push(`next: ${up.event.name}${up.place.here ? "" : ` on ${up.place.name}`}`);
  return { kind: "roam", context: "free roam", title: map, facts };
}

// The run's status line already holds its name, clock and standing; while paused it no longer moves.
export function run_card(mode: string): PauseCard {
  const fields = Array.from($("mode-status-more").children, (field) => field.textContent);
  const facts = [...fields, $("mode-status-clock").textContent].filter((fact): fact is string => Boolean(fact));
  return { kind: "event", context: mode, title: $("mode-status-name").textContent ?? mode, facts };
}

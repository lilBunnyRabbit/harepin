import { TIERS, tier_of, type CareerEvent } from "../career/career";
import { event_map } from "../career/career-store";
import { place_of, type Place } from "../career/place";
import { format } from "../hud/hud";
import type { TierBadge } from "../net/net";
import type { MapSpec } from "../worldgen/kinds/kinds";
import type { WorldKind } from "../worldgen/types";
import type { Hits } from "./hits";
import { MAX_STARS, type StarRun } from "./track";

export function star_row(stars: number): HTMLSpanElement {
  const row = document.createElement("span");
  row.className = "stars";
  const empty = document.createElement("span");
  empty.className = "star-empty";
  empty.textContent = "☆".repeat(MAX_STARS - stars);
  row.append("★".repeat(stars), empty);
  return row;
}

export const points = (score: number) => Math.round(score).toLocaleString("en-US");
export const points_text = (score: number) => `${points(score)} pts`;
export const run_text = (run: StarRun, score_text = points_text) => (run.score === undefined ? format(run.ms) : score_text(run.score));

export function line(label: string, ...value: (string | Node)[]): HTMLElement {
  const row = document.createElement("div");
  const name = document.createElement("span");
  name.className = "dim";
  name.textContent = label;
  const text = document.createElement("b");
  text.append(...value);
  row.append(name, text);
  return row;
}

export function best_line(best: StarRun | undefined, score_text = points_text): HTMLElement {
  return line("best", ...(best ? [`${run_text(best, score_text)} `, star_row(best.stars)] : ["--"]));
}

export function result_title(name: string, record: { improved: boolean; first: boolean }): string {
  return `${name}${record.improved && !record.first ? " · new best" : ""}`;
}

export const penalty_text = (hits: Hits | null) => (hits?.count ? ` (+${hits.penalty_ms / 1000} s)` : "");

export function time_lines(ms: number, hits: Hits | null): HTMLElement[] {
  if (!hits) return [line("time", format(ms))];
  return [line("time", format(ms)), line(`hits ×${hits.count}`, `+${hits.penalty_ms / 1000} s`), line("total", format(ms + hits.penalty_ms))];
}

/** The career event a result's Next goes to, as its card shows it. */
export interface NextTicket {
  tier: TierBadge;
  eyebrow: string;
  title: string;
  /** The event's mode name. */
  mode: string;
  place: Place;
  /** The world kind its map picture shows. */
  kind: WorldKind;
}

export function next_ticket(event: CareerEvent, here: MapSpec, mode: string): NextTicket {
  const tier = tier_of(event);
  const map = event_map(event);
  return {
    tier: (TIERS.indexOf(tier) + 1) as TierBadge,
    eyebrow: `Next up · ${tier.name} ${tier.events.indexOf(event) + 1} of ${tier.events.length}`,
    title: event.name,
    mode,
    place: place_of(map, here),
    kind: map.kind,
  };
}

/** Go starts an event on this map; another map is a Travel. */
export const go_label = (place: Place) => (place.here ? "Go" : `Travel to ${place.name}`);

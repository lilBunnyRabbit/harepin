import type { CareerEvent } from "../career/career";
import { event_map } from "../career/career-store";
import { event_ticket, type EventTicket } from "../career/event-ticket";
import { place_of, type Place } from "../career/place";
import { ordinal } from "../career/series";
import { format } from "../hud/hud";
import type { MapSpec } from "../worldgen/kinds/kinds";
import type { WorldKind } from "../worldgen/types";
import { stage_points, type Cup } from "./championship";
import type { Hits } from "./hits";
import type { Finish } from "./mode";
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

/** The results stamp's headline: the place where cars raced, else the run's title. */
export const stamp_text = (finish: Finish) => (finish.place === undefined ? finish.title : ordinal(finish.place));

export const penalty_text = (hits: Hits | null) => (hits?.count ? ` (+${hits.penalty_ms / 1000} s)` : "");

export function time_lines(ms: number, hits: Hits | null): HTMLElement[] {
  if (!hits) return [line("time", format(ms))];
  return [line("time", format(ms)), line(`hits ×${hits.count}`, `+${hits.penalty_ms / 1000} s`), line("total", format(ms + hits.penalty_ms))];
}

/** Where a result's Next goes, as its card shows it. */
export interface NextCard {
  eyebrow: string;
  title: string;
  place: Place;
  /** The event's mode name. */
  mode: string;
  /** The world kind its map picture shows. */
  kind: WorldKind;
}

/** The career event a result's Next goes to. */
export interface NextTicket extends EventTicket, NextCard {}

export function next_ticket(event: CareerEvent, here: MapSpec, mode: string): NextTicket {
  const map = event_map(event);
  return { ...event_ticket(event, place_of(map, here)), mode, kind: map.kind };
}

/** The primary names where it leads: the next event on this map, or the map a Travel loads. */
export const next_label = (ticket: NextCard) => (ticket.place.here ? `Next: ${ticket.title}` : `Travel to ${ticket.place.name}`);

export type ResultPress = "leave" | "next";
/** Where focus sits when a key lands on the results page: on nothing, on one of the page's own controls, or away under a menu or in another panel. */
export type ResultFocus = "none" | "page" | "away";

/**
 * What a key on the results page does. Escape leaves from anywhere on the page. Enter is Next's key whenever nothing has
 * focus (a click on the scene, a card closed over the page): the primary shows Enter, so it never falls through to the
 * chat. A focused control takes its own Enter, and a page under a menu takes no key at all.
 */
export function result_press(event: Pick<KeyboardEvent, "code" | "repeat" | "ctrlKey" | "metaKey" | "altKey">, focus: ResultFocus, next: boolean): ResultPress | null {
  if (event.repeat || focus === "away") return null;
  if (event.code === "Escape") return "leave";
  const enter = event.code === "Enter" || event.code === "NumpadEnter";
  return enter && focus === "none" && next && !event.ctrlKey && !event.metaKey && !event.altKey ? "next" : null;
}

/** A championship's stages as table rows: points and stars for each one run, and the total under them. */
export function stage_rows(cup: Cup, names: readonly string[]): HTMLElement[] {
  const rows = names.map((stage, i) => {
    const stars = cup.results[i];
    const row = document.createElement("li");
    row.dataset.now = String(i === cup.index);
    const place = document.createElement("span");
    place.className = "dim";
    place.textContent = String(i + 1);
    const name = document.createElement("span");
    name.textContent = stage;
    const score = document.createElement("b");
    score.textContent = stars === null ? "--" : `${stage_points(stars)} pts`;
    row.append(place, name, score, stars === null ? document.createElement("span") : star_row(stars));
    return row;
  });
  const total = document.createElement("li");
  total.className = "cup-total";
  const label = document.createElement("span");
  label.textContent = "Total";
  const sum = document.createElement("b");
  sum.textContent = `${cup.total} pts`;
  total.append(label, sum);
  return [...rows, total];
}

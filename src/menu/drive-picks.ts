import type { Build } from "../car/build";
import { limit_text } from "../car/car-pick";
import { CARS, type CarId } from "../car/cars";
import { CLASS_LABELS } from "../car/pi";
import { MAX_EVENT_STARS, tier_of, type CareerEvent, type Stars } from "../career/career";
import { event_map } from "../career/career-store";
import { place_of, type Place } from "../career/place";
import { event_states, season_done, standings, type Season, type SeriesProgress } from "../career/series";
import { series_map } from "../career/series-run";
import { series_front } from "../career/series-store";
import { modal_open } from "../hud/input";
import { next_up } from "../hud/next-up";
import { daily, type_of, type RunPick } from "../runs/runs";
import { plain_map, type MapSpec } from "../worldgen/kinds/kinds";
import type { WorldKind } from "../worldgen/types";
import type { SettingsHost } from "./page";
import { car_note, event_art, next_event, rival_gap } from "./series-view";

const MINUTE_MS = 60_000;

const plain = (event: KeyboardEvent) => !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !modal_open();

/** Enter on the page itself, not on a control: the primary's key works before anything has focus. */
export const bare_enter = (event: KeyboardEvent) => event.key === "Enter" && plain(event) && !(event.target instanceof Element && event.target.closest("button, a, input, select, textarea"));

/** What the click rule reads off a click: a `PointerEvent` in the browser, with no pointer type behind Enter or the pad's A. */
export interface Press {
  detail: number;
  pointerType?: string;
  currentTarget: unknown;
}

let tapped: unknown = null;

/**
 * The one click rule, for an item whose selection shows something (a part on the car, a car, a map): a click or tap
 * aims; a double-click, or a second tap on the item just tapped, goes. Enter and the pad's A arrive as a click with no
 * pointer behind it (detail 0): they aim and go. A door, which has nothing to show before it opens, skips the rule and
 * opens on its click.
 */
export function aim_or_go(press: Press, aim: () => void, go: () => void) {
  const again = press.pointerType === "mouse" ? press.detail === 2 : press.detail !== 0 && press.currentTarget === tapped;
  tapped = again ? null : press.currentTarget;
  aim();
  if (press.detail === 0 || again) go();
}

/** A page's link key ("m", "c"): a plain press outside a text field, lowercased; null otherwise. */
export function link_key(event: KeyboardEvent): string | null {
  if (!plain(event) || (event.target instanceof Element && event.target.closest("input:not([type='range']), textarea, select"))) return null;
  return event.key.length === 1 ? event.key.toLowerCase() : null;
}

export const PickId = { SERIES: "series", CAREER: "career", RUN: "run", ROAM: "roam" } as const;
export type PickId = (typeof PickId)[keyof typeof PickId];

export interface DrivePick {
  id: PickId;
  /** The event or run id its start takes; empty for free roam. */
  target: string;
  eyebrow: string;
  title: string;
  gain?: string;
  place: Place;
  verb: string;
  note: string;
  kind: WorldKind;
  /** Its own picture where one ships; the map kind's otherwise. */
  art?: string;
  reasons: string[];
}

const load_note = (place: Place, what: string) => (place.here ? "" : `Loads ${place.name}; ${what}`);

const minutes = (ms: number) => `About ${Math.max(1, Math.round(ms / MINUTE_MS))} min`;

export function series_pick(season: Season, progress: SeriesProgress, build: Build, owned: readonly CarId[], here: MapSpec): DrivePick | null {
  if (season_done(season, progress)) return null;
  const at = next_event(season, progress, event_states(season, progress));
  const event = season.events[at];
  if (!event) return null;
  const place = place_of(series_map(season, event), here);
  const duel = rival_gap(season, standings(season, progress));
  const fault = car_note(season, build, owned);
  const reasons = [
    ...(duel ? [duel.gap < 0 ? `${-duel.gap} pts behind ${duel.rival.name}` : duel.gap > 0 ? `${duel.gap} pts ahead of ${duel.rival.name}` : `Level with ${duel.rival.name}`] : []),
    fault ? fault.why : `${CARS[build.car].name} fits class ${CLASS_LABELS[season.cap]}`,
    ...(event.limit_ms ? [minutes(event.limit_ms)] : []),
  ];
  return {
    id: PickId.SERIES,
    target: event.id,
    eyebrow: "Harepin Series",
    title: `Round ${at + 1} of ${season.events.length} · ${event.name}`,
    place,
    verb: `Race Round ${at + 1}`,
    note: load_note(place, "the grid waits there"),
    kind: season.world,
    art: event_art(event),
    reasons,
  };
}

const car_line = (event: CareerEvent) => ("preset" in event.car ? `The ${event.car.preset} is lent` : limit_text(event.car.cap));

export function career_pick(stars: Stars, here: MapSpec): DrivePick | null {
  const up = next_up(stars, here);
  if (!up) return null;
  const { event, place } = up;
  const tier = tier_of(event);
  return {
    id: PickId.CAREER,
    target: event.id,
    eyebrow: "Career",
    title: event.name,
    place,
    verb: `Race ${event.name}`,
    note: place.here ? "Puts you at its flag" : load_note(place, "its flag waits there"),
    kind: event_map(event).kind,
    reasons: [`${tier.name} ${tier.events.indexOf(event) + 1} of ${tier.events.length}`, car_line(event)],
  };
}

export function run_pick(pick: RunPick, got: number, here: MapSpec): DrivePick {
  const left = Math.max(0, MAX_EVENT_STARS - got);
  const place = place_of(plain_map(pick.kind, pick.seed), here);
  const title = type_of(pick.type).name;
  return {
    id: PickId.RUN,
    target: pick.id,
    eyebrow: "Today's run",
    title,
    gain: left ? `+${left}★` : undefined,
    place,
    verb: `Run ${title}`,
    note: load_note(place, "the run starts there"),
    kind: pick.kind,
    reasons: [left ? `${left} ★ left today` : `All ${MAX_EVENT_STARS} ★ today`],
  };
}

/** `running` names a paused run, which Home can only resume. */
export function roam_pick(here: MapSpec, name: string, running: string | null): DrivePick {
  return {
    id: PickId.ROAM,
    target: "",
    eyebrow: running === null ? "Free roam" : `Paused · ${running}`,
    title: name,
    place: { here: true },
    verb: running === null ? `Drive ${name.split(" · ")[0]}` : `Resume ${running}`,
    note: running === null ? "No loading" : "",
    kind: here.kind,
    reasons: [running === null ? "Where you left off" : "Where you paused"],
  };
}

/** Home's cards in the order they lead: the first is the ticket. A paused run leaves only the way back to it. */
export function host_picks(host: SettingsHost, stars: Stars, build: Build): DrivePick[] {
  const here: MapSpec = { kind: host.kind, seed: host.seed, levels: host.levels };
  const running = host.mode_running();
  const roam = roam_pick(here, host.map_name(), running);
  if (running !== null) return [roam];
  const front = host.series[series_front(host.series)];
  const today = host.runs.today;
  return [
    front?.ready ? series_pick(front.season, front.progress, build, front.wallet.state.cars, here) : null,
    career_pick(stars, here),
    run_pick(daily(today), host.runs.daily(today), here),
    roam,
  ].filter((pick) => pick !== null);
}

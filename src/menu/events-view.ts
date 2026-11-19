import { NO_LOCKS, within, type CarLimit } from "../car/car-pick";
import { CLASS_FLOORS, CLASS_LABELS, PI_MAX, type CarClass, type Rating } from "../car/pi";
import { MAX_EVENT_STARS, TIERS, event_of, type CareerEvent, type Stars } from "../career/career";
import type { TierView } from "../career/career-model";
import { event_map } from "../career/career-store";
import { event_place, marks_of } from "../career/gate";
import { place_of, type MapGroup, type Place } from "../career/place";
import { KIND_NAMES, KIND_POINTS, KIND_RULES, PODIUM, ordinal, type SeriesEvent } from "../career/series";
import { series_map } from "../career/series-run";
import type { Series } from "../career/series-store";
import { next_up } from "../hud/next-up";
import { WEEK_STARS } from "../modes/championship";
import { RaceFormat, grid_of, type CustomRace } from "../modes/custom-race";
import { MODES, mode_name } from "../modes/modes";
import { RunSource, run_of, type RunPick } from "../runs/runs";
import { plain_map, type MapSpec } from "../worldgen/kinds/kinds";
import type { SettingsHost } from "./page";
import { car_text, pick_text, stage_text } from "./runs/run-text";
import { cap_line, event_art, season_title } from "./series-view";
import { CARS } from "../car/cars";
import { preview } from "./widgets";

export const CAREER_PAGE = "tiers";
export const RUNS_PAGE = "runs";
export const RUN_BUILD_PAGE = "run-build";
export const MODES_PAGE = "modes";
export const CUSTOM_PAGE = "custom-race";

export const in_map_order = (groups: readonly MapGroup[]) => groups.flatMap((group) => group.events);

export function tier_front(stars: Stars, order: readonly CareerEvent[], here: MapSpec): CareerEvent {
  const up = next_up(stars, here)?.event;
  if (up && order.includes(up)) return up;
  return order.find((event) => (stars[event.id] ?? 0) < MAX_EVENT_STARS) ?? order[0];
}

const maps_text = (view: TierView, maps: number) => `${view.tier.events.length} events on ${maps} ${maps === 1 ? "map" : "maps"}`;

export function tier_line(view: TierView, maps: number): string {
  if (view.state === "locked") return `Opens at ${view.tier.opens_at} ★ in ${TIERS[view.index - 1].name}`;
  return `${view.have} of ${view.max} ★ · ${maps_text(view, maps)}`;
}

export const tier_eyebrow = (view: TierView) => `Tier ${view.index + 1} of ${TIERS.length}${view.state === "current" ? " · now" : view.have === view.max ? " · done" : ""}`;

export type StartTarget = { kind: "event"; event: CareerEvent } | { kind: "series"; series: Series; event: SeriesEvent } | { kind: "run"; pick: RunPick } | { kind: "custom"; setup: CustomRace; map: MapSpec; route: string };

export function target_of(host: SettingsHost, kind: StartTarget["kind"], id: string): StartTarget | null {
  if (kind === "event") {
    const event = event_of(id);
    return event && { kind, event };
  }
  if (kind === "custom") return null;
  if (kind === "run") {
    const pick = run_of(id);
    return pick && { kind, pick };
  }
  const series = host.series.find((one) => one.ready && one.event(id));
  const event = series?.event(id);
  return series && event ? { kind, series, event } : null;
}

export interface StartMark {
  head: string;
  text: string;
}

export interface StartView {
  img: string;
  eyebrow: string;
  title: string;
  place: Place;
  marks: readonly StartMark[];
  facts: string;
  /** What the car must meet in the picker; null when the event lends its own. */
  limit: CarLimit | null;
  limit_text: string;
  lent: string | null;
}

const RUN_EYEBROWS: Record<RunSource, string> = { [RunSource.DAILY]: "Daily run", [RunSource.WEEKLY]: "Weekly championship", [RunSource.RANDOM]: "Random run", [RunSource.CUSTOM]: "Built run" };

const car_sized_only = (modes: readonly string[]) => modes.some((id) => MODES.find((mode) => mode.id === id)?.car_sized_only);

// Off its map an event's routes are not loaded, so the cars a route leaves out show only at its start.
function event_limit(event: CareerEvent): CarLimit | null {
  if (!("cap" in event.car)) return null;
  return { cap: event.car.cap, car_sized_only: car_sized_only((event.stages ?? [event]).map((stage) => stage.mode)) };
}

export function start_view(target: StartTarget, here: MapSpec): StartView {
  if (target.kind === "event") {
    const { event } = target;
    const map = event_map(event);
    const limit = event_limit(event);
    const car = "cap" in event.car ? `Class ${CLASS_LABELS[event.car.cap]} max` : null;
    return {
      img: preview(map.kind),
      eyebrow: `${event_place(event)} · ${mode_name(event)}`,
      title: event.name,
      place: place_of(map, here),
      marks: marks_of(event).map((mark) => ({ head: "★".repeat(mark.stars), text: mark.text })),
      facts: [event.stages ? `${event.stages.length} stages` : null, event.off_tarmac ? "Leaves the tarmac" : null, car].filter(Boolean).join(" · "),
      limit,
      limit_text: car ?? "",
      lent: "preset" in event.car ? event.car.preset : null,
    };
  }
  if (target.kind === "series") {
    const { series, event } = target;
    const { season } = series;
    return {
      img: event_art(event),
      eyebrow: `${season_title(season)} · Round ${season.events.indexOf(event) + 1} of ${season.events.length} · ${KIND_NAMES[event.kind]}`,
      title: event.name,
      place: place_of(series_map(season, event), here),
      marks: KIND_POINTS[event.kind].slice(0, PODIUM).map((points, i) => ({ head: ordinal(i + 1), text: `${points} pts` })),
      facts: `${KIND_RULES[event.kind]} · ${cap_line(season)}`,
      limit: season.loaner ? null : series.car_limit(),
      limit_text: cap_line(season),
      lent: season.loaner ? `stock ${CARS[season.loaner].name}` : null,
    };
  }
  if (target.kind === "custom") {
    const { setup, map } = target;
    return {
      img: preview(map.kind),
      eyebrow: `Custom race · ${FORMAT_NAMES[setup.format]}`,
      title: target.route,
      place: place_of(map, here),
      marks: [
        { head: "Rivals", text: String(setup.rivals) },
        { head: setup.format === RaceFormat.TIMED ? "Time" : "Laps", text: length_text(setup) },
        { head: "Grid", text: `P${grid_of(setup) + 1}` },
      ],
      facts: "Any car you own · nothing is recorded",
      limit: { cap: null, car_sized_only: false, locked: NO_LOCKS },
      limit_text: "Any car",
      lent: null,
    };
  }
  const { pick } = target;
  const weekly = pick.stages !== null;
  return {
    img: preview(pick.kind),
    eyebrow: RUN_EYEBROWS[pick.source],
    title: pick_text(pick),
    place: place_of(plain_map(pick.kind, pick.seed), here),
    marks: (pick.stages ?? []).map((stage, i) => ({ head: String(i + 1), text: stage_text(stage.type, undefined) })),
    facts: [weekly ? `Up to ${WEEK_STARS} season ★` : "Up to 3 season ★", "cap" in pick.car ? car_text(pick.car) : null].filter(Boolean).join(" · "),
    limit: "cap" in pick.car ? { cap: pick.car.cap, car_sized_only: false } : null,
    limit_text: car_text(pick.car),
    lent: "preset" in pick.car ? pick.car.preset : null,
  };
}

export const FORMAT_NAMES: Record<RaceFormat, string> = { laps: "Race", knockout: "Knockout", timed: "Timed" };

export const length_text = (setup: CustomRace) => (setup.format === RaceFormat.TIMED ? `${setup.minutes} min` : setup.laps ? String(setup.laps) : "Auto");

export interface GoLine {
  verb: string;
  note: string;
}

export function go_line(view: StartView, short: string): GoLine {
  const pick = view.limit ? "Pick a car" : null;
  if (view.place.here) return { verb: `Race ${short}`, note: pick ? `${pick}, then it starts. No loading.` : "Starts now. No loading." };
  return { verb: `Travel to ${view.place.name}`, note: pick ? `${pick}, then ${view.place.name} loads.` : `Loads ${view.place.name}.` };
}

export const target_name = (target: StartTarget) => (target.kind === "run" ? pick_text(target.pick) : target.kind === "custom" ? target.route : target.event.name);

export function start_target(host: SettingsHost, target: StartTarget, car: string | null) {
  if (target.kind === "event") host.start_event(target.event.id, car);
  else if (target.kind === "series") host.start_series(target.event.id, car);
  else if (target.kind === "run") host.start_run(target.pick.id, car);
  else host.start_custom(car);
}

export function complete_line(views: readonly TierView[]): string | null {
  if (!views.every((view) => view.have === view.max && view.rewards.every((reward) => reward.got))) return null;
  const trophies = views.reduce((sum, view) => sum + view.rewards.length, 0);
  return `${views[views.length - 1].tier.name} rank and all ${trophies} trophies won`;
}

export interface CarFit {
  text: string;
  /** The car can't start as it is. */
  off: boolean;
  /** The Garage can change the answer: the car is over the cap, or under it with a class to spare. */
  tune: boolean;
}

/** The PI under a cap a car can be tuned up to and still fit; at least this much room left, the sheet points to the Garage. */
const TUNE_ROOM = 25;

const class_top = (cap: CarClass) => (CLASS_FLOORS[CLASS_FLOORS.findIndex(([name]) => name === cap) + 1]?.[1] ?? PI_MAX + 1) - 1;

/** The start sheet's line on the car fitted against the event's limit; `blocked` is the picker's reason it is out. */
export function car_fit(rated: Rating, limit: CarLimit | null, blocked: string | null): CarFit {
  const cap = limit?.cap ?? null;
  if (cap && !within(rated.class, cap)) return { text: `Over the ${CLASS_LABELS[cap]} cap: detune it in the Garage`, off: true, tune: true };
  if (blocked) return { text: `${blocked}: pick another next`, off: true, tune: false };
  const top = cap ? class_top(cap) : 0;
  if (cap && top - rated.pi >= TUNE_ROOM) return { text: `Room up to ${CLASS_LABELS[cap]} ${top}: tune it in the Garage`, off: false, tune: true };
  return { text: "Your car fits", off: false, tune: false };
}

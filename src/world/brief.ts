import { parse_build } from "../car/build";
import { limit_text } from "../car/car-pick";
import { CARS, type CarId } from "../car/cars";
import { loaner_line, season_title } from "../menu/series-view";
import { PRESETS } from "../car/presets";
import { event_place, marks_of, type Mark } from "../career/gate";
import { FORMAT_NAMES, length_text } from "../menu/events-view";
import { RaceFormat, grid_of } from "../modes/custom-race";
import { MODES, mode_name } from "../modes/modes";
import { type_of } from "../runs/runs";
import type { Travel } from "./travel";

export interface BriefSpec {
  label: string;
  value: string;
}

/** What the travel briefing says about the run the load is bound for. */
export interface BriefFacts {
  eyebrow: string;
  name: string;
  /** One line on what to do, the mode's own. */
  goal: string;
  marks: readonly Mark[];
  specs: readonly BriefSpec[];
  /** The car the event lends, null when the player brings their own. */
  lent: { car: CarId; name: string } | null;
  /** Under the car: how the run begins once the map stands. */
  start: string;
}

const goal_of = (mode: string) => MODES.find((one) => one.id === mode)?.goal ?? "";

export function brief_of(travel: Travel): BriefFacts {
  if ("run" in travel) {
    const type = type_of(travel.run.type);
    return { eyebrow: "Run", name: type.name, goal: goal_of(type.mode), marks: [], specs: [], lent: null, start: "Starts on the line, engine running" };
  }
  if ("series" in travel) {
    const { season, event } = travel.series;
    const eyebrow = `${season_title(season)} · Round ${season.events.indexOf(event) + 1} of ${season.events.length}`;
    const { loaner } = season;
    const specs = [{ label: "Car", value: loaner ? loaner_line(loaner) : limit_text(season.cap) }];
    return { eyebrow, name: event.name, goal: goal_of("race"), marks: [], specs, lent: loaner ? { car: loaner, name: `Stock ${CARS[loaner].name}` } : null, start: "Starts on the grid, engine running" };
  }
  if ("custom" in travel) {
    const setup = travel.custom;
    const specs = [
      { label: "Rivals", value: String(setup.rivals) },
      { label: setup.format === RaceFormat.TIMED ? "Time" : "Laps", value: length_text(setup) },
      { label: "Grid", value: `P${grid_of(setup) + 1}` },
    ];
    return { eyebrow: `Custom race · ${FORMAT_NAMES[setup.format]}`, name: "Custom race", goal: goal_of("race"), marks: [], specs, lent: null, start: "Starts on the grid, engine running" };
  }
  const { event } = travel;
  const preset = "preset" in event.car ? PRESETS.find((one) => "preset" in event.car && one.name === event.car.preset) : undefined;
  const car = parse_build(preset?.code)?.car;
  return {
    eyebrow: `${event_place(event)} · ${mode_name(event)}`,
    name: event.name,
    goal: goal_of(event.mode),
    marks: marks_of(event),
    specs: "cap" in event.car ? [{ label: "Car", value: limit_text(event.car.cap) }] : [],
    lent: preset && car ? { car, name: preset.name } : null,
    start: preset ? "Lent for this event · starts at the flag" : "Starts at the flag, engine running",
  };
}

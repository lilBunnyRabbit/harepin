import { apply_mods, build_mods, DEFAULT_BUILD, DEFAULT_PARTS, parse_build, type Build, type Mod, type Slot } from "../car/build";
import { CARS, type BodyStyle, type CarSpec } from "../car/cars";
import { class_of, spec_pi, type CarClass } from "../car/pi";
import type { SettingsState } from "../menu/prefs";
import { seed_of } from "../rng";
import { LAB_STATIONS, type LabLane, type LabStation, type StationId } from "../worldgen/lab";

/** Trial cars that are not in `CARS` start with this, so they can never be read as a build code or a garage car. */
export const LAB_CAR = "lab:";

export interface Pack {
  id: string;
  /** Bumped on every edit: the export carries it, so two pastes of different revs are never diffed as one. */
  rev: number;
  title: string;
  brief: string;
  cars?: Record<string, LabCar>;
  trials: Trial[];
  /** Asked after every trial unless the trial names its own. */
  ask: Question[];
  /** Groups show as A, B, C with their base's feel line (decision O2: on for variant groups, off for lineups). */
  blind?: boolean;
}

/** A car that is not in the game yet: the same spec literal that will later be pasted into `cars.ts`. */
export interface LabCar {
  name: string;
  spec: CarSpec;
  /** A shipped body drawn in its place until the car's own design lands. */
  look: BodyStyle;
  /** Parts drawn on the car and folded into its spec before the trial's `mods`. */
  parts?: Partial<Record<Slot, number>>;
}

export type Aids = Partial<Pick<SettingsState, "tcs" | "abs" | "assist" | "stability" | "auto" | "steer_mode">>;

export interface Trial {
  id: string;
  /** A build code of a shipped car, or `lab:<key>` of the pack's `cars`. */
  car: string;
  /** Folded after the build's parts, as one more part would be. */
  mods?: Mod[];
  aids?: Aids;
  station: StationId;
  /** A lane of the station by name; its first lane when absent. */
  lane?: string;
  goal: Goal;
  try: string;
  feel: string;
  ask?: Question[];
  /** Starts a group: the trials after it, up to the next base, read against it. In a blind pack its feel line is the group's. */
  base?: true;
}

export type Goal = { kind: "laps"; laps: number } | { kind: "time"; seconds: number } | { kind: "stop"; from_kmh: number } | { kind: "run" } | { kind: "free" };

export type Question = { kind: "scale"; id: string; label: string; low: string; high: string } | { kind: "pick"; id: string; label: string; options: string[] } | { kind: "text"; id: string; label: string };

export interface Resolved {
  trial: Trial;
  /** Draws the car; for a lab car its body is the `look`. */
  build: Build;
  spec: CarSpec;
  /** 8 hex digits of the resolved spec: proves which physics ran. */
  hash: string;
  pi: number;
  class: CarClass;
  station: LabStation;
  lane: LabLane;
}

export const spec_hash = (spec: CarSpec): string => seed_of(JSON.stringify(spec)).toString(16).padStart(8, "0");

export function station_of(id: string): LabStation {
  const station = LAB_STATIONS.find((s) => s.id === id);
  if (!station) throw new Error(`unknown station "${id}", expected one of ${LAB_STATIONS.map((s) => s.id).join(", ")}`);
  return station;
}

export function lane_of(station: LabStation, name?: string): LabLane {
  const lane = name === undefined ? station.lanes[0] : station.lanes.find((l) => l.name === name);
  if (!lane) throw new Error(`station ${station.id} has no lane "${name}", expected one of ${station.lanes.map((l) => l.name).join(", ")}`);
  return lane;
}

function car_of(pack: Pack, car: string): { build: Build; base: CarSpec } {
  if (car.startsWith(LAB_CAR)) {
    const key = car.slice(LAB_CAR.length);
    const lab = pack.cars?.[key];
    if (!lab) throw new Error(`no lab car "${key}" in pack ${pack.id}`);
    return { build: { ...DEFAULT_BUILD, car: lab.look, parts: { ...DEFAULT_PARTS, ...lab.parts } }, base: { ...lab.spec, id: car } };
  }
  const build = parse_build(car);
  if (!build) throw new Error(`"${car}" is neither a build code nor ${LAB_CAR}<car>`);
  return { build, base: CARS[build.car] };
}

export function resolve_trial(pack: Pack, trial: Trial): Resolved {
  const { build, base } = car_of(pack, trial.car);
  const spec = apply_mods(base, [...build_mods(build.parts), ...(trial.mods ?? [])]);
  const station = station_of(trial.station);
  const pi = spec_pi(spec);
  return { trial, build, spec, hash: spec_hash(spec), pi, class: class_of(pi), station, lane: lane_of(station, trial.lane) };
}

export const resolve_pack = (pack: Pack): Resolved[] => pack.trials.map((trial) => resolve_trial(pack, trial));

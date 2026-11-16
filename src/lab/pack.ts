import type { Difficulty } from "../ai/difficulty";
import { OFF_ROAD } from "../ai/driver";
import type { FieldCar } from "../ai/field";
import { apply_mods, build_mods, DEFAULT_BUILD, DEFAULT_PARTS, parse_build, type Build, type Mod, type Slot } from "../car/build";
import { CARS, spec_hash, type BodyStyle, type CarSpec } from "../car/cars";
import { class_of, spec_pi, type CarClass } from "../car/pi";
import type { SettingsState } from "../menu/prefs";
import { LAB_STATIONS, LabSurface, type LabLane, type LabStation, type StationId } from "../worldgen/lab";

/** Trial cars that are not in `CARS` start with this, so they can never be read as a build code or a garage car. */
export const LAB_CAR = "lab:";

export interface Pack {
  id: string;
  /** Bumped on every edit: the export carries it, so two pastes of different revs are never diffed as one. */
  rev: number;
  title: string;
  brief: string;
  aim?: string;
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

interface TrialCore {
  id: string;
  /** A build code of a shipped car, or `lab:<key>` of the pack's `cars`. */
  car: string;
  /** Folded after the build's parts, as one more part would be. */
  mods?: Mod[];
  aids?: Aids;
  goal: Goal;
  try: string;
  feel: string;
  /** What the trial answers; derived from its place in the pack when absent. */
  question?: string;
  ask?: Question[];
  /** Starts a group: the trials after it, up to the next base, read against it. In a blind pack its feel line is the group's. */
  base?: true;
}

/** A trial on a station of the lab world. */
export interface StationTrial extends TrialCore {
  station: StationId;
  /** A lane of the station by name; its first lane when absent. */
  lane?: string;
}

/** A trial on a race world against an AI field (H8, O8): the lab reloads onto `map` for it. */
export interface RaceTrial extends TrialCore {
  /** A map code (`worldgen/kinds/map-code.ts`) of a compact world with a closed circuit and no rails. */
  map: string;
  /** The race level the field runs, on a closed route; `circuit` when absent. */
  route?: string;
  field: TrialField;
}

/** Laps of a race world's closed route alone, no field, its drive traced for `scripts/ai-ml/owner.ts`: the lab reloads onto `map` for it. */
export interface RouteTrial extends TrialCore {
  map: string;
  /** A closed route on the map; `circuit` when absent. */
  route?: string;
  goal: { kind: "laps"; laps: number };
}

export type Trial = StationTrial | RaceTrial | RouteTrial;

export interface TrialField {
  /** One per AI car on the grid, pole first; the player starts last. */
  cars: FieldCar[];
  /** As the player's setting would scale the field (O5); normal when absent. */
  difficulty?: Difficulty;
}

/** The AI cars a race trial may put on the grid (F3's six). */
export const FIELD_MAX = 6;
export const RACE_ROUTE = "circuit";

export const is_race = (trial: Trial): trial is RaceTrial => "field" in trial;
export const is_route = (trial: Trial): trial is RouteTrial => "map" in trial && !("field" in trial);

/** Metres between a race lane's path points: a chord through a hairpin then strays under a metre off the centreline. */
const RACE_PATH_STEP = 10;

/** A closed route's centreline as a lane path, back to its start: farther off than the field's own off-road line counts as off. */
export function race_path(points: readonly { x: number; z: number }[]): NonNullable<LabLane["path"]> {
  const out: [number, number][] = [];
  let since = Infinity;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) since += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    if (since < RACE_PATH_STEP) continue;
    out.push([points[i].x, points[i].z]);
    since = 0;
  }
  out.push([points[0].x, points[0].z]);
  return { points: out, half: OFF_ROAD };
}

/** `race`: the whole race, until the player crosses the line; a race trial's other goal is `time`. */
export type Goal = { kind: "laps"; laps: number } | { kind: "time"; seconds: number } | { kind: "stop"; from_kmh: number } | { kind: "run" } | { kind: "free" } | { kind: "race" };

export type Question = { kind: "scale"; id: string; label: string; low: string; high: string } | { kind: "pick"; id: string; label: string; options: string[] } | { kind: "text"; id: string; label: string };

interface ResolvedCar {
  /** Draws the car; for a lab car its body is the `look`. */
  build: Build;
  spec: CarSpec;
  /** 8 hex digits of the resolved spec: proves which physics ran. */
  hash: string;
  pi: number;
  class: CarClass;
}

export interface StationResolved extends ResolvedCar {
  trial: StationTrial;
  station: LabStation;
  lane: LabLane;
}

/** `lane` is a bare one named after the route; the lab adds the route's centreline as its path once the race (or the route trial) starts. */
export interface RaceResolved extends ResolvedCar {
  trial: RaceTrial;
  station: null;
  lane: LabLane;
}

export interface RouteResolved extends ResolvedCar {
  trial: RouteTrial;
  station: null;
  lane: LabLane;
}

export type Resolved = StationResolved | RaceResolved | RouteResolved;

export const race_resolved = (r: Resolved): r is RaceResolved => is_race(r.trial);
export const route_resolved = (r: Resolved): r is RouteResolved => is_route(r.trial);

/** Where a trial runs: its station, or its race world's map code. */
export const place_of = (trial: Trial): string => ("map" in trial ? trial.map : trial.station);


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

function check_race(trial: RaceTrial) {
  const { cars } = trial.field;
  if (cars.length < 1 || cars.length > FIELD_MAX) throw new Error(`trial ${trial.id} puts ${cars.length} AI cars on the grid, expected 1-${FIELD_MAX}`);
  if (trial.goal.kind !== "race" && trial.goal.kind !== "time") throw new Error(`trial ${trial.id} is a race: its goal is race or time, not ${trial.goal.kind}`);
}

const bare_lane = (route = RACE_ROUTE): LabLane => ({ name: route, surface: LabSurface.ASPHALT, spawn: { x: 0, z: 0, heading: 0 } });

export function resolve_trial(pack: Pack, trial: Trial): Resolved {
  const { build, base } = car_of(pack, trial.car);
  const spec = apply_mods(base, [...build_mods(build.parts), ...(trial.mods ?? [])]);
  const pi = spec_pi(spec);
  const car = { build, spec, hash: spec_hash(spec), pi, class: class_of(pi) };
  if (is_race(trial)) {
    check_race(trial);
    return { ...car, trial, station: null, lane: bare_lane(trial.route) };
  }
  if (is_route(trial)) return { ...car, trial, station: null, lane: bare_lane(trial.route) };
  if (trial.goal.kind === "race") throw new Error(`trial ${trial.id} has a race goal on a station`);
  const station = station_of(trial.station);
  return { ...car, trial, station, lane: lane_of(station, trial.lane) };
}

export const resolve_pack = (pack: Pack): Resolved[] => pack.trials.map((trial) => resolve_trial(pack, trial));

import { Difficulty } from "../ai/difficulty";
import { RivalPick, type RivalCars } from "../ai/field-pick";
import type { MapSpec } from "../worldgen/kinds/kinds";
import { map_code, parse_map_code } from "../worldgen/kinds/map-code";
import type { FieldEvent, FieldHost } from "./mode";
import { MAX_LAPS } from "./race-laps";
import { RACE_RULES, type RaceRules } from "./race-rules";

/** `?custom`: the remembered custom race starts once its map has loaded. */
export const CUSTOM_PARAM = "custom";

export const MAX_RIVALS = 7;
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 5;
export const TIMES = [2, 3, 5, 10] as const;
const MINUTE_MS = 60_000;
const MAX_NAME = 40;

export const RaceFormat = { LAPS: "laps", KNOCKOUT: "knockout", TIMED: "timed" } as const;
export type RaceFormat = (typeof RaceFormat)[keyof typeof RaceFormat];

export const Temperament = { CALM: "calm", MIXED: "mixed", AGGRESSIVE: "aggressive" } as const;
export type Temperament = (typeof Temperament)[keyof typeof Temperament];

/** The aggression levels a field takes down its grid, pole first and round again. */
const TEMPERS: Record<Temperament, readonly number[]> = { calm: [1, 2], mixed: [3, 2, 4], aggressive: [5, 4] };
const NO_LIMITS: RaceRules = { ...RACE_RULES, limits: null };

export interface CustomRace {
  /** The map's code; null races the map being driven. */
  map: string | null;
  /** A route id on that map; one the map has no circuit for takes its first circuit. */
  route: string;
  rivals: number;
  format: RaceFormat;
  /** 0: the route's par picks, about four minutes of racing. */
  laps: number;
  minutes: number;
  difficulty: Difficulty;
  temperament: Temperament;
  /** The owner's 1-5 level every rival draws its slips in. */
  mistakes: number;
  /** Track limits: cuts are warned, then cost time. */
  limits: boolean;
  slipstream: boolean;
  /** The player's grid slot, 0 on pole; past the field it is the last slot, whatever the rival count. */
  grid: number;
  cars: RivalPick;
  picked: readonly string[];
}

export const DEFAULT_CUSTOM: CustomRace = {
  map: null,
  route: "",
  rivals: 5,
  format: RaceFormat.LAPS,
  laps: 0,
  minutes: 3,
  difficulty: Difficulty.NORMAL,
  temperament: Temperament.MIXED,
  mistakes: 3,
  limits: true,
  slipstream: true,
  grid: MAX_RIVALS,
  cars: RivalPick.CLASS,
  picked: [],
};

const whole = (raw: unknown, min: number, max: number, fallback: number) => (typeof raw === "number" && Number.isFinite(raw) ? Math.max(min, Math.min(max, Math.trunc(raw))) : fallback);
const among = <T extends string | number>(raw: unknown, values: readonly T[], fallback: T): T => (values.includes(raw as T) ? (raw as T) : fallback);

export function parse_custom_race(raw: unknown): CustomRace {
  if (typeof raw !== "object" || raw === null) return DEFAULT_CUSTOM;
  const stored = raw as Record<string, unknown>;
  const d = DEFAULT_CUSTOM;
  return {
    map: typeof stored.map === "string" && parse_map_code(stored.map).ok ? stored.map : null,
    route: typeof stored.route === "string" && stored.route.length <= MAX_NAME ? stored.route : d.route,
    rivals: whole(stored.rivals, 1, MAX_RIVALS, d.rivals),
    format: among(stored.format, Object.values(RaceFormat), d.format),
    laps: whole(stored.laps, 0, MAX_LAPS, d.laps),
    minutes: among(stored.minutes, TIMES, d.minutes),
    difficulty: among(stored.difficulty, Object.values(Difficulty), d.difficulty),
    temperament: among(stored.temperament, Object.values(Temperament), d.temperament),
    mistakes: whole(stored.mistakes, LEVEL_MIN, LEVEL_MAX, d.mistakes),
    limits: typeof stored.limits === "boolean" ? stored.limits : d.limits,
    slipstream: typeof stored.slipstream === "boolean" ? stored.slipstream : d.slipstream,
    grid: whole(stored.grid, 0, MAX_RIVALS, d.grid),
    cars: among(stored.cars, [RivalPick.CLASS, RivalPick.ANY, RivalPick.PICKED], d.cars),
    picked: Array.isArray(stored.picked) ? stored.picked.filter((name): name is string => typeof name === "string" && name.length <= MAX_NAME).slice(0, MAX_RIVALS) : d.picked,
  };
}

export const grid_of = (setup: CustomRace) => Math.min(setup.grid, setup.rivals);

export function custom_map(setup: CustomRace): MapSpec | null {
  const read = setup.map === null ? null : parse_map_code(setup.map);
  return read?.ok ? read.map : null;
}

/** The map this setup has to load first; null when it races `here`. */
export function custom_travel(setup: CustomRace, here: MapSpec): MapSpec | null {
  const map = custom_map(setup);
  return map && map_code(map) !== map_code(here) ? map : null;
}

/** Routes differ per map: a setup kept from another map races the first circuit here. */
export const custom_route = <T extends { id: string }>(routes: readonly T[], id: string): T | null => routes.find((route) => route.id === id) ?? routes[0] ?? null;

export const rival_cars = (setup: CustomRace): RivalCars => (setup.cars === RivalPick.PICKED ? { pick: setup.cars, presets: setup.picked } : { pick: setup.cars });

export type CustomBase = Pick<FieldHost, "sim" | "build" | "rating" | "autopilot">;

export function custom_host(base: CustomBase, setup: CustomRace, name: string, next: FieldEvent["next"]): FieldHost {
  const event: FieldEvent = {
    name,
    names: [],
    knockout: setup.format === RaceFormat.KNOCKOUT,
    limit_ms: setup.format === RaceFormat.TIMED ? setup.minutes * MINUTE_MS : null,
    grid: grid_of(setup),
    laps: setup.laps || undefined,
    rules: setup.limits ? RACE_RULES : NO_LIMITS,
    slipstream: setup.slipstream,
    finish: () => [],
    next,
  };
  const levels = TEMPERS[setup.temperament];
  return { ...base, cars: Array.from({ length: setup.rivals }, (_, i) => ({ aggression: levels[i % levels.length], mistakes: setup.mistakes })), difficulty: () => setup.difficulty, rivals: rival_cars(setup), event };
}

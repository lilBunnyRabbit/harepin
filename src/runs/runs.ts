import { CarClass } from "../car/pi";
import { PRESETS } from "../car/presets";
import { mulberry32, seed_of } from "../rng";
import type { Thresholds } from "../modes/track";
import { WorldKind } from "../worldgen/types";

// Pure on purpose: the boot entry picks the run's world from the URL before any kind or mode loads.

export const RUN_PARAM = "run";

export const RunSource = {
  DAILY: "daily",
  WEEKLY: "weekly",
  RANDOM: "random",
  CUSTOM: "custom",
} as const;
export type RunSource = (typeof RunSource)[keyof typeof RunSource];

export const RunType = {
  RACE: "race",
  DRIFT: "drift",
  CHAIN: "chain",
  TRAP: "trap",
  JUMP: "jump",
  HUNT: "hunt",
  GYMKHANA: "gymkhana",
  PARKING: "parking",
  DUEL: "duel",
} as const;
export type RunType = (typeof RunType)[keyof typeof RunType];

export const Difficulty = {
  RELAXED: "relaxed",
  NORMAL: "normal",
  HARD: "hard",
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

/** Lap counts the builder offers; more than one keeps a race on the map's closed circuits. */
export const LAPS = [1, 2, 3, 5] as const;
const CIRCUITS = ["circuit", "circuit-rev"];

export const DIFFICULTY_SCALE: Record<Difficulty, number> = { relaxed: 1.15, normal: 1, hard: 0.9 };

export interface RunChoice {
  readonly id: string;
  readonly label: string;
  readonly levels?: readonly string[];
  /** Race length in metres: route lengths differ per world, so the band is read off the built map. */
  readonly band?: readonly [number, number];
}

export interface RunTypeDef {
  readonly id: RunType;
  readonly name: string;
  readonly mode: string;
  readonly levels: readonly string[];
  readonly choice: { readonly label: string; readonly options: readonly RunChoice[] } | null;
  /** Kinds it runs on every seed, vetted by `scripts/runs-check.ts`. */
  readonly kinds: readonly WorldKind[];
  readonly caps: readonly CarClass[];
}

const { ISLAND, SKY, DESERT, ALPINE, TUNDRA, VOLCANO, ICE_CANYON, MAINLAND } = WorldKind;
const COMPACT: readonly WorldKind[] = [ISLAND, SKY, DESERT, ALPINE, TUNDRA, VOLCANO, ICE_CANYON];
const GROUND: readonly WorldKind[] = [ISLAND, DESERT, ALPINE, TUNDRA, VOLCANO, ICE_CANYON];
const ROAD_CAPS: readonly CarClass[] = [CarClass.C, CarClass.B, CarClass.A, CarClass.S1, CarClass.S2];
const TIGHT_CAPS: readonly CarClass[] = [CarClass.C, CarClass.B, CarClass.A, CarClass.S1];

const LENGTH = "Length";
const lengths = (short: readonly string[], medium: readonly string[], long: readonly string[]) => ({
  label: LENGTH,
  options: [
    { id: "short", label: "Short", levels: short },
    { id: "medium", label: "Medium", levels: medium },
    { id: "long", label: "Long", levels: long },
  ],
});

export const RUN_TYPES: readonly RunTypeDef[] = [
  {
    id: RunType.RACE,
    name: "Race",
    mode: "race",
    levels: ["circuit", "circuit-rev", "sprint", "trip", "street-1", "street-2", "offroad-1", "offroad-2", "descent", "banked"],
    choice: {
      label: LENGTH,
      options: [
        { id: "short", label: "Short", band: [0, 2000] },
        { id: "medium", label: "Medium", band: [2000, 3500] },
        { id: "long", label: "Long", band: [3500, Infinity] },
      ],
    },
    kinds: [...COMPACT, MAINLAND],
    caps: ROAD_CAPS,
  },
  { id: RunType.DRIFT, name: "Drift", mode: "drift", levels: ["d1", "d2", "d3", "d4", "d5"], choice: lengths(["d1", "d2"], ["d3"], ["d4", "d5"]), kinds: COMPACT, caps: TIGHT_CAPS },
  { id: RunType.CHAIN, name: "Drift chain", mode: "drift", levels: ["d6"], choice: null, kinds: COMPACT, caps: TIGHT_CAPS },
  { id: RunType.TRAP, name: "Speed trap", mode: "race", levels: ["trap"], choice: null, kinds: COMPACT, caps: ROAD_CAPS },
  {
    id: RunType.JUMP,
    name: "Jump",
    mode: "jump",
    levels: ["j1", "j2", "j3"],
    choice: {
      label: "Ramp",
      options: [
        { id: "kicker", label: "Kicker", levels: ["j1"] },
        { id: "big", label: "Big air", levels: ["j2"] },
        { id: "road", label: "Road kicker", levels: ["j3"] },
      ],
    },
    kinds: [ISLAND, DESERT, ALPINE, TUNDRA, VOLCANO, ICE_CANYON],
    caps: ROAD_CAPS,
  },
  { id: RunType.HUNT, name: "Gate hunt", mode: "hunt", levels: ["h1", "h2", "h3", "h4", "h5"], choice: lengths(["h1", "h2"], ["h3"], ["h4", "h5"]), kinds: GROUND, caps: ROAD_CAPS },
  { id: RunType.GYMKHANA, name: "Gymkhana", mode: "gymkhana", levels: ["g1", "g2", "g3", "g4", "g5", "g6", "g7"], choice: null, kinds: [ISLAND, DESERT, ALPINE, TUNDRA, ICE_CANYON], caps: TIGHT_CAPS },
  { id: RunType.PARKING, name: "Parking", mode: "parking", levels: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"], choice: null, kinds: GROUND, caps: TIGHT_CAPS },
  { id: RunType.DUEL, name: "Ghost duel", mode: "duel", levels: ["v1", "v2", "v3", "v4", "v5"], choice: lengths(["v1", "v2"], ["v3"], ["v4", "v5"]), kinds: COMPACT, caps: ROAD_CAPS },
];

export const type_of = (id: RunType): RunTypeDef => RUN_TYPES.find((type) => type.id === id) ?? RUN_TYPES[0];

export type RunCar = { cap: CarClass } | { preset: string };

/** The event builder's picks; null leaves a choice to the dice. */
export interface RunOptions {
  type: RunType | null;
  kind: WorldKind | null;
  choice: string | null;
  difficulty: Difficulty;
  car: RunCar | null;
  /** Race only. */
  laps: number;
}

export const ANY_OPTIONS: RunOptions = { type: null, kind: null, choice: null, difficulty: Difficulty.NORMAL, car: null, laps: 1 };

/** One stage of a weekly: a type and its levels in the order tried, as a daily picks them. */
export interface RunStage {
  readonly type: RunType;
  readonly levels: readonly string[];
}

export interface RunPick {
  readonly id: string;
  readonly source: RunSource;
  /** A daily's UTC date, a weekly's ISO week (`2026-W46`). */
  readonly date: string | null;
  readonly type: RunType;
  readonly kind: WorldKind;
  readonly seed: number;
  /** The type's levels in the order tried, the option's first: the first the map has is played. */
  readonly levels: readonly string[];
  readonly band: readonly [number, number] | null;
  readonly car: RunCar;
  readonly difficulty: Difficulty;
  readonly laps: number;
  /** A weekly's championship stages on the one map, the first also in `type` and `levels`; null for a single run. */
  readonly stages: readonly RunStage[] | null;
}

const SEEDS = 1_000_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const ANY = "any";

export const utc_date = (now: Date): string => now.toISOString().slice(0, 10);

const WEEK = /^(\d{4})-W(\d{2})$/;

/** The ISO week a UTC date falls in, `2026-W46`: weeks start on Monday, and week 1 holds the year's first Thursday. */
export function iso_week(date: string): string {
  const at = Date.parse(`${date}T00:00:00Z`);
  const monday_based = (new Date(at).getUTCDay() + 6) % 7;
  const thursday = new Date(at + (3 - monday_based) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week = 1 + Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** The Monday an ISO week starts on; null for a week that doesn't exist (`2025-W53`). */
export function week_start(week: string): string | null {
  const match = WEEK.exec(week);
  if (!match) return null;
  const year = Number(match[1]);
  const jan4 = Date.UTC(year, 0, 4);
  const monday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY_MS + (Number(match[2]) - 1) * 7 * DAY_MS;
  const start = utc_date(new Date(monday));
  return iso_week(start) === week ? start : null;
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const draw = <T>(items: readonly T[], rng: () => number): T => items[Math.floor(rng() * items.length)];

function roll(options: RunOptions, rng: () => number): Omit<RunPick, "id" | "source" | "date" | "stages"> {
  // A world picked with the type left to the dice draws only types that run there.
  const hosts = options.kind ? RUN_TYPES.filter((t) => options.kind !== null && t.kinds.includes(options.kind)) : RUN_TYPES;
  const rolled_type = draw(hosts.length ? hosts : RUN_TYPES, rng).id;
  const type = type_of(options.type ?? rolled_type);
  const rolled_kind = draw(type.kinds, rng);
  const kind = options.kind && type.kinds.includes(options.kind) ? options.kind : rolled_kind;
  const seed = 1 + Math.floor(rng() * (SEEDS - 1));
  const choice = type.choice?.options.find((option) => option.id === options.choice) ?? null;
  const order = shuffled(type.levels, rng);
  // The choice's levels go first; the type's others stand in on a map without them.
  const narrowed = choice?.levels ? [...order.filter((level) => choice.levels?.includes(level)), ...order.filter((level) => !choice.levels?.includes(level))] : order;
  const cap = draw(type.caps, rng);
  const laps = type.id === RunType.RACE ? options.laps : 1;
  const levels = laps > 1 ? narrowed.filter((level) => CIRCUITS.includes(level)) : narrowed;
  return { type: type.id, kind, seed, levels, band: choice?.band ?? null, car: options.car ?? { cap }, difficulty: options.difficulty, laps };
}

export function daily(date: string): RunPick {
  return { id: `${RunSource.DAILY}:${date}`, source: RunSource.DAILY, date, stages: null, ...roll(ANY_OPTIONS, mulberry32(seed_of(`daily:${date}`))) };
}

/** Stages a weekly runs, as the championship runner takes them (`MIN_STAGES`, `MAX_STAGES` in modes/championship.ts). */
export const WEEKLY_STAGES = { min: 3, max: 5 } as const;

/** A week's championship: one map, 3-5 types that run on its kind, each with its levels shuffled, one car rule for all. */
export function weekly(week: string): RunPick {
  const rng = mulberry32(seed_of(`weekly:${week}`));
  const kind = draw(COMPACT, rng);
  const seed = 1 + Math.floor(rng() * (SEEDS - 1));
  const count = WEEKLY_STAGES.min + Math.floor(rng() * (WEEKLY_STAGES.max - WEEKLY_STAGES.min + 1));
  const types = shuffled(
    RUN_TYPES.filter((type) => type.kinds.includes(kind)),
    rng,
  ).slice(0, count);
  const stages = types.map((type) => ({ type: type.id, levels: shuffled(type.levels, rng) }));
  const caps = ROAD_CAPS.filter((cap) => types.every((type) => type.caps.includes(cap)));
  const cap = draw(caps, rng);
  return {
    id: `${RunSource.WEEKLY}:${week}`,
    source: RunSource.WEEKLY,
    date: week,
    type: stages[0].type,
    kind,
    seed,
    levels: stages[0].levels,
    band: null,
    car: { cap },
    difficulty: Difficulty.NORMAL,
    laps: 1,
    stages,
  };
}

export function random(seed: number): RunPick {
  return { id: `${RunSource.RANDOM}:${seed.toString(36)}`, source: RunSource.RANDOM, date: null, stages: null, ...roll(ANY_OPTIONS, mulberry32(seed)) };
}

export function custom(options: RunOptions, seed: number): RunPick {
  return { id: `${RunSource.CUSTOM}:${options_code(options, seed)}`, source: RunSource.CUSTOM, date: null, stages: null, ...roll(options, mulberry32(seed)) };
}

export const new_seed = () => Math.floor(Math.random() * SEEDS);

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const CAPS = Object.values(CarClass) as string[];

export function car_code(car: RunCar | null): string {
  if (!car) return ANY;
  return "cap" in car ? car.cap : `p-${slug(car.preset)}`;
}

export function parse_car(text: string): RunCar | null | undefined {
  if (text === ANY) return null;
  if (CAPS.includes(text)) return { cap: text as CarClass };
  const preset = PRESETS.find((p) => `p-${slug(p.name)}` === text);
  return preset ? { preset: preset.name } : undefined;
}

/** `type.kind.choice.laps.difficulty.car.seed`: what a custom run's link carries, so a friend gets the same map and event. */
export function options_code(options: RunOptions, seed: number): string {
  return [options.type ?? ANY, options.kind ?? ANY, options.choice ?? ANY, options.laps, options.difficulty, car_code(options.car), seed.toString(36)].join(".");
}

export function parse_options(code: string): { options: RunOptions; seed: number } | null {
  const parts = code.split(".");
  if (parts.length !== 7) return null;
  const [type, kind, choice, laps_text, difficulty, car, seed_text] = parts;
  const laps = Number(laps_text);
  if (!(LAPS as readonly number[]).includes(laps)) return null;
  const def = RUN_TYPES.find((t) => t.id === type);
  if (type !== ANY && !def) return null;
  if (kind !== ANY && !(Object.values(WorldKind) as string[]).includes(kind)) return null;
  if (choice !== ANY && !def?.choice?.options.some((option) => option.id === choice)) return null;
  if (!(Object.values(Difficulty) as string[]).includes(difficulty)) return null;
  const rule = parse_car(car);
  const seed = parseInt(seed_text, 36);
  if (rule === undefined || !/^[0-9a-z]+$/.test(seed_text) || !Number.isSafeInteger(seed)) return null;
  return {
    options: { type: def?.id ?? null, kind: kind === ANY ? null : (kind as WorldKind), choice: choice === ANY ? null : choice, difficulty: difficulty as Difficulty, car: rule, laps },
    seed,
  };
}

// Date.parse rolls 2026-02-30 over to March: only a date that reads back as itself is one.
function real_date(text: string): boolean {
  if (!DATE.test(text)) return false;
  const at = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && utc_date(at) === text;
}

export function run_of(param: string | null): RunPick | null {
  if (!param) return null;
  const at = param.indexOf(":");
  if (at < 0) return null;
  const source = param.slice(0, at);
  const rest = param.slice(at + 1);
  if (source === RunSource.DAILY) return real_date(rest) ? daily(rest) : null;
  if (source === RunSource.WEEKLY) return week_start(rest) ? weekly(rest) : null;
  if (source === RunSource.RANDOM) {
    const seed = parseInt(rest, 36);
    return /^[0-9a-z]+$/.test(rest) && Number.isSafeInteger(seed) ? random(seed) : null;
  }
  if (source === RunSource.CUSTOM) {
    const read = parse_options(rest);
    return read && custom(read.options, read.seed);
  }
  return null;
}

/** What the built map offers a run: the levels a mode can start there, and a route's length. */
export interface RunProbe {
  levels(mode: string): readonly string[];
  length(level: string): number | null;
}

export interface Resolved {
  mode: string;
  level: string;
  /** The type found nothing on this map, so the run is the map's circuit race, which every compact kind has. */
  fallback: boolean;
}

export const FALLBACK = { mode: "race", level: "circuit" } as const;

/**
 * A weekly's stages on the built map, one per planned stage. One that finds no level becomes the circuit race, or is
 * dropped (null) when the cup already has it; `scripts/runs-check.ts` counts both over coming weeks.
 */
export function resolve_stages(pick: RunPick, probe: RunProbe): (Resolved | null)[] {
  const out: (Resolved | null)[] = [];
  for (const stage of pick.stages ?? [pick]) {
    const got = resolve({ ...pick, type: stage.type, levels: stage.levels, stages: null }, probe);
    out.push(out.some((have) => have?.mode === got.mode && have.level === got.level) ? null : got);
  }
  return out;
}

export const played = (stages: readonly (Resolved | null)[]): Resolved[] => stages.filter((stage) => stage !== null);

const off_band = (length: number | null, [low, high]: readonly [number, number]) => (length === null ? Infinity : length < low ? low - length : length > high ? length - high : 0);

export function resolve(pick: RunPick, probe: RunProbe): Resolved {
  const { mode } = type_of(pick.type);
  const have = probe.levels(mode);
  const found = pick.levels.filter((level) => have.includes(level));
  const { band, laps } = pick;
  const total = (level: string) => {
    const length = probe.length(level);
    return length === null ? null : length * laps;
  };
  // No map is rebuilt for a length: the route nearest the band stands in when none falls inside it. Laps count in it.
  if (band) found.sort((a, b) => off_band(total(a), band) - off_band(total(b), band));
  return found.length ? { mode, level: found[0], fallback: false } : { ...FALLBACK, fallback: true };
}

/** A mode's own marks eased or tightened: times stretch by the scale, points (higher is better) shrink by it. */
export function scale(own: Thresholds, difficulty: Difficulty): Thresholds {
  const by = DIFFICULTY_SCALE[difficulty];
  if (by === 1) return own;
  const points = own.three > own.two;
  return points ? { two: own.two / by, three: own.three / by } : { two: own.two * by, three: own.three * by };
}

const DAY_MS = 86_400_000;
export const SEASON_DAYS = 28;
const SEASON_EPOCH = Date.UTC(1970, 0, 5);

/** The UTC date a 4-week season starts on; it names the season. */
export function season_of(date: string): string {
  const days = Math.floor((Date.parse(date) - SEASON_EPOCH) / DAY_MS);
  return utc_date(new Date(SEASON_EPOCH + Math.floor(days / SEASON_DAYS) * SEASON_DAYS * DAY_MS));
}

// Seasons count from the one Runs shipped in.
const FIRST_SEASON = Date.UTC(2026, 9, 26);

/** A season's number for titles, 1 for the first: `season` is a `season_of` date. */
export const season_number = (season: string): number => Math.round((Date.parse(season) - FIRST_SEASON) / (SEASON_DAYS * DAY_MS)) + 1;

export function season_days_left(date: string): number {
  return SEASON_DAYS - Math.round((Date.parse(date) - Date.parse(season_of(date))) / DAY_MS);
}

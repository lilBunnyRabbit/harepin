import { Difficulty } from "../ai/difficulty";
import type { FieldCar } from "../ai/field";
import { is_field, SLOTS, type Mod, type Slot } from "../car/build";
import { CARS, is_car, type CarSpec } from "../car/cars";
import { SteerMode } from "../car/car";
import { StationId } from "../worldgen/lab";
import { MAP_CODE_MAX } from "../worldgen/kinds/map-code";
import { resolve_pack, type Aids, type Goal, type LabCar, type Pack, type Question, type RaceTrial, type RouteTrial, type StationTrial, type Trial, type TrialField } from "./pack";

/** `?lab=~<code>`: the pack itself rides in the link, so a new test needs no deploy. */
export const INLINE = "~";
const MAX_CODE = 32_000;
const MAX_TEXT = 300;
const MAX_LIST = 60;
const SPECS: readonly unknown[] = Object.values(CARS);

const fail = (path: string, why: string): never => {
  throw new Error(`pack ${path}: ${why}`);
};

type Obj = Record<string, unknown>;
const is_obj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function obj(v: unknown, path: string): Obj {
  return is_obj(v) ? v : fail(path, "not an object");
}

function text(v: unknown, path: string, max = MAX_TEXT): string {
  return typeof v === "string" && v.length <= max ? v : fail(path, `not a string of at most ${max} characters`);
}

function num(v: unknown, path: string): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fail(path, "not a finite number");
}

function list<T>(v: unknown, path: string, item: (v: unknown, path: string) => T): T[] {
  if (!Array.isArray(v) || v.length > MAX_LIST) fail(path, `not a list of at most ${MAX_LIST}`);
  return (v as unknown[]).map((x, i) => item(x, `${path}[${i}]`));
}

function opt<T>(o: Obj, key: string, path: string, read: (v: unknown, path: string) => T): T | undefined {
  return o[key] === undefined ? undefined : read(o[key], `${path}.${key}`);
}

/** Optional spec numbers no shipped car sets yet, so no sample shows them: a lab car may still tune them. */
const UNSET_SPEC: readonly (keyof CarSpec)[] = ["drift_damp", "drift_rear_bite", "drift_side_sx", "drift_reach", "drift_catch", "drift_tcs_off", "tcs_lateral", "tcs_turn_slip"];
const UNSET_NUMBERS: ReadonlySet<string> = new Set(UNSET_SPEC.map((key) => `spec.${key}`));

/**
 * A value shaped like the `samples` (every shipped spec at this path): same keys, same types, numbers finite, and a
 * string only one some car already uses, so a lab spec can never carry a drive or sound kind the physics doesn't know.
 */
function like(v: unknown, samples: readonly unknown[], path: string, free: ReadonlySet<string>) {
  const first = samples[0];
  if (typeof first === "number") return num(v, path);
  if (typeof first === "boolean") return typeof v === "boolean" || fail(path, "not a boolean");
  if (typeof first === "string") return free.has(path) ? text(v, path) : samples.includes(v) || fail(path, `not one of ${[...new Set(samples)].join(", ")}`);
  if (Array.isArray(first)) {
    if (!Array.isArray(v) || v.length > 64) fail(path, "not a list");
    const items = samples.flatMap((s) => s as unknown[]);
    (v as unknown[]).forEach((x, i) => like(x, items, `${path}[${i}]`, free));
    return;
  }
  const o = obj(v, path);
  const shapes = samples.filter(is_obj);
  for (const key of Object.keys(o)) {
    const at = shapes.filter((s) => key in s && s[key] !== undefined).map((s) => s[key]);
    if (!at.length && UNSET_NUMBERS.has(`${path}.${key}`)) num(o[key], `${path}.${key}`);
    else if (!at.length) fail(`${path}.${key}`, "is not a car spec field");
    else like(o[key], at, `${path}.${key}`, free);
  }
  for (const key of Object.keys(shapes[0])) if (shapes.every((s) => key in s) && !(key in o)) fail(`${path}.${key}`, "missing");
}

const FREE = new Set(["spec.id", "spec.name"]);

function lab_car(v: unknown, path: string): LabCar {
  const o = obj(v, path);
  like(o.spec, SPECS, "spec", FREE);
  const look = text(o.look, `${path}.look`);
  if (!is_car(look)) fail(`${path}.look`, `not a body, expected one of ${Object.keys(CARS).join(", ")}`);
  const parts = opt(o, "parts", path, (p, at) => {
    const out: Partial<Record<Slot, number>> = {};
    for (const [slot, n] of Object.entries(obj(p, at))) {
      if (!(slot in SLOTS)) fail(`${at}.${slot}`, "not a slot");
      const count = SLOTS[slot as Slot].parts.length;
      if (!Number.isInteger(n) || (n as number) < 0 || (n as number) >= count) fail(`${at}.${slot}`, `not a part 0-${count - 1}`);
      out[slot as Slot] = n as number;
    }
    return out;
  });
  return { name: text(o.name, `${path}.name`), spec: o.spec as LabCar["spec"], look: look as LabCar["look"], ...(parts ? { parts } : {}) };
}

function mod(v: unknown, path: string): Mod {
  const o = obj(v, path);
  const fields = (f: unknown, at: string) => {
    const out: Record<string, number> = {};
    for (const [field, n] of Object.entries(obj(f, at))) {
      if (!is_field(CARS.hatch, field)) fail(`${at}.${field}`, "not a part field");
      out[field] = num(n, `${at}.${field}`);
    }
    return out;
  };
  for (const key of Object.keys(o)) if (key !== "scale" && key !== "add") fail(`${path}.${key}`, "a mod has only scale and add");
  return { ...(o.scale ? { scale: fields(o.scale, `${path}.scale`) } : {}), ...(o.add ? { add: fields(o.add, `${path}.add`) } : {}) };
}

const AID_FLAGS = ["tcs", "abs", "assist", "stability", "auto"] as const;

function aids(v: unknown, path: string): Aids {
  const o = obj(v, path);
  const out: Aids = {};
  for (const [key, value] of Object.entries(o)) {
    if (key === "steer_mode") {
      const mode = Object.values(SteerMode).find((m) => m === value);
      out.steer_mode = mode ?? fail(`${path}.steer_mode`, `not one of ${Object.values(SteerMode).join(", ")}`);
    } else if ((AID_FLAGS as readonly string[]).includes(key) && typeof value === "boolean") out[key as (typeof AID_FLAGS)[number]] = value;
    else fail(`${path}.${key}`, "not an aid");
  }
  return out;
}

function goal(v: unknown, path: string): Goal {
  const o = obj(v, path);
  if (o.kind === "laps") return { kind: "laps", laps: num(o.laps, `${path}.laps`) };
  if (o.kind === "time") return { kind: "time", seconds: num(o.seconds, `${path}.seconds`) };
  if (o.kind === "stop") return { kind: "stop", from_kmh: num(o.from_kmh, `${path}.from_kmh`) };
  if (o.kind === "run" || o.kind === "free" || o.kind === "race") return { kind: o.kind };
  return fail(`${path}.kind`, "not laps, time, stop, run, free or race");
}

function question(v: unknown, path: string): Question {
  const o = obj(v, path);
  const id = text(o.id, `${path}.id`, 20);
  const label = text(o.label, `${path}.label`);
  if (o.kind === "scale") return { kind: "scale", id, label, low: text(o.low, `${path}.low`), high: text(o.high, `${path}.high`) };
  if (o.kind === "pick") return { kind: "pick", id, label, options: list(o.options, `${path}.options`, (x, at) => text(x, at, 40)) };
  if (o.kind === "text") return { kind: "text", id, label };
  return fail(`${path}.kind`, "not scale, pick or text");
}

const LEVELS = [1, 2, 3, 4, 5];

function level(v: unknown, path: string): number {
  return LEVELS.includes(v as number) ? (v as number) : fail(path, `not one of ${LEVELS.join(", ")}`);
}

function field_car(v: unknown, path: string): FieldCar {
  const o = obj(v, path);
  return { aggression: level(o.aggression, `${path}.aggression`), mistakes: level(o.mistakes, `${path}.mistakes`) };
}

function field(v: unknown, path: string): TrialField {
  const o = obj(v, path);
  const difficulty = opt(o, "difficulty", path, (d, at) => Object.values(Difficulty).find((x) => x === d) ?? fail(at, `not one of ${Object.values(Difficulty).join(", ")}`));
  return { cars: list(o.cars, `${path}.cars`, field_car), ...(difficulty ? { difficulty } : {}) };
}

/** A race or route trial names its map (a race its field too), a station trial its station; never both. A route trial drives laps. */
function place(o: Obj, path: string, at_goal: Goal): Pick<StationTrial, "station" | "lane" | "goal"> | Pick<RaceTrial, "map" | "route" | "field" | "goal"> | Pick<RouteTrial, "map" | "route" | "goal"> {
  if (o.map !== undefined) {
    if (o.station !== undefined || o.lane !== undefined) fail(`${path}.station`, "a race or route trial has a map, not a station");
    const route = opt(o, "route", path, (r, at) => text(r, at, 40));
    const on_map = { map: text(o.map, `${path}.map`, MAP_CODE_MAX), ...(route !== undefined ? { route } : {}) };
    if (o.field !== undefined) return { ...on_map, field: field(o.field, `${path}.field`), goal: at_goal };
    return at_goal.kind === "laps" ? { ...on_map, goal: at_goal } : fail(`${path}.goal`, "a route trial (a map and no field) drives laps");
  }
  const station = text(o.station, `${path}.station`);
  const id = Object.values(StationId).find((s) => s === station) ?? fail(`${path}.station`, `not one of ${Object.values(StationId).join(", ")}`);
  const lane = opt(o, "lane", path, (l, at) => text(l, at, 40));
  return { station: id, ...(lane !== undefined ? { lane } : {}), goal: at_goal };
}

function trial(v: unknown, path: string): Trial {
  const o = obj(v, path);
  const mods = opt(o, "mods", path, (m, at) => list(m, at, mod));
  const trial_aids = opt(o, "aids", path, aids);
  const ask = opt(o, "ask", path, (q, at) => list(q, at, question));
  return {
    id: text(o.id, `${path}.id`, 40),
    car: text(o.car, `${path}.car`, 60),
    ...(mods ? { mods } : {}),
    ...(trial_aids ? { aids: trial_aids } : {}),
    ...place(o, path, goal(o.goal, `${path}.goal`)),
    try: text(o.try, `${path}.try`),
    feel: text(o.feel, `${path}.feel`),
    ...(o.question !== undefined ? { question: text(o.question, `${path}.question`) } : {}),
    ...(ask ? { ask } : {}),
    ...(o.base === true ? { base: true as const } : {}),
  };
}

/** Untrusted input to a `Pack`: throws with the first thing wrong, including any trial that does not resolve. */
export function read_pack(v: unknown): Pack {
  const o = obj(v, "pack");
  const cars = opt(o, "cars", "pack", (c, at) => Object.fromEntries(Object.entries(obj(c, at)).map(([key, car]) => [text(key, `${at} key`, 30), lab_car(car, `${at}.${key}`)])));
  const pack: Pack = {
    id: text(o.id, "pack.id", 40),
    rev: num(o.rev, "pack.rev"),
    title: text(o.title, "pack.title"),
    brief: text(o.brief, "pack.brief"),
    ...(o.aim !== undefined ? { aim: text(o.aim, "pack.aim") } : {}),
    ...(cars ? { cars } : {}),
    trials: list(o.trials, "pack.trials", trial),
    ask: list(o.ask, "pack.ask", question),
    ...(o.blind === true ? { blind: true } : {}),
  };
  resolve_pack(pack);
  return pack;
}

const to_base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

function from_base64url(code: string): Uint8Array {
  const raw = atob(code.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** `~` and the pack's JSON as base64url: what `?lab=` takes for a pack not in the repo. */
export const pack_code = (pack: Pack): string => INLINE + to_base64url(new TextEncoder().encode(JSON.stringify(pack)));

export function read_code(code: string): Pack {
  if (!code.startsWith(INLINE) || code.length > MAX_CODE) fail("code", `not ${INLINE} and at most ${MAX_CODE} characters`);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(from_base64url(code.slice(INLINE.length))));
  } catch (error) {
    return fail("code", `does not decode (${error instanceof Error ? error.message : String(error)})`);
  }
  return read_pack(json);
}

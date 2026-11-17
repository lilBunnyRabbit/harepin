import { DEFAULT_BUILD, DEFAULT_PARTS, SLOT_NAMES, type Build } from "../car/build";
import { BUILDS_KEY, parse_builds } from "../car/builds";
import { DEFAULT_SETTINGS, type SettingKey } from "../menu/prefs";
import { SETTINGS_KEY } from "../menu/saved-pick";
import { parse_runs } from "../modes/track";
import { cached_records } from "../store/cached-store";
import { THEME_KEY } from "../theme/theme";
import { WorldKind } from "../worldgen/types";
import { GoalId, mode_part } from "./goals";

const BEST_PREFIX = "harepin:best:";
const SKY_MARK = ":sky";

/** The settings "Tune your handling" is about: the driving aids and how the wheel answers. */
export const HANDLING_KEYS: readonly SettingKey[] = ["tcs", "abs", "assist", "stability", "auto", "steer_mode", "touch_steer", "steer_sensitivity"];

export const is_handling = (key: SettingKey) => HANDLING_KEYS.includes(key);

function tuned(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const stored = raw as Record<string, unknown>;
  return HANDLING_KEYS.some((key) => key in stored && stored[key] !== DEFAULT_SETTINGS[key]);
}

export interface Now {
  kind: WorldKind;
  build: Build;
  cockpit: boolean;
}

function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn("goals: corrupt record ignored", error);
    return null;
  }
}

// The stock coupe was the starting car before 0.18; a save still holding it is no proof of a change.
const STARTS: readonly Build[] = [DEFAULT_BUILD, { ...DEFAULT_BUILD, car: "coupe", parts: DEFAULT_PARTS }];

export function build_goals(build: Build): GoalId[] {
  const ids: GoalId[] = [];
  if (STARTS.every((start) => build.car !== start.car)) ids.push(GoalId.CAR);
  if (build.car === "bus") ids.push(GoalId.BUS);
  if (STARTS.every((start) => SLOT_NAMES.some((slot) => build.parts[slot] !== start.parts[slot]))) ids.push(GoalId.TUNE);
  if (build.paint !== DEFAULT_BUILD.paint || build.decal !== DEFAULT_BUILD.decal || build.ink !== DEFAULT_BUILD.ink || build.number !== DEFAULT_BUILD.number) ids.push(GoalId.PAINT);
  return ids;
}

export function proven(saved: Iterable<[string, string]>, now: Now, mode_ids: readonly string[]): string[] {
  const ids = new Set<string>(build_goals(now.build));
  if (now.kind === WorldKind.SKY) ids.add(GoalId.SKY);
  if (now.cockpit) ids.add(GoalId.CAMERA);
  const seeds = new Set<string>();
  for (const [key, text] of saved) {
    if (key === BUILDS_KEY && parse_builds(json(text)).length) ids.add(GoalId.BUILD);
    if (key === THEME_KEY) ids.add(GoalId.THEME);
    if (key === SETTINGS_KEY && tuned(json(text))) ids.add(GoalId.HANDLING);
    let world: string | null = null;
    if (key.startsWith(BEST_PREFIX) && Number(json(text)) > 0) {
      ids.add(GoalId.LAP);
      world = key.slice(BEST_PREFIX.length);
    }
    for (const mode of mode_ids) {
      const prefix = `harepin:${mode}:`;
      if (!key.startsWith(prefix) || !Object.keys(parse_runs(json(text))).length) continue;
      ids.add(mode_part(mode));
      ids.add(GoalId.FLAG);
      world = key.slice(prefix.length);
    }
    if (world === null) continue;
    seeds.add(world.split(":")[0]);
    if (world.includes(SKY_MARK)) ids.add(GoalId.SKY);
  }
  if (seeds.size > 1) ids.add(GoalId.NEW_MAP);
  return [...ids];
}

/** The records in IndexedDB, then what still sits in localStorage (best laps, builds, settings). */
export function saved_entries(): [string, string][] {
  const records = [...(cached_records()?.entries() ?? [])];
  try {
    return [
      ...records,
      ...Object.keys(localStorage)
        .filter((key) => key.startsWith("harepin:"))
        .map((key): [string, string] => [key, localStorage.getItem(key) ?? ""]),
    ];
  } catch (error) {
    console.warn("goals: saved records unreadable", error);
    return records;
  }
}

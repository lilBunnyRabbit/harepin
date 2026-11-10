import { DEFAULT_BUILD, SLOT_NAMES, type Build } from "../car/build";
import { BUILDS_KEY, parse_builds } from "../car/builds";
import { parse_runs } from "../modes/track";
import { WorldKind } from "../worldgen/types";
import { GoalId, mode_part } from "./goals";

const BEST_PREFIX = "harepin:best:";
const SKY_MARK = ":sky";

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

export function build_goals(build: Build): GoalId[] {
  const ids: GoalId[] = [];
  if (build.car !== DEFAULT_BUILD.car) ids.push(GoalId.CAR);
  if (build.car === "bus") ids.push(GoalId.BUS);
  if (SLOT_NAMES.some((slot) => build.parts[slot] !== DEFAULT_BUILD.parts[slot])) ids.push(GoalId.TUNE);
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
    let world: string | null = null;
    if (key.startsWith(BEST_PREFIX) && Number(json(text)) > 0) {
      ids.add(GoalId.LAP);
      world = key.slice(BEST_PREFIX.length);
    }
    for (const mode of mode_ids) {
      const prefix = `harepin:${mode}:`;
      if (!key.startsWith(prefix) || !Object.keys(parse_runs(json(text))).length) continue;
      ids.add(mode_part(mode));
      world = key.slice(prefix.length);
    }
    if (world === null) continue;
    seeds.add(world.split(":")[0]);
    if (world.includes(SKY_MARK)) ids.add(GoalId.SKY);
  }
  if (seeds.size > 1) ids.add(GoalId.NEW_MAP);
  return [...ids];
}

export function saved_entries(): [string, string][] {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith("harepin:"))
      .map((key) => [key, localStorage.getItem(key) ?? ""]);
  } catch (error) {
    console.warn("goals: saved records unreadable", error);
    return [];
  }
}

import type { CareerEvent } from "../career/career";
import { line } from "../modes/result";
import { local_store, type Thresholds, type Track } from "../modes/track";
import type { World } from "../world/world";
import { map_code } from "../worldgen/kinds/map-code";
import { probe } from "./run-world";
import { FREE_CAP, run_track, type Runs } from "./runs-store";
import { RunSource, new_seed, random, resolve, scale, type_of, type RunPick } from "./runs";

/** A Runs pick as `Modes` plays it: an event's car rules, its own records, the mode's marks scaled, season stars on finish. */
export interface RunPlay {
  readonly event: CareerEvent;
  readonly track: Track;
  /** Laps of a closed route the race runs; 1 elsewhere. */
  readonly laps: number;
  grade(own: Thresholds): Thresholds;
  /** Records the finish; the lines it adds to the result card. */
  finish(stars: number): HTMLElement[];
  readonly next: { readonly label: string; go(): void } | null;
}

const SOURCE_NAMES: Record<RunSource, string> = { daily: "Daily", random: "Endless", custom: "Built run" };

export function run_name(pick: RunPick, fallback = false): string {
  const laps = pick.laps > 1 && !fallback ? ` · ${pick.laps} laps` : "";
  return `${SOURCE_NAMES[pick.source]} · ${fallback ? "Race" : type_of(pick.type).name}${laps}`;
}

export function run_play(pick: RunPick, world: World, runs: Runs, start_run: (id: string) => void): RunPlay {
  const resolved = resolve(pick, probe(world));
  const event: CareerEvent = {
    id: pick.id,
    name: run_name(pick, resolved.fallback),
    mode: resolved.mode,
    level: resolved.level,
    map: map_code({ kind: world.kind, seed: world.seed, levels: world.levels }),
    car: pick.car,
    tuned: world.key,
  };
  return {
    event,
    track: run_track(pick, resolved.level, local_store(), world.seed, world.kind, world.levels),
    laps: resolved.mode === "race" && world.routes.find((route) => route.id === resolved.level)?.closed ? pick.laps : 1,
    grade: (own) => scale(own, pick.difficulty),
    finish(stars) {
      if (stars < 1) return [];
      const { gain, capped } = runs.record(pick, stars);
      const total = `${runs.stars} ★`;
      return [line("season", gain ? `+${gain} ★ · ${total}` : capped ? `Today's ${FREE_CAP} ★ are in · ${total}` : total)];
    },
    next: pick.source === RunSource.RANDOM ? { label: "New run", go: () => start_run(random(new_seed()).id) } : null,
  };
}

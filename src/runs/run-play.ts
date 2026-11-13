import type { CareerEvent } from "../career/career";
import { line } from "../modes/result";
import { local_store, type Thresholds, type Track } from "../modes/track";
import type { World } from "../world/world";
import { world_key } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import { daily_key } from "./daily-board";
import { probe } from "./run-world";
import { FREE_CAP, run_track, type Runs } from "./runs-store";
import { RunSource, daily, new_seed, random, resolve, scale, type_of, type RunPick } from "./runs";

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

/** The board key of `date`'s daily before its map is built: the level is left open. */
export function daily_want(date: string): string {
  const { kind, seed } = daily(date);
  return daily_key(date, map_code({ kind, seed, levels: [] }), "", world_key(seed, kind));
}

export function run_play(pick: RunPick, world: World, runs: Runs, start_run: (id: string) => void): RunPlay {
  const resolved = resolve(pick, probe(world));
  const started = runs.today;
  const event: CareerEvent = {
    id: pick.id,
    name: run_name(pick, resolved.fallback),
    mode: resolved.mode,
    level: resolved.level,
    map: map_code({ kind: world.kind, seed: world.seed, levels: world.levels }),
    car: pick.car,
    tuned: world.key,
  };
  const track = run_track(pick, resolved.level, local_store(), world.seed, world.kind, world.levels);
  return {
    event,
    track,
    laps: resolved.mode === "race" && world.routes.find((route) => route.id === resolved.level)?.closed ? pick.laps : 1,
    grade: (own) => scale(own, pick.difficulty),
    finish(stars) {
      if (stars < 1) return [];
      const { gain, capped } = runs.record(pick, stars, started);
      const best = track.runs[resolved.level];
      if (pick.source === RunSource.DAILY && pick.date === runs.today && best) runs.post_daily({ k: daily_key(pick.date, event.map, resolved.level, world.key), ms: best.ms });
      const total = `${runs.stars} ★`;
      return [line("season", gain ? `+${gain} ★ · ${total}` : capped ? `Today's ${FREE_CAP} ★ are in · ${total}` : total)];
    },
    next: pick.source === RunSource.RANDOM ? { label: "New run", go: () => start_run(random(new_seed()).id) } : null,
  };
}

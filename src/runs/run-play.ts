import type { CareerEvent } from "../career/career";
import { CUP_RECORD, WEEK_STARS, week_stars } from "../modes/championship";
import { line, points_text } from "../modes/result";
import { local_store, type Thresholds, type Track } from "../modes/track";
import type { World } from "../world/world";
import { world_key } from "../worldgen/kinds/kinds";
import { map_code } from "../worldgen/kinds/map-code";
import { daily_key } from "./daily-board";
import { probe } from "./run-world";
import { FREE_CAP, run_track, type Runs } from "./runs-store";
import { RunSource, daily, new_seed, random, resolve, resolve_stages, scale, type_of, type RunPick } from "./runs";

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

const SOURCE_NAMES: Record<RunSource, string> = { daily: "Daily", weekly: "Weekly", random: "Endless", custom: "Built run" };

export function run_name(pick: RunPick, fallback = false): string {
  if (pick.stages) return `${SOURCE_NAMES[pick.source]} · Championship`;
  const laps = pick.laps > 1 && !fallback ? ` · ${pick.laps} laps` : "";
  return `${SOURCE_NAMES[pick.source]} · ${fallback ? "Race" : type_of(pick.type).name}${laps}`;
}

/** The board key of `date`'s daily before its map is built: the level is left open. */
export function daily_want(date: string): string {
  const { kind, seed } = daily(date);
  return daily_key(date, map_code({ kind, seed, levels: [] }), "", world_key(seed, kind));
}

export function run_play(pick: RunPick, world: World, runs: Runs, start_run: (id: string) => void): RunPlay {
  const here = probe(world);
  const stages = pick.stages ? resolve_stages(pick, here).map(({ mode, level }) => ({ mode, level })) : null;
  const resolved = stages ? { ...stages[0], fallback: false } : resolve(pick, here);
  const started = runs.today;
  const event: CareerEvent = {
    id: pick.id,
    name: run_name(pick, resolved.fallback),
    mode: resolved.mode,
    level: resolved.level,
    map: map_code({ kind: world.kind, seed: world.seed, levels: world.levels }),
    car: pick.car,
    tuned: world.key,
    ...(stages ? { stages } : {}),
  };
  const track = run_track(pick, stages?.map((stage) => stage.level) ?? [resolved.level], local_store(), world.seed, world.kind, world.levels);
  return {
    event,
    track,
    laps: resolved.mode === "race" && world.routes.find((route) => route.id === resolved.level)?.closed ? pick.laps : 1,
    grade: (own) => scale(own, pick.difficulty),
    finish(cup_stars) {
      if (cup_stars < 1) return [];
      // A weekly's season stars come off its best total, which the runner has just recorded.
      const points = stages ? (track.runs[CUP_RECORD]?.score ?? 0) : 0;
      const stars = stages ? week_stars(points, stages.length) : cup_stars;
      const { gain, capped } = runs.record(pick, stars, started);
      const best = track.runs[resolved.level];
      if (pick.source === RunSource.DAILY && pick.date === runs.today && best) runs.post_daily({ k: daily_key(pick.date, event.map, resolved.level, world.key), ms: best.ms, ...(best.score === undefined ? {} : { score: best.score }) });
      const total = `${runs.stars} ★`;
      const season = line("season", gain ? `+${gain} ★ · ${total}` : capped ? `Today's ${FREE_CAP} ★ are in · ${total}` : total);
      return stages ? [line("week", `${stars} / ${WEEK_STARS} ★ · best ${points_text(points)}`), season] : [season];
    },
    next: pick.source === RunSource.RANDOM ? { label: "New run", go: () => start_run(random(new_seed()).id) } : null,
  };
}

import { COUPE } from "../../src/car/cars";
import { at_difficulty, Difficulty } from "../../src/ai/difficulty";
import { Field, personalities } from "../../src/ai/field";
import { World } from "../../src/world/world";
import { circuits, FIELD_SLACK, spearman } from "../ai-race";
import { autolap, DT } from "../autolap";
import { apply, type Values } from "./params";

declare const self: Worker;

export type TuneJob = { type: "auto"; id: string; seed: number } | { type: "race"; id: string; seed: number; values: Values; cars: number; laps: number };

export interface RaceResult {
  route: string;
  /** Mean finished lap (s) over the field; NaN when no car finished. */
  lap: number;
  stuck: boolean;
  contacts: number;
  overtakes: number;
  spins: number;
  resets: number;
  reverses: number;
  hardest: number;
  rho: number;
}

export type TuneResult = { type: "auto"; id: string; seed: number; laps: Record<string, number> } | { type: "race"; id: string; seed: number; races: RaceResult[] };

function autolaps(seed: number): Record<string, number> {
  const world = new World(seed);
  const out: Record<string, number> = {};
  for (const route of circuits(world)) {
    if (route.excludes?.includes(COUPE.id)) continue;
    const unplace = world.place(route.closure);
    out[route.id] = autolap(world, COUPE, [...route.points, route.points[0]], false).t;
    unplace();
  }
  return out;
}

function races(seed: number, cars: number, laps: number): RaceResult[] {
  const world = new World(seed);
  const out: RaceResult[] = [];
  for (const route of circuits(world)) {
    if (route.excludes?.includes(COUPE.id)) continue;
    const unplace = world.place(route.closure);
    const field = new Field(world, route, Array.from({ length: cars }, () => COUPE), at_difficulty(personalities(seed, cars), Difficulty.NORMAL), seed);
    let plan = 0;
    for (let i = 0; i < field.line.step.length; i++) plan += field.line.step[i] / field.line.speed[i];
    const all = field.run(DT, laps, plan * laps * FIELD_SLACK + 30);
    unplace();
    const rs = field.racers;
    const order = rs.map((_, k) => k).sort((a, b) => rs[a].stats.finish - rs[b].stats.finish || rs[b].driver.progress - rs[a].driver.progress);
    const done = rs.filter((r) => Number.isFinite(r.stats.finish));
    const sum = (f: (r: (typeof rs)[number]) => number) => rs.reduce((s, r) => s + f(r), 0);
    out.push({
      route: route.id,
      lap: done.length ? done.reduce((s, r) => s + r.stats.finish, 0) / done.length / laps : NaN,
      stuck: !all,
      contacts: sum((r) => r.stats.contacts) / 2,
      overtakes: sum((r) => r.stats.overtakes),
      spins: sum((r) => r.stats.spins),
      resets: sum((r) => r.stats.resets),
      reverses: sum((r) => r.stats.reverses),
      hardest: Math.max(...rs.map((r) => r.stats.hardest)),
      rho: spearman(order),
    });
  }
  return out;
}

self.onmessage = (event: MessageEvent<TuneJob>) => {
  const job = event.data;
  if (job.type === "auto") {
    postMessage({ type: "auto", id: job.id, seed: job.seed, laps: autolaps(job.seed) } satisfies TuneResult);
    return;
  }
  apply(job.values);
  postMessage({ type: "race", id: job.id, seed: job.seed, races: races(job.seed, job.cars, job.laps) } satisfies TuneResult);
};

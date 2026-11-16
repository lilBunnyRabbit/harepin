import { COUPE, type CarSpec } from "../../src/car/cars";
import { at_difficulty, Difficulty } from "../../src/ai/difficulty";
import { Field, personalities } from "../../src/ai/field";
import { World } from "../../src/world/world";
import { circuits, FIELD_SLACK, solo, SOLO_SLACK, spearman } from "../ai-race";
import { autolap, DT } from "../autolap";

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
  /** Mean over the field of each car's spread (s, standard deviation) of its flying laps; 0 under 3 laps. Absent on runs from before it. */
  lap_sd?: number;
  /** Cars that finished, the weight of `lap` in a mean over races. Absent on runs from before it. */
  finished?: number;
}

/** The owner's 1-5 aggression and mistakes levels the whole field draws on, and the player's difficulty. */
export interface FieldSetup {
  aggression: number;
  mistakes: number;
  difficulty: Difficulty;
  /** false: every AI car races with its steering assist and stability control off. Absent, both on, as cars ship. */
  assists?: boolean;
}

export const LEVEL_3_FIELD: FieldSetup = { aggression: 3, mistakes: 3, difficulty: Difficulty.NORMAL };

function lap_spread(laps: readonly number[]): number {
  const flying = laps.slice(1).map((t, i) => t - laps[i]);
  if (flying.length < 2) return 0;
  const mean = flying.reduce((a, b) => a + b, 0) / flying.length;
  return Math.sqrt(flying.reduce((s, t) => s + (t - mean) ** 2, 0) / flying.length);
}

export interface SoloResult {
  route: string;
  /** Standing lap (s) of one AI car alone, and the autopilot's on the same route. */
  t: number;
  auto: number;
  done: boolean;
  offroad: number;
  /** Not done, off the road, or more than SOLO_SLACK slower than the autopilot: what `ai-race.ts solo` fails on. */
  failed: boolean;
}

/** The autopilot's coupe lap (s) on every island circuit of `seed`, by route id. */
export function autolaps(seed: number): Record<string, number> {
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

/** A field of `cars` of `spec` on every island circuit of `seed`, at whatever AI_TUNING holds now. */
export function races(seed: number, cars: number, laps: number, setup: FieldSetup = LEVEL_3_FIELD, spec: CarSpec = COUPE): RaceResult[] {
  const world = new World(seed);
  const out: RaceResult[] = [];
  for (const route of circuits(world)) {
    if (route.excludes?.includes(spec.id)) continue;
    const unplace = world.place(route.closure);
    const field = new Field(world, route, Array.from({ length: cars }, () => spec), at_difficulty(personalities(seed, cars, setup.aggression, setup.mistakes), setup.difficulty), seed);
    for (const { car } of field.racers) car.assist = car.stability = setup.assists !== false;
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
      lap_sd: sum((r) => lap_spread(r.stats.laps)) / rs.length,
      finished: done.length,
    });
  }
  return out;
}

/** `ai-race.ts solo` on one seed: one car of `spec` alone on each circuit, against the autopilot in it. */
export function solos(seed: number, assists = true, spec: CarSpec = COUPE): SoloResult[] {
  const world = new World(seed);
  const out: SoloResult[] = [];
  for (const route of circuits(world)) {
    if (route.excludes?.includes(spec.id)) continue;
    const unplace = world.place(route.closure);
    const auto = autolap(world, spec, [...route.points, route.points[0]], false).t;
    const ai = solo(world, route, spec, undefined, assists);
    unplace();
    out.push({ route: route.id, t: ai.t, auto, done: ai.done, offroad: ai.offroad, failed: !ai.done || ai.offroad > 0 || ai.t / auto > 1 + SOLO_SLACK });
  }
  return out;
}

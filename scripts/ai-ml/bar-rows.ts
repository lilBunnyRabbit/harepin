import { build_spec, parse_build } from "../../src/car/build";
import { car_spec, type CarSpec } from "../../src/car/cars";
import type { Difficulty } from "../../src/ai/difficulty";
import type { WorldKind } from "../../src/worldgen/types";
import type { BarRace } from "./bar";
import type { Pool } from "./cache";
import type { SoloRun } from "./pace";

/** One race: circuit `route` (an index into `circuits`) of `seed`, so a seed with two circuits fills two workers. */
export interface RaceJob {
  type: "race";
  id: string;
  seed: number;
  world?: WorldKind;
  route: number;
  car: string;
  eps: number;
  difficulty: Difficulty;
}

export interface RoutesJob {
  type: "routes";
  id: string;
  seed: number;
  world?: WorldKind;
}

export interface SoloJob {
  type: "solo";
  id: string;
  seed: number;
  world?: WorldKind;
  route: number;
  car: string;
  eps: number;
  flying: number;
}

export type BarJob = RaceJob | RoutesJob | SoloJob;

export function bar_spec(car: string): CarSpec {
  const build = parse_build(car);
  return build ? build_spec(build) : car_spec(car);
}

export type SoloLaps = Omit<SoloRun, "oracle">;

export interface RouteInfo {
  id: string;
  length: number;
  excludes: readonly string[];
}

export type BarResult = { type: "race"; id: string; race: BarRace } | { type: "routes"; id: string; routes: RouteInfo[] } | { type: "solo"; id: string; run: SoloLaps };

export interface Setup {
  cars: string[];
  epses: number[];
  difficulty: Difficulty;
  solo: boolean;
  flying: number;
  /** The kind of world raced on; absent, the island. */
  world?: WorldKind;
}

export type Rows = Record<string, (BarRace | SoloLaps)[]>;

export async function run_rows(pool: Pool<BarJob, BarResult>, seeds: readonly number[], setup: Setup): Promise<Rows> {
  const circuits_of = new Map<number, RouteInfo[]>();
  for (const r of await pool.run(seeds.map((seed): BarJob => ({ type: "routes", id: String(seed), seed, world: setup.world })))) if (r.type === "routes") circuits_of.set(Number(r.id), r.routes);
  const routes_of = (seed: number) => circuits_of.get(seed) ?? [];
  const jobs: (BarJob & { length: number })[] = [];
  for (const car of setup.cars)
    for (const eps of setup.epses)
      for (const seed of seeds)
        routes_of(seed).forEach((route, k) => {
          if (route.excludes.includes(bar_spec(car).id)) return;
          const id = `${car}/${eps}/${seed}/${k}`;
          jobs.push(setup.solo ? { type: "solo", id, seed, world: setup.world, route: k, car, eps, flying: setup.flying, length: route.length } : { type: "race", id, seed, world: setup.world, route: k, car, eps, difficulty: setup.difficulty, length: route.length });
        });
  // Longest first: the wall is the last race to end, and a long one started late runs alone.
  const done = new Map<string, BarRace | SoloLaps>();
  for (const r of await pool.run(jobs.toSorted((a, b) => b.length - a.length))) {
    if (r.type === "race") done.set(r.id, r.race);
    else if (r.type === "solo") done.set(r.id, r.run);
  }
  const rows: Rows = {};
  for (const car of setup.cars)
    for (const eps of setup.epses)
      for (const seed of seeds)
        rows[`${car}/${eps}/${seed}`] = routes_of(seed).flatMap((_, k) => done.get(`${car}/${eps}/${seed}/${k}`) ?? []);
  return rows;
}

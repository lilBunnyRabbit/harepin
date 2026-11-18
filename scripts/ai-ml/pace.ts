import { readdirSync } from "node:fs";
import { Car, drop_height } from "../../src/car/car";
import type { CarSpec } from "../../src/car/cars";
import { Driver, OFF_ROAD } from "../../src/ai/driver";
import { race_line } from "../../src/ai/line";
import { plan_scale } from "../../src/ai/capability";
import type { World } from "../../src/world/world";
import type { Route } from "../../src/worldgen/types";
import { DT } from "../autolap";
import { read_json, ROOT } from "./cache";
import type { OracleResult } from "./oracle";

const LAP_LIMIT = 400;
/** Road points before the line where a lap ends, as `ai-race.ts solo` and the oracle's lap end it. */
const END = 10;

export interface SoloRun {
  route: string;
  standing: number;
  flying: number[];
  offroad: number;
  done: boolean;
  oracle: number | null;
}

export function solo_run(world: World, route: Route, spec: CarSpec, flying: number): Omit<SoloRun, "oracle"> {
  const line = race_line(route.points, world.ramps, spec.radius, world, plan_scale(spec));
  const driver = new Driver(line);
  const car = new Car(spec);
  const p = route.points[0];
  car.place(p.x, world.height(p.x, p.z) + drop_height(spec, 0.75), p.z, Math.atan2(p.tx, p.tz));
  const n = route.points.length;
  const marks: number[] = [];
  const limit = LAP_LIMIT * (flying + 1);
  let t = 0;
  let offroad = 0;
  while (t < limit && marks.length <= flying) {
    car.step(DT, driver.drive(car, DT), world);
    world.collide(car);
    t += DT;
    if (world.distance_to_road(car.pos.x, car.pos.z) > OFF_ROAD) offroad += DT;
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
    if (driver.progress >= (marks.length + 1) * n - END) marks.push(t);
  }
  return { route: route.id, standing: marks[0] ?? NaN, flying: marks.slice(1).map((m, k) => m - marks[k]), offroad, done: marks.length > flying };
}

/** Every clean oracle lap under `.ai-ml/<hash>/oracle`, the fastest per `seed/route/car`: any AI hash, as the oracle is the ceiling, not the AI. */
export function oracle_laps(): Map<string, number> {
  const best = new Map<string, number>();
  let hashes: string[] = [];
  try {
    hashes = readdirSync(ROOT);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  for (const hash of hashes) {
    let names: string[] = [];
    try {
      names = readdirSync(`${ROOT}/${hash}/oracle`).filter((f) => f.endsWith(".result.json"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT" && (e as NodeJS.ErrnoException).code !== "ENOTDIR") throw e;
    }
    for (const name of names) {
      const r = read_json<OracleResult>(`${ROOT}/${hash}/oracle/${name}`);
      if (!r?.oracle?.clean || r.config?.assists === false || !Number.isFinite(r.oracle.t)) continue;
      const key = `${r.config.seed}/${r.config.route}/${r.config.car}`;
      best.set(key, Math.min(best.get(key) ?? Infinity, r.oracle.t));
    }
  }
  return best;
}

/** Two-sided 99% Student t by degrees of freedom: strict per look, so a run that checks after every batch stops on chance rarely. */
const T99: readonly [number, number][] = [[1, 63.66], [2, 9.925], [3, 5.841], [4, 4.604], [5, 4.032], [6, 3.707], [7, 3.499], [8, 3.355], [9, 3.25], [10, 3.169], [12, 3.055], [15, 2.947], [20, 2.845], [30, 2.75], [60, 2.66], [120, 2.617]];
const Z99 = 2.576;

function t99(df: number): number {
  for (let i = 0; i < T99.length; i++) {
    const [d, t] = T99[i];
    if (df === d) return t;
    if (df < d) {
      const [d0, t0] = T99[i - 1];
      return t0 + ((t - t0) * (df - d0)) / (d - d0);
    }
  }
  return Z99;
}

export interface Interval {
  n: number;
  mean: number;
  half: number;
}

export function paired(diffs: readonly number[]): Interval {
  const n = diffs.length;
  const mean = n ? diffs.reduce((s, d) => s + d, 0) / n : NaN;
  if (n < 2) return { n, mean, half: Infinity };
  const sd = Math.sqrt(diffs.reduce((s, d) => s + (d - mean) ** 2, 0) / (n - 1));
  return { n, mean, half: (t99(n - 1) * sd) / Math.sqrt(n) };
}

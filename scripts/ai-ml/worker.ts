import { COUPE, car_spec, type CarAi } from "../../src/car/cars";
import { AI_TUNING } from "../../src/ai/tuning";
import { World } from "../../src/world/world";
import { circuits } from "../ai-race";
import { apply, type Values } from "../ai-tune/params";
import { autolaps, races, solos, type FieldSetup, type RaceResult, type SoloResult } from "../ai-tune/race";
import { ai_lap, oracle_lap, track_of, type LapResult, type Track } from "./drive";
import type { WorldKind } from "../../src/worldgen/types";
import { world_data } from "./worlds";

declare const self: Worker;

export type MlJob =
  | { type: "auto"; id: string; seed: number; world?: WorldKind }
  | { type: "race"; id: string; seed: number; values: Values; cars: number; laps: number; setup: FieldSetup }
  | { type: "solo"; id: string; seed: number; values: Values; assists: boolean }
  | { type: "oracle"; id: string; seed: number; world?: WorldKind; route: string; car: string; assists: boolean; x: number[]; knot: number; limit: number; trace: boolean }
  | { type: "ai_lap"; id: string; seed: number; world?: WorldKind; route: string; car: string; assists: boolean; values: Values; limit: number }
  | { type: "car"; id: string; seed: number; car: string; ai: CarAi; solo: boolean; eps: number };

export type MlResult =
  | { type: "auto"; id: string; seed: number; laps: Record<string, number> }
  | { type: "race"; id: string; seed: number; races: RaceResult[] }
  | { type: "solo"; id: string; seed: number; solos: SoloResult[] }
  | { type: "lap"; id: string; lap: LapResult }
  | { type: "car"; id: string; seed: number; races: RaceResult[]; solos: SoloResult[] };

const SHIPPED = structuredClone(AI_TUNING);
/** Every job starts from the shipped tuning: a worker serves many candidates, and one's values must not leak into the next. */
function reset(values: Values) {
  Object.assign(AI_TUNING, structuredClone(SHIPPED));
  apply(values);
}

let cached: { key: string; track: Track } | null = null;
/** The last track asked for, its world built once: an oracle run sends a worker thousands of laps on one route. */
function track(seed: number, kind: WorldKind | undefined, route_id: string, car: string, assists: boolean): Track {
  const key = `${kind}/${seed}/${route_id}/${car}/${assists}`;
  if (cached?.key === key) return cached.track;
  const world = new World(seed, world_data(seed, kind));
  const route = circuits(world).find((r) => r.id === route_id);
  if (!route) throw new Error(`seed ${seed} has no circuit ${route_id}`);
  world.place(route.closure);
  cached = { key, track: track_of(world, route, car === COUPE.id ? COUPE : car_spec(car), assists) };
  return cached.track;
}

self.onmessage = (event: MessageEvent<MlJob>) => {
  const job = event.data;
  if (job.type === "auto") {
    postMessage({ type: "auto", id: job.id, seed: job.seed, laps: autolaps(job.seed, new World(job.seed, world_data(job.seed, job.world))) } satisfies MlResult);
  } else if (job.type === "race") {
    reset(job.values);
    postMessage({ type: "race", id: job.id, seed: job.seed, races: races(job.seed, job.cars, job.laps, job.setup) } satisfies MlResult);
  } else if (job.type === "solo") {
    reset(job.values);
    postMessage({ type: "solo", id: job.id, seed: job.seed, solos: solos(job.seed, job.assists) } satisfies MlResult);
  } else if (job.type === "oracle") {
    reset({});
    postMessage({ type: "lap", id: job.id, lap: oracle_lap(track(job.seed, job.world, job.route, job.car, job.assists), job.x, job.knot, job.limit, job.trace) } satisfies MlResult);
  } else if (job.type === "car") {
    reset({});
    // The same block a hair off (`eps`, a share): a second draw of the field's chaos, as one bar swings 3 trouble on noise.
    const off = 1 + job.eps;
    const base = car_spec(job.car);
    const spec = { ...base, ai: { ...base.ai, slow: job.ai.slow * off, fast: job.ai.fast * off, brake: job.ai.brake * off } };
    postMessage({ type: "car", id: job.id, seed: job.seed, races: races(job.seed, 6, 2, undefined, spec), solos: job.solo ? solos(job.seed, true, spec) : [] } satisfies MlResult);
  } else {
    reset(job.values);
    const { world, route, spec } = track(job.seed, job.world, job.route, job.car, job.assists);
    postMessage({ type: "lap", id: job.id, lap: ai_lap(track_of(world, route, spec, job.assists), job.limit) } satisfies MlResult);
  }
};

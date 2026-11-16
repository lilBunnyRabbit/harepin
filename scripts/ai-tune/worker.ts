import { apply, type Values } from "./params";
import { autolaps, races, type RaceResult } from "./race";

declare const self: Worker;

export type { RaceResult };

export type TuneJob = { type: "auto"; id: string; seed: number } | { type: "race"; id: string; seed: number; values: Values; cars: number; laps: number };

export type TuneResult = { type: "auto"; id: string; seed: number; laps: Record<string, number> } | { type: "race"; id: string; seed: number; races: RaceResult[] };

self.onmessage = (event: MessageEvent<TuneJob>) => {
  const job = event.data;
  if (job.type === "auto") {
    postMessage({ type: "auto", id: job.id, seed: job.seed, laps: autolaps(job.seed) } satisfies TuneResult);
    return;
  }
  apply(job.values);
  postMessage({ type: "race", id: job.id, seed: job.seed, races: races(job.seed, job.cars, job.laps) } satisfies TuneResult);
};

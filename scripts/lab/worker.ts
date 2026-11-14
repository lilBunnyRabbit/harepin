import type { CarSpec } from "../../src/car/cars";
import type { SteerMode } from "../../src/car/car";
import type { LabSurface, StationId } from "../../src/worldgen/lab";
import type { GroundName } from "../grounds";
import { trial_sim, traits, type Sim, type Traits } from "./sims";

declare const self: Worker;

export type LabJob = { kind: "trial"; spec: CarSpec; station: StationId; surface: LabSurface; mode: SteerMode } | { kind: "traits"; spec: CarSpec; ground: GroundName };

export type LabResult = { kind: "trial"; sim: Sim } | { kind: "traits"; traits: Traits } | { kind: "error"; message: string };

function work(job: LabJob): LabResult {
  if (job.kind === "trial") return { kind: "trial", sim: trial_sim(job.spec, job.station, job.surface, job.mode) };
  return { kind: "traits", traits: traits(job.spec, job.ground) };
}

self.onmessage = (event: MessageEvent<LabJob>) => {
  let result: LabResult;
  try {
    result = work(event.data);
  } catch (error) {
    // A NaN in the sim is the answer for that job, not a reason to lose the rest of the run.
    result = { kind: "error", message: error instanceof Error ? error.message : String(error) };
  }
  postMessage(result);
};

import { StationId } from "../worldgen/lab";
import type { Question, Trial } from "./pack";

export const GRIP: Question = { kind: "scale", id: "grip", label: "Grip", low: "slides everywhere", high: "glued" };
export const PRED: Question = { kind: "scale", id: "pred", label: "Predictability", low: "snaps without warning", high: "always telegraphs" };
export const FUN: Question = { kind: "scale", id: "fun", label: "Fun", low: "a chore", high: "again!" };
export const DRIFT: Question = { kind: "scale", id: "drift", label: "Drift ease", low: "won't slide or won't hold", high: "easy to start and hold" };
export const LANDING: Question = { kind: "scale", id: "land", label: "Landing", low: "bounces or flips", high: "plants" };
export const VS: Question = { kind: "pick", id: "vs", label: "vs last trial", options: ["worse", "same", "better"] };
export const NOTE: Question = { kind: "text", id: "note", label: "Note" };

export const ASK: Question[] = [GRIP, PRED, FUN, NOTE];

const DRIFT_STATIONS: ReadonlySet<StationId> = new Set<StationId>([StationId.DRIFT, StationId.EIGHT, StationId.SKIDPAD, StationId.HAIRPIN]);
const LANDING_STATIONS: ReadonlySet<StationId> = new Set<StationId>([StationId.KICKER]);

/** The plan's questions per station: drift ease where a slide is the point, landing on the kickers, and "vs last trial" when the trial before ran the same station. */
export function with_station_asks(trials: Trial[]): Trial[] {
  return trials.map((trial, i) => ({
    ...trial,
    ask: [
      GRIP,
      PRED,
      FUN,
      ...(DRIFT_STATIONS.has(trial.station) ? [DRIFT] : []),
      ...(LANDING_STATIONS.has(trial.station) ? [LANDING] : []),
      ...(trials[i - 1]?.station === trial.station ? [VS] : []),
      NOTE,
    ],
  }));
}

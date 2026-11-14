import { StationId } from "../worldgen/lab";
import type { Question, Trial } from "./pack";

export const GRIP: Question = { kind: "scale", id: "grip", label: "Grip", low: "slides everywhere", high: "glued" };
export const PRED: Question = { kind: "scale", id: "pred", label: "Predictability", low: "snaps without warning", high: "always telegraphs" };
export const FUN: Question = { kind: "scale", id: "fun", label: "Fun", low: "a chore", high: "again!" };
export const DRIFT: Question = { kind: "scale", id: "drift", label: "Drift ease", low: "won't slide or won't hold", high: "easy to start and hold" };
export const LANDING: Question = { kind: "scale", id: "land", label: "Landing", low: "bounces or flips", high: "plants" };
export const VS: Question = { kind: "pick", id: "vs", label: "vs last trial", options: ["worse", "same", "better"] };
export const VS_BASELINE: Question = { ...VS, label: "vs the baseline" };
export const NOTE: Question = { kind: "text", id: "note", label: "Note" };

export const ASK: Question[] = [GRIP, PRED, FUN, NOTE];

export const MAX_TRAIT_SCALES = 3;

const DRIFT_STATIONS: ReadonlySet<StationId> = new Set<StationId>([StationId.DRIFT, StationId.EIGHT, StationId.SKIDPAD, StationId.HAIRPIN]);
const LANDING_STATIONS: ReadonlySet<StationId> = new Set<StationId>([StationId.KICKER]);

/**
 * The plan's questions per station: drift ease where a slide is the point, landing on the kickers, and "vs last trial"
 * when the trial before ran the same station. A trial that names its own questions keeps them.
 */
export function with_station_asks(trials: Trial[]): Trial[] {
  return trials.map((trial, i) => ({
    ...trial,
    ask: trial.ask ?? [
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

/** One question per handling trait (plan feel-lab-v2 4): a session judges one trait and asks at most 3 of these plus the note. */
export const Trait = {
  TURN_IN: "turn_in",
  BALANCE: "balance",
  POWER: "power",
  LIFT: "lift",
  BRAKING: "braking",
  ENTRY: "entry",
  HOLD: "hold",
  EXIT: "exit",
  LANDING: "landing",
  SEAMS: "seams",
  TOP: "top",
} as const;
export type Trait = (typeof Trait)[keyof typeof Trait];

const trait_scale = (id: string, label: string, low: string, high: string): Question => ({ kind: "scale", id, label, low, high });

export const TRAIT_ASK: Record<Trait, Question> = {
  turn_in: trait_scale("turn", "Turn-in", "lazy", "darty"),
  balance: trait_scale("bal", "Mid-corner balance", "pushes", "rotates"),
  power: trait_scale("pwr", "Power oversteer", "none", "snaps"),
  lift: trait_scale("lift", "Lift-off", "none", "snaps"),
  braking: trait_scale("brake", "Braking", "wanders", "straight"),
  entry: trait_scale("entry", "Drift entry", "won't go", "easy"),
  hold: trait_scale("hold", "Drift hold", "can't hold", "holds"),
  exit: trait_scale("exit", "Drift exit", "spins", "catches"),
  landing: LANDING,
  seams: trait_scale("seam", "Surface changes", "jolts", "smooth"),
  top: trait_scale("top", "Top-speed stability", "nervous", "planted"),
};

/** A one-trait session's questions: the named traits' scales (3 at most) and the note. */
export function trait_asks(...traits: Trait[]): Question[] {
  if (traits.length > MAX_TRAIT_SCALES) throw new Error(`a session asks at most ${MAX_TRAIT_SCALES} scales, got ${traits.length}`);
  return [...traits.map((t) => TRAIT_ASK[t]), NOTE];
}

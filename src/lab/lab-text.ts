import type { TrialStatus } from "./lab";
import type { Goal } from "./pack";

export const STATUS_LABEL: Record<TrialStatus, string> = { new: "To do", running: "Running", done: "Done", stopped: "Stopped" };

export const STATUS_TONE: Record<TrialStatus, "neutral" | "info" | "success" | "warning"> = { new: "neutral", running: "info", done: "success", stopped: "warning" };

export function goal_label(goal: Goal): string {
  if (goal.kind === "laps") return `${goal.laps} ${goal.laps === 1 ? "lap" : "laps"}`;
  if (goal.kind === "time") return `${goal.seconds} s`;
  if (goal.kind === "stop") return `Stop from ${goal.from_kmh} km/h`;
  if (goal.kind === "run") return "Start to finish";
  return "Free";
}

/**
 * What the strip's goal reading shows, as one whole number: the text is only rebuilt when it moves. Laps done, whole
 * seconds left or driven, gates crossed; a stop has nothing to count down.
 */
export function progress_key(goal: Goal, laps: number, gates: number, time: number): number {
  if (goal.kind === "laps") return Math.min(laps + 1, goal.laps);
  if (goal.kind === "time") return Math.max(0, Math.ceil(goal.seconds - time));
  if (goal.kind === "run") return gates;
  if (goal.kind === "free") return Math.floor(time);
  return 0;
}

/** `gate_count` is how many of a start and a finish gate the lane has. */
export function progress_text(goal: Goal, key: number, gate_count: number): string {
  if (goal.kind === "laps") return `Lap ${key}/${goal.laps}`;
  if (goal.kind === "time") return `${key} s left`;
  if (goal.kind === "run") return `Gate ${key}/${gate_count}`;
  if (goal.kind === "free") return `${key} s`;
  return `Brake from ${goal.from_kmh}`;
}

export const METRIC_LABEL: Record<string, string> = {
  time: "Time s",
  lap: "Laps s",
  seg: "Gate to gate s",
  latg: "Lateral g peak/mean",
  ring: "Ring speed km/h",
  slip: "Slip ° peak/mean",
  held: "Drift held s",
  chain: "Longest drift s",
  spins: "Spins",
  lag: "Yaw lag s",
  rec: "Catch s",
  "0-100": "0-100 s",
  stop: "Stop m@km/h",
  top: "Top km/h",
  spin: "Wheelspin share/peak",
  air: "Air s",
  land: "Landing upright",
  bounce: "Bounces",
  offs: "Offs",
  resets: "Resets",
  lock: "Full lock share",
  thr: "Full throttle share",
  hb: "Handbrake share",
  rev: "Steer reversals /s",
};

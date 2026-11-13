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

import type { TrialStatus } from "./lab";
import type { StationId } from "../worldgen/lab";
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

interface MetricText {
  label: string;
  unit?: string;
  /** Stations where the number means something; everywhere when absent. */
  at?: readonly StationId[];
  show?: (text: string) => string;
}

const CORNERS: readonly StationId[] = ["skidpad", "sweeper", "lava", "slalom", "hairpin", "oval", "drift", "eight", "hub", "grid", "hill"];
const SLIDES: readonly StationId[] = ["skidpad", "sweeper", "lava", "slalom", "hairpin", "drift", "eight", "hub", "grid", "hill"];
const AIR: readonly StationId[] = ["kicker", "hub", "grid", "hill"];
const FAST: readonly StationId[] = ["runway", "oval", "hub", "grid"];

const pct = (part: string) => (part === "-" ? part : `${Math.round(Number(part) * 100)}%`);

export const METRICS: Record<string, MetricText> = {
  time: { label: "Time", unit: "s" },
  lap: { label: "Laps", unit: "s", show: (t) => t.replaceAll(",", ", ") },
  seg: { label: "Start to finish gate", unit: "s" },
  latg: { label: "Cornering g, peak / average", at: CORNERS },
  ring: { label: "Speed round the ring", unit: "km/h", at: CORNERS },
  slip: { label: "Slide angle, peak / average", unit: "°", at: SLIDES },
  held: { label: "Time drifting", unit: "s", at: SLIDES },
  chain: { label: "Longest drift", unit: "s", at: SLIDES },
  spins: { label: "Spins", at: SLIDES },
  lag: { label: "Steering response", unit: "s", at: CORNERS },
  rec: { label: "Time to catch a slide", unit: "s", at: SLIDES },
  "0-100": { label: "0-100 km/h", unit: "s" },
  stop: { label: "Stopping distance", show: (t) => t.replace(/^(.+)@(.+)$/, "$1 m from $2 km/h") },
  top: { label: "Top speed", unit: "km/h" },
  spin: { label: "Wheelspin, time / peak", show: (t) => t.replace(/^([^/]+)\/(.+)$/, (_, share: string, peak: string) => `${pct(share)} / ${peak}x`) },
  air: { label: "Airtime", unit: "s", at: AIR },
  land: { label: "Landing upright (1 flat)", at: AIR },
  bounce: { label: "Bounces", at: AIR },
  offs: { label: "Times off the lane" },
  resets: { label: "Resets" },
  lock: { label: "Time at full lock", show: pct },
  thr: { label: "Time at full throttle", show: pct },
  hb: { label: "Time on the handbrake", show: pct },
  rev: { label: "Steering corrections", unit: "/s" },
  yawover: { label: "Rotation overshoot", at: CORNERS },
  us: { label: "Understeer (over 1 pushes)", at: CORNERS },
  pwr: { label: "Slide on power", unit: "°", at: SLIDES },
  lift: { label: "Slide on lift-off", unit: "°", at: SLIDES },
  bdev: { label: "Pull under braking", unit: "°" },
  trail: { label: "Slide braking into a turn", unit: "°", at: SLIDES },
  entry: { label: "Drift entry", unit: "s", at: SLIDES },
  pitch: { label: "Landing nose bob", unit: "rad/s", at: AIR },
  xslip: { label: "Slide over a surface seam", unit: "°" },
  yawsd: { label: "Wander at top speed, yaw / steer", at: FAST },
};

// A count of nothing still answers "did it spin, did it leave the lane"; any other all-zero number was never measured.
const ZERO_SAYS = new Set(["spins", "offs"]);

export interface ShownMetric {
  key: string;
  label: string;
  value: string;
}

/** The numbers worth reading on the card: the ones that mean something at the station and were measured. The export keeps them all. */
export function shown_metrics(pairs: readonly (readonly [key: string, text: string])[], station: StationId): ShownMetric[] {
  return pairs.flatMap(([key, text]) => {
    const m = METRICS[key];
    if (!m) return [{ key, label: key, value: text }];
    if (m.at && !m.at.includes(station)) return [];
    if (!ZERO_SAYS.has(key) && text.split(/[/,]/).every((p) => p === "0" || p === "-")) return [];
    const value = m.show ? m.show(text) : text.replaceAll("/", " / ");
    return [{ key, label: m.label, value: m.unit ? `${value} ${m.unit}` : value }];
  });
}

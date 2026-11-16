import type { TrialStatus } from "./lab";
import type { StationId } from "../worldgen/lab";
import { Difficulty } from "../ai/difficulty";
import { is_race, is_route, place_of, type Goal, type Resolved, type TrialField } from "./pack";

export const STATUS_LABEL: Record<TrialStatus, string> = { new: "To do", running: "Running", done: "Done", stopped: "Stopped" };

export const STATUS_TONE: Record<TrialStatus, "neutral" | "info" | "success" | "warning"> = { new: "neutral", running: "info", done: "success", stopped: "warning" };

export function goal_label(goal: Goal): string {
  if (goal.kind === "laps") return `${goal.laps} ${goal.laps === 1 ? "lap" : "laps"}`;
  if (goal.kind === "time") return `${goal.seconds} s`;
  if (goal.kind === "stop") return `Stop from ${goal.from_kmh} km/h`;
  if (goal.kind === "run") return "Start to finish";
  if (goal.kind === "race") return "The race";
  return "Free";
}

/** Each AI car's owner levels as `aggression/mistakes`, one pair when the whole grid shares it. */
export function field_levels(field: TrialField): string {
  const each = field.cars.map((c) => `${c.aggression}/${c.mistakes}`);
  return each.every((l) => l === each[0]) ? each[0] : each.join(" ");
}

export function field_label(field: TrialField): string {
  const { difficulty = Difficulty.NORMAL } = field;
  return `${field.cars.length} AI, aggression/mistakes ${field_levels(field)}${difficulty === Difficulty.NORMAL ? "" : `, ${difficulty}`}`;
}

/** Station and lane, or a race's map and route with its field, or a route trial's map and route alone. */
export const where_text = (r: Resolved): string => `${place_of(r.trial)}/${r.lane.name}${is_race(r.trial) ? ` · ${field_label(r.trial.field)}` : is_route(r.trial) ? " · alone" : ""}`;

/**
 * What the strip's goal reading shows, as one whole number: the text is only rebuilt when it moves. Laps done, whole
 * seconds left or driven, gates crossed; a stop has nothing to count down.
 */
export function progress_key(goal: Goal, laps: number, gates: number, time: number): number {
  if (goal.kind === "laps") return Math.min(laps + 1, goal.laps);
  if (goal.kind === "time") return Math.max(0, Math.ceil(goal.seconds - time));
  if (goal.kind === "run") return gates;
  if (goal.kind === "free" || goal.kind === "race") return Math.floor(time);
  return 0;
}

/** `gate_count` is how many of a start and a finish gate the lane has. */
export function progress_text(goal: Goal, key: number, gate_count: number): string {
  if (goal.kind === "laps") return `Lap ${key}/${goal.laps}`;
  if (goal.kind === "time") return `${key} s left`;
  if (goal.kind === "run") return `Gate ${key}/${gate_count}`;
  if (goal.kind === "free" || goal.kind === "race") return `${key} s`;
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
  // The peak reads 2-4 g in a slide and invites the wrong question; the average is what the corner held.
  latg: { label: "Cornering g", at: CORNERS, show: (t) => t.split("/")[1] ?? t },
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

/**
 * Never on the card, only in the export: the input shares are the lead's check on the driver, the scenario folds and the
 * wheelspin pair mean nothing to whoever drove.
 */
const OFF_CARD = new Set(["lock", "thr", "hb", "rev", "yawover", "us", "pwr", "lift", "trail", "entry", "lag", "xslip", "bdev", "pitch", "yawsd", "spin"]);

// A count of nothing still answers "did it spin, did it leave the lane"; any other all-zero number was never measured.
const ZERO_SAYS = new Set(["spins", "offs"]);

export interface ShownMetric {
  key: string;
  label: string;
  value: string;
}

/**
 * The numbers worth reading on the card: the ones that mean something at the station, were measured and speak to the
 * driver. The export keeps them all. `station` is null on a race trial, where only the numbers meant everywhere show.
 */
export function shown_metrics(pairs: readonly (readonly [key: string, text: string])[], station: StationId | null): ShownMetric[] {
  return pairs.flatMap(([key, text]) => {
    const m = METRICS[key];
    if (OFF_CARD.has(key)) return [];
    if (!m) return [{ key, label: key, value: text }];
    if (m.at && (station === null || !m.at.includes(station))) return [];
    if (!ZERO_SAYS.has(key) && text.split(/[/,]/).every((p) => p === "0" || p === "-")) return [];
    const value = m.show ? m.show(text) : text.replaceAll("/", " / ");
    return [{ key, label: m.label, value: m.unit ? `${value} ${m.unit}` : value }];
  });
}

/** At most this many numbers lead the results card; the rest fold under More. */
export const KEY_COUNT = 4;

/** Per station, the numbers that answer what it is for, best first (docs/car-feel.md, Lab round 1): the first `KEY_COUNT` measured ones lead. */
export const KEY_METRICS: Record<StationId, readonly string[]> = {
  hub: ["top", "latg", "slip", "spins", "offs"],
  skidpad: ["ring", "latg", "slip", "held", "lap"],
  runway: ["stop", "0-100", "seg", "top"],
  grid: ["slip", "spins", "offs", "latg", "time"],
  oval: ["top", "lap", "latg", "ring", "offs"],
  brake: ["stop", "offs", "top"],
  slalom: ["seg", "offs", "slip"],
  hairpin: ["seg", "offs", "slip", "spins"],
  sweeper: ["seg", "latg", "ring", "offs"],
  drift: ["held", "chain", "spins", "ring"],
  eight: ["held", "chain", "spins", "ring"],
  kicker: ["air", "bounce", "land", "seg"],
  lava: ["ring", "latg", "slip", "offs"],
  hill: ["seg", "0-100", "top", "offs"],
};

/** A race trial's lead numbers: the field's own lines lead its card. */
const RACE_METRICS: readonly string[] = ["time", "top", "offs", "resets"];

/** The card's lead numbers for the station (null: a race) and everything else it shows, each in its own order. */
export function split_metrics(shown: readonly ShownMetric[], station: StationId | null): { lead: ShownMetric[]; rest: ShownMetric[] } {
  const lead = (station === null ? RACE_METRICS : KEY_METRICS[station]).flatMap((key) => shown.filter((m) => m.key === key)).slice(0, KEY_COUNT);
  return { lead, rest: shown.filter((m) => !lead.includes(m)) };
}

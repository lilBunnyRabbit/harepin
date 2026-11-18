import type { RaceLine } from "../../src/ai/line";
import { corners } from "../../src/ai/corners";
import { corner_run, corner_window, gap_tags } from "./corners";
import type { Trace } from "./drive";
import type { Flaw, OwnerLap } from "./owner-read";

/** A person's foot is never exactly at 1, as corners.ts' full throttle is. */
const LIFT = 0.9;
const ON = 0.02;
/** Metres under the line's widest band that name a step or a solid. */
const NARROW = 0.5;
/** Lifts closer than this many route points are one; one that costs under DROP m/s and never brakes past BRAKE is a breath, not a lift. */
const MERGE = 10;
const DROP = 1;
const BRAKE = 0.3;

const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "-");

/** The first flaw the owner's lap holds over a corner's window, or null when the corner is a reference. */
function spoilt_in(line: RaceLine, you: OwnerLap, from: number, window: [number, number]): Flaw | null {
  const n = line.road.length;
  for (let k = window[0]; k <= window[1]; k++) {
    const flaw = you.spoilt[(((from + k) % n) + n) % n];
    if (flaw) return flaw;
  }
  return null;
}

/** `gap_table` with the owner in the oracle's place, plus where each took its apex; a corner the owner's lap spoilt drops out. */
export function owner_table(line: RaceLine, ai: Trace, you: OwnerLap): string {
  const cs = corners(line);
  const dropped: string[] = [];
  const rows = cs.flatMap((c, k) => {
    const window = corner_window(line, [ai, you.trace], c);
    if (!window) return [];
    const flaw = spoilt_in(line, you, c.from, window);
    if (flaw) {
      dropped.push(`${k + 1} ${flaw}`);
      return [];
    }
    const a = corner_run(line, ai, c, window);
    const o = corner_run(line, you.trace, c, window);
    return [{ k, c, a, o, gap: a.time - o.time, tags: gap_tags(a, o), at: o.apex_at }];
  });
  rows.sort((x, y) => y.gap - x.gap);
  const total = rows.reduce((s, r) => s + r.gap, 0);
  return [
    `corners ${rows.length}${dropped.length ? ` (${dropped.length} dropped: ${dropped.join(", ")})` : ""}, AI loses ${f(total)} s to you in them`,
    "",
    "| # | at | radius m | gap s | entry ai/you | apex ai/you | exit ai/you | brake m before apex ai/you | full throttle m after ai/you | pedal ai/you | slip rad ai/you | apex m off centre line/you | why |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map(({ k, c, a, o, gap, tags, at }) => `| ${k + 1} | ${c.from} | ${f(c.radius, 0)} | ${f(gap, 2)} | ${f(a.entry)}/${f(o.entry)} | ${f(a.apex)}/${f(o.apex)} | ${f(a.exit)}/${f(o.exit)} | ${f(a.brake_m, 0)}/${f(o.brake_m, 0)} | ${f(a.throttle_m, 0)}/${f(o.throttle_m, 0)} | ${f(a.pedal, 2)}/${f(o.pedal, 2)} | ${f(a.slip, 2)}/${f(o.slip, 2)} | ${f(line.offset[at])}/${f(you.offset[at])} | ${tags.join(", ")} |`),
  ].join("\n");
}

export interface Lift {
  from: number;
  to: number;
  /** m/s going in, at the slowest, coming out; the AI's slowest over the same points. */
  entry: number;
  low: number;
  exit: number;
  ai_low: number;
  ai_lifted: boolean;
  throttle: number;
  brake: number;
  cause: string;
}

/** Every stretch outside the corners' windows where the owner came off the gas: a step, an object, a kicker or a crest. */
export function lifts(line: RaceLine, ai: Trace, you: OwnerLap): Lift[] {
  const n = line.road.length;
  const zone = new Uint8Array(n);
  for (const c of corners(line)) {
    const window = corner_window(line, [ai, you.trace], c);
    if (!window) continue;
    for (let k = window[0]; k <= window[1]; k++) zone[(((c.from + k) % n) + n) % n] = 1;
  }
  const off = (i: number) => !zone[i] && !you.spoilt[i] && (you.trace.throttle[i] < LIFT || you.trace.brake[i] > ON);
  let widest = 0;
  for (let i = 0; i < n; i++) widest = Math.max(widest, line.hi[i] - line.lo[i]);
  const out: Lift[] = [];
  for (let i = 0; i < n; i++) {
    if (!off(i)) continue;
    const from = i;
    let to = i;
    for (let j = i + 1; j < n && j - to <= MERGE; j++) if (off(j)) to = j;
    i = to;
    let low = Infinity;
    let ai_low = Infinity;
    let throttle = 1;
    let brake = 0;
    let ai_lifted = false;
    let narrow = from;
    let kicker = false;
    for (let j = from; j <= to; j++) {
      low = Math.min(low, you.trace.speed[j]);
      ai_low = Math.min(ai_low, ai.speed[j]);
      throttle = Math.min(throttle, you.trace.throttle[j]);
      brake = Math.max(brake, you.trace.brake[j]);
      ai_lifted ||= ai.throttle[j] < LIFT || ai.brake[j] > ON;
      if (line.hi[j] - line.lo[j] < line.hi[narrow] - line.lo[narrow]) narrow = j;
      kicker ||= line.ramp[j] >= 0;
    }
    const cause = kicker ? "kicker" : line.hi[narrow] - line.lo[narrow] < widest - NARROW ? `line band ${f(line.lo[narrow])}..${f(line.hi[narrow])} m at ${narrow}: step or solid` : "";
    if (you.trace.speed[from] - low < DROP && brake < BRAKE) continue;
    out.push({ from, to, entry: you.trace.speed[from], low, exit: you.trace.speed[to], ai_low, ai_lifted, throttle, brake, cause });
  }
  return out;
}

export function lifts_table(rows: readonly Lift[]): string {
  if (!rows.length) return "No lifts outside the corners.";
  return [
    `lifts outside the corners: ${rows.length}`,
    "",
    "| at | to | in/low/out m/s | AI low m/s | AI lifted | throttle min | brake max | cause |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map((l) => `| ${l.from} | ${l.to} | ${f(l.entry)}/${f(l.low)}/${f(l.exit)} | ${f(l.ai_low)} | ${l.ai_lifted ? "yes" : "no"} | ${f(l.throttle, 2)} | ${f(l.brake, 2)} | ${l.cause} |`),
  ].join("\n");
}

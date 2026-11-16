import type { RaceLine } from "../../src/ai/line";
import type { Trace } from "./drive";

/** A bend tighter than this radius (m) is a corner; bends closer than MERGE road points are one corner. */
const CORNER_RADIUS = 120;
const MERGE = 15;
const MIN_LEN = 5;
/** Road points read before a corner for its braking, and after it for the exit. */
const BEFORE = 100;
const AFTER = 25;
const ON = 0.02;

export interface Corner {
  /** Road points where the bend starts and ends, and its tightest radius (m). */
  from: number;
  to: number;
  radius: number;
}

export interface CornerRun {
  /** m/s at the bend's start, its slowest point and its end. */
  entry: number;
  apex: number;
  exit: number;
  apex_at: number;
  /** Largest slide (rad) from the braking zone to the exit. */
  slip: number;
  /** Metres before the apex the car came off full throttle, and after it went back to full. */
  brake_m: number;
  throttle_m: number;
  /** Most pedal used into the corner. */
  pedal: number;
  /** Seconds over the corner's window: up to BEFORE road points ahead of the bend to AFTER past it. */
  time: number;
}

export function corners(line: RaceLine): Corner[] {
  const n = line.road.length;
  const tight = (i: number) => Math.abs(line.bend[i]) > 1 / CORNER_RADIUS;
  let start = 0;
  while (start < n && tight(start)) start++;
  const out: Corner[] = [];
  let from = -1;
  let gap = 0;
  for (let k = 0; k <= n; k++) {
    const i = (start + k) % n;
    if (k < n && tight(i)) {
      if (from < 0) from = k;
      gap = 0;
    } else if (from >= 0 && (++gap > MERGE || k === n)) {
      const to = k - gap;
      if (to - from >= MIN_LEN) {
        let r = Infinity;
        for (let j = from; j <= to; j++) r = Math.min(r, 1 / Math.max(1e-9, Math.abs(line.bend[(start + j) % n])));
        out.push({ from: (start + from) % n, to: (start + to) % n, radius: r });
      }
      from = -1;
      gap = 0;
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

/**
 * Road points before and after corner `c` that every trace reached in order: a lap is recorded once from a standing
 * start and stops short of the line, so a corner near the start loses part of its braking zone or exit, not the corner.
 */
export function corner_window(line: RaceLine, traces: readonly Trace[], c: Corner): [number, number] | null {
  const n = line.road.length;
  const len = (((c.to - c.from) % n) + n) % n;
  const at = (k: number) => (((c.from + k) % n) + n) % n;
  // A corner across the start line is timed at the lap's end before its start: no window is in order.
  if (traces.some((tr) => !(tr.t[at(len)] >= tr.t[at(0)]))) return null;
  let lo = -BEFORE;
  while (lo < 0 && traces.some((tr) => !(tr.t[at(lo)] <= tr.t[at(0)]))) lo++;
  let hi = len + AFTER;
  while (hi > len && traces.some((tr) => !(tr.t[at(hi)] >= tr.t[at(len)]))) hi--;
  return [lo, hi];
}

export function corner_run(line: RaceLine, tr: Trace, c: Corner, window: [number, number]): CornerRun {
  const n = line.road.length;
  const len = (((c.to - c.from) % n) + n) % n;
  const at = (k: number) => (((c.from + k) % n) + n) % n;
  const [lo, hi] = window;
  let apex_k = 0;
  for (let k = 0; k <= len; k++) if (tr.speed[at(k)] < tr.speed[at(apex_k)]) apex_k = k;
  let slip = 0;
  let pedal = 0;
  for (let k = lo; k <= len; k++) {
    slip = Math.max(slip, tr.slide[at(k)] || 0);
    pedal = Math.max(pedal, tr.brake[at(k)] || 0);
  }
  let off = apex_k;
  while (off > lo && (tr.throttle[at(off - 1)] < 1 || tr.brake[at(off - 1)] > ON)) off--;
  let back = apex_k;
  while (back < hi && tr.throttle[at(back)] < 1) back++;
  const dist = (a: number, b: number) => {
    let d = 0;
    for (let k = a; k < b; k++) d += line.step[at(k)];
    return d;
  };
  return {
    entry: tr.speed[at(0)],
    apex: tr.speed[at(apex_k)],
    exit: tr.speed[at(len)],
    apex_at: at(apex_k),
    slip,
    brake_m: dist(off, apex_k),
    throttle_m: dist(apex_k, back),
    pedal,
    time: tr.t[at(hi)] - tr.t[at(lo)],
  };
}

/** What the AI's run `a` does wrong against the faster run `o`, where it is clear. */
export function gap_tags(a: CornerRun, o: CornerRun): string[] {
  const tags: string[] = [];
  if (a.brake_m > o.brake_m + 10) tags.push(`brakes ${(a.brake_m - o.brake_m).toFixed(0)} m early`);
  if (a.apex < o.apex - 1) tags.push(`apex ${(o.apex - a.apex).toFixed(1)} m/s slow`);
  if (a.throttle_m > o.throttle_m + 10) tags.push(`throttle ${(a.throttle_m - o.throttle_m).toFixed(0)} m late`);
  if (a.pedal < o.pedal - 0.15) tags.push(`pedal ${a.pedal.toFixed(2)} vs ${o.pedal.toFixed(2)}`);
  return tags;
}

/** Per-corner markdown table of `ai` against `oracle`, worst gap first, with what the AI does wrong where it is clear. */
export function gap_table(line: RaceLine, cs: readonly Corner[], ai: Trace, oracle: Trace): string {
  const rows = cs.flatMap((c, k) => {
    const window = corner_window(line, [ai, oracle], c);
    if (!window) return [];
    const a = corner_run(line, ai, c, window);
    const o = corner_run(line, oracle, c, window);
    return [{ k, c, a, o, gap: a.time - o.time, tags: gap_tags(a, o) }];
  });
  rows.sort((x, y) => y.gap - x.gap);
  const f = (v: number, d = 1) => v.toFixed(d);
  const total = rows.reduce((s, r) => s + r.gap, 0);
  const lines = [
    `corners ${rows.length}, AI loses ${f(total)} s in them`,
    "",
    "| # | at | radius m | gap s | entry ai/or | apex ai/or | exit ai/or | brake m before apex ai/or | full throttle m after ai/or | pedal ai/or | slip rad ai/or | why |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map(({ k, c, a, o, gap, tags }) => `| ${k + 1} | ${c.from} | ${f(c.radius, 0)} | ${f(gap, 2)} | ${f(a.entry)}/${f(o.entry)} | ${f(a.apex)}/${f(o.apex)} | ${f(a.exit)}/${f(o.exit)} | ${f(a.brake_m, 0)}/${f(o.brake_m, 0)} | ${f(a.throttle_m, 0)}/${f(o.throttle_m, 0)} | ${f(a.pedal, 2)}/${f(o.pedal, 2)} | ${f(a.slip, 2)}/${f(o.slip, 2)} | ${tags.join(", ")} |`),
  ];
  return lines.join("\n");
}

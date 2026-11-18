import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { COUPE, car_spec } from "../../src/car/cars";
import type { Capability } from "../../src/ai/capability";
import { corner_shapes, corners, features, grip_at_speed, type CornerShape } from "../../src/ai/corners";
import { drive_at, type RaceLine } from "../../src/ai/line";
import { GRAVITY } from "../../src/car/rigid-body";
import { World } from "../../src/world/world";
import { circuits } from "../ai-race";
import { read_json } from "./cache";
import { place_of, world_data } from "./worlds";
import { corner_run, corner_window, type CornerRun } from "./corners";
import { ai_lap, oracle_lap, track_of, type Trace } from "./drive";
import type { OracleConfig, OracleResult } from "./oracle";

// bun scripts/ai-ml/corner-set.ts <out.json> <oracle dir>...: one row per corner per clean oracle run, for fit.ts. The
// corners, their features and the shipped AI's run come from this tree's line and driver. An oracle whose best lap
// replays to the same time on this tree gives its whole trace (peak braking, full-throttle pull samples); one made on
// older code gives the per-corner runs its result file kept, matched by road point.

export interface CornerTargets extends CornerRun {
  /** m/s² at the hardest braking into the corner, and the mean from the brake point to the apex (NaN without a trace). */
  peak: number;
  mean: number;
}

export interface CornerRow {
  track: string;
  car: string;
  oracle_name: string;
  replayed: boolean;
  corner: number;
  from: number;
  to: number;
  shape: CornerShape;
  capability: Capability;
  x: number[];
  /** m/s: the plan's slowest speed in the corner and its speed at the corner's end, as this tree plans. */
  plan_apex: number;
  plan_exit: number;
  oracle: CornerTargets;
  ai: CornerTargets;
}

/** A full-throttle stretch of a trace: m/s, the share of the skidpad grip the bend takes, and the pull over `drive_at`. */
export interface PullSample {
  car: string;
  v: number;
  used: number;
  share: number;
}

export interface CornerSet {
  /** Hash of every input result file: what `corner-model.ts` names its fit by. */
  data: string;
  rows: CornerRow[];
  pull: PullSample[];
}

const MATCH = 6;
const DECEL_SPAN = 2;
/** Points of full throttle before a pull sample counts, so the gearbox and the throttle have settled. */
const SETTLED = 6;
const PULL_MIN = 8;

const wrap = (i: number, n: number) => ((i % n) + n) % n;

function decel_at(line: RaceLine, tr: Trace, i: number): number {
  const n = line.road.length;
  const a = wrap(i - DECEL_SPAN, n);
  const b = wrap(i + DECEL_SPAN, n);
  let d = 0;
  for (let k = a; k !== b; k = wrap(k + 1, n)) d += line.step[k];
  return (tr.speed[a] ** 2 - tr.speed[b] ** 2) / (2 * Math.max(1e-6, d));
}

/**
 * With a trace, the brake point is where the car was fastest between the window's start and the apex, and `brake_m`
 * runs from there: the oracle's pedals are bang-bang, so the first point off full throttle back from the apex (what
 * `corner_run` reads) is often a blip a few metres short of it. Without one, NaN: a kept run's `brake_m` is the other kind.
 */
function targets(line: RaceLine, tr: Trace | null, run: CornerRun, from: number): CornerTargets {
  if (!tr) return { ...run, brake_m: NaN, peak: NaN, mean: NaN };
  const n = line.road.length;
  let top = run.apex_at;
  for (let i = run.apex_at; i !== from; i = wrap(i - 1, n)) if (tr.speed[i] > tr.speed[top]) top = i;
  let peak = 0;
  let brake_m = 0;
  for (let i = top; i !== run.apex_at; i = wrap(i + 1, n)) {
    brake_m += line.step[i];
    peak = Math.max(peak, decel_at(line, tr, i));
  }
  const mean = brake_m > 0 ? (tr.speed[top] ** 2 - run.apex ** 2) / (2 * brake_m) : 0;
  return { ...run, brake_m, peak, mean };
}

function pull(line: RaceLine, tr: Trace, car: string): PullSample[] {
  const n = line.road.length;
  const cap = line.scale.car;
  const out: PullSample[] = [];
  let full = 0;
  for (let i = DECEL_SPAN; i < n - DECEL_SPAN; i++) {
    full = tr.throttle[i] === 1 && tr.brake[i] === 0 ? full + 1 : 0;
    if (full < SETTLED || line.kick[i] || !(tr.speed[i] > PULL_MIN)) continue;
    const v = tr.speed[i];
    const grade = (line.road[i + DECEL_SPAN].y - line.road[i - DECEL_SPAN].y) / Math.max(1e-6, line.step[i] * 2 * DECEL_SPAN);
    const a = -decel_at(line, tr, i) + GRAVITY * grade;
    const bend = Math.abs(line.bend[i]);
    out.push({ car, v, used: (v * v * bend) / grip_at_speed(v, cap), share: a / drive_at(v, line.scale) });
  }
  return out;
}

function rows_of(path: string): { rows: CornerRow[]; pull: PullSample[] } {
  const result = read_json<OracleResult>(path);
  if (result?.kind !== "oracle" || !result.oracle.clean) return { rows: [], pull: [] };
  const state = read_json<{ config: OracleConfig; best: { x: number[] } }>(path.replace(/\.result\.json$/, ".json"));
  const { config } = result;
  const world = new World(config.seed, world_data(config.seed, config.world));
  const route = circuits(world).find((r) => r.id === config.route);
  if (!route) throw new Error(`seed ${config.seed} has no circuit ${config.route}`);
  world.place(route.closure);
  const spec = config.car === COUPE.id ? COUPE : car_spec(config.car);
  const tk = track_of(world, route, spec, config.assists !== false);
  const { line } = tk;
  const n = line.road.length;
  const replay = state ? oracle_lap(tk, state.best.x, config.knot, result.oracle.t + 10, true) : null;
  const replayed = !!replay?.clean && Math.abs(replay.t - result.oracle.t) < 0.05;
  const oracle_tr = replayed ? replay!.trace! : null;
  const ai_tr = ai_lap(tk, 400, true).trace!;
  const cs = corners(line);
  const cap = line.scale.car;
  const shapes = corner_shapes(line, cs, cap);
  const rows: CornerRow[] = [];
  cs.forEach((c, k) => {
    const window = corner_window(line, oracle_tr ? [oracle_tr, ai_tr] : [ai_tr], c);
    if (!window) return;
    let oracle: CornerRun | undefined;
    if (oracle_tr) oracle = corner_run(line, oracle_tr, c, window);
    else {
      const kept = result.corners.find((r) => Math.abs(wrap(r.from - c.from + n / 2, n) - n / 2) <= MATCH);
      oracle = kept?.oracle;
    }
    if (!oracle) return;
    let plan_apex = Infinity;
    for (let i = c.from; ; i = wrap(i + 1, n)) {
      plan_apex = Math.min(plan_apex, line.speed[i]);
      if (i === c.to) break;
    }
    rows.push({
      track: `${place_of(config.seed, config.world)}/${config.route}`,
      car: config.car,
      oracle_name: result.name,
      replayed,
      corner: k,
      from: c.from,
      to: c.to,
      shape: shapes[k],
      capability: cap,
      x: features(shapes[k], cap),
      plan_apex,
      plan_exit: line.speed[c.to],
      oracle: targets(line, oracle_tr, oracle, wrap(c.from + window[0], n)),
      ai: targets(line, ai_tr, corner_run(line, ai_tr, c, window), wrap(c.from + window[0], n)),
    });
  });
  const samples = [...(oracle_tr ? pull(line, oracle_tr, config.car) : []), ...pull(line, ai_tr, config.car)];
  console.log(`${result.name} (${path}): ${rows.length} corners, ${replayed ? "replayed" : `kept runs (replay ${replay ? `${replay.t.toFixed(2)} ${replay.why}` : "no state"})`}, ${samples.length} pull samples`);
  return { rows, pull: samples };
}

if (import.meta.main) {
  const [out, ...dirs] = process.argv.slice(2);
  const files = dirs.flatMap((d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".result.json")).map((f) => `${d}/${f}`) : [])).sort();
  // The same oracle run twice under two cache dirs (code that moved nothing it reads) is one run: keep the faster.
  const seen = new Map<string, { file: string; t: number }>();
  for (const file of files) {
    const r = read_json<OracleResult>(file);
    if (r?.kind !== "oracle" || !r.oracle.clean || r.config.assists === false) continue;
    const key = `${r.config.car}/${place_of(r.config.seed, r.config.world)}/${r.config.route}`;
    if ((seen.get(key)?.t ?? Infinity) > r.oracle.t) seen.set(key, { file, t: r.oracle.t });
  }
  const picked = [...seen.values()].map((s) => s.file).sort();
  const set: CornerSet = { data: Bun.hash(picked.map((f) => readFileSync(f, "utf8")).join("")).toString(36), rows: [], pull: [] };
  for (const file of picked) {
    const { rows, pull } = rows_of(file);
    set.rows.push(...rows);
    set.pull.push(...pull);
  }
  writeFileSync(out, JSON.stringify(set));
  console.log(`${set.rows.length} rows from ${picked.length} oracle runs, ${set.pull.length} pull samples, data ${set.data}`);
}

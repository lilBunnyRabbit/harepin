import { availableParallelism } from "node:os";
import { writeFileSync } from "node:fs";
import { World } from "../../src/world/world";
import { race_line } from "../../src/ai/line";
import { COUPE, car_spec } from "../../src/car/cars";
import { circuits } from "../ai-race";
import { cma_init, cma_sample, type Cma } from "../ai-tune/cma";
import { mulberry32, sub } from "../../src/rng";
import { AI_HASH, claim, Pool, read_json, runs_dir, write_json } from "./cache";
import { corners } from "../../src/ai/corners";
import { corner_run, corner_window, gap_table, type CornerRun } from "./corners";
import { unit_init, knot_count, type LapResult } from "./drive";
import { PACE_HASH } from "./pace";
import { rank, step } from "./rank";
import type { MlJob, MlResult } from "./worker";

// bun scripts/ai-ml/oracle.ts <config.json> [--jobs n]: the fastest clean lap one car finds on one island circuit when
// every limit is searched (drive.ts), by separable CMA-ES. Resumes from .ai-ml/<hash>/oracle/<name>.json; at the end
// writes <name>.result.json (laps, per-corner runs) and <name>.gap.md (the shipped AI against it, corner by corner).

export interface OracleConfig {
  kind: "oracle";
  name: string;
  seed: number;
  route: string;
  car: string;
  /** Road points (about 2 m each) between knots. */
  knot: number;
  pop: number;
  gens: number;
  sigma: number;
  /** false: the car drives with its steering assist and stability control off. Absent, both on, as cars ship. */
  assists?: boolean;
}

interface State {
  config: OracleConfig;
  hash: string;
  auto: number;
  ai: LapResult;
  cma: Cma;
  best: { x: number[]; lap: LapResult } | null;
  gens: { sigma: number; best: number; median: number; clean: number }[];
}

export interface OracleResult {
  kind: "oracle";
  name: string;
  config: OracleConfig;
  hash: string;
  /** PACE_HASH of the code the lap was found on; absent on runs from before it. */
  pace?: string;
  auto: number;
  ai: { t: number; clean: boolean };
  oracle: { t: number; clean: boolean; why: string };
  /** Oracle lap over the autopilot's: the ceiling a difficulty level is a share of. */
  ratio: number;
  /** Oracle lap gain over the shipped AI (share, positive faster). */
  gain: number;
  corners: { from: number; to: number; radius: number; oracle: CornerRun; ai: CornerRun }[];
}

const SOLO_LIMIT = 400;
/** A candidate this much slower than the AI's lap is stopped: it has nothing to teach. */
const SLOW = 1.25;

export async function run_oracle(path: string, jobs: number) {
  const config = { ...(read_json<OracleConfig>(path) as OracleConfig) };
  const dir = runs_dir("oracle");
  const state_path = `${dir}/${config.name}.json`;
  const release = claim(state_path);
  const pool = new Pool<MlJob, MlResult>(new URL("./worker.ts", import.meta.url), jobs);
  pool.start();
  const lap = async (job: MlJob) => {
    const [r] = await pool.run([job]);
    if (r.type !== "lap") throw new Error("expected a lap");
    return r.lap;
  };
  const base = { seed: config.seed, route: config.route, car: config.car, assists: config.assists !== false };
  let state = read_json<State>(state_path);
  if (state && (state.hash !== AI_HASH || JSON.stringify({ ...state.config, gens: 0 }) !== JSON.stringify({ ...config, gens: 0 }))) throw new Error(`${state_path} was started on other code or config; rename the experiment`);
  if (!state) {
    const [auto] = await pool.run([{ type: "auto", id: "auto", seed: config.seed }]);
    if (auto.type !== "auto" || !(config.route in auto.laps)) throw new Error(`no autolap for ${config.route}`);
    const ai = await lap({ type: "ai_lap", id: "ai", ...base, values: {}, limit: SOLO_LIMIT });
    const world = new World(config.seed);
    const route = circuits(world).find((r) => r.id === config.route);
    if (!route) throw new Error(`seed ${config.seed} has no circuit ${config.route}`);
    const line = race_line(route.points, world.ramps, (config.car === COUPE.id ? COUPE : car_spec(config.car)).radius, world);
    delete ai.trace;
    state = { config, hash: AI_HASH, auto: auto.laps[config.route], ai, cma: cma_init(unit_init(knot_count(line, config.knot)), config.sigma), best: null, gens: [] };
    write_json(state_path, state);
  }
  state.config = config;
  // A shipped lap that left the road stopped early: its time is no yardstick, the autopilot's full lap is.
  const limit = (state.ai.clean ? state.ai.t : state.auto) * SLOW;
  while (state.cma.gen < config.gens) {
    const g = state.cma.gen;
    const samples = cma_sample(state.cma, config.pop, mulberry32(sub(1, `oracle-${config.name}-${g}`)));
    const laps = (await pool.run(samples.map((s, k): MlJob => ({ type: "oracle", id: `${g}/${k}`, ...base, x: s.x, knot: config.knot, limit, trace: false })))).map((r) => {
      if (r.type !== "lap") throw new Error("expected a lap");
      return r.lap;
    });
    const loss = laps.map((l) => l.loss);
    const order = rank(loss, `${config.name} gen ${g}`);
    const top = order[0];
    if (!state.best || loss[top] < state.best.lap.loss) state.best = { x: samples[top].x, lap: laps[top] };
    state.gens.push({ sigma: state.cma.sigma, best: loss[top], median: loss[order[order.length >> 1]], clean: laps.filter((l) => l.clean).length });
    state.cma = step(state.cma, samples, order);
    write_json(state_path, state);
    console.log(`${config.name} gen ${g}: best ${loss[top].toFixed(2)} median ${loss[order[order.length >> 1]].toFixed(2)} clean ${state.gens[g].clean}/${config.pop} sigma ${state.gens[g].sigma.toFixed(3)}; best so far ${state.best.lap.t.toFixed(2)} s ${state.best.lap.clean ? "clean" : state.best.lap.why} (ai ${state.ai.t.toFixed(2)})`);
  }
  const best = state.best;
  if (!best) throw new Error("no generations run");
  const oracle = await lap({ type: "oracle", id: "best", ...base, x: best.x, knot: config.knot, limit, trace: true });
  const ai = await lap({ type: "ai_lap", id: "ai", ...base, values: {}, limit: SOLO_LIMIT });
  pool.stop();
  if (!oracle.trace || !ai.trace) throw new Error("no trace");
  const world = new World(config.seed);
  const route = circuits(world).find((r) => r.id === config.route);
  if (!route) throw new Error(`no circuit ${config.route}`);
  const line = race_line(route.points, world.ramps, (config.car === COUPE.id ? COUPE : car_spec(config.car)).radius, world);
  const cs = corners(line);
  const result: OracleResult = {
    kind: "oracle",
    name: config.name,
    config,
    hash: AI_HASH,
    pace: PACE_HASH,
    auto: state.auto,
    ai: { t: ai.t, clean: ai.clean },
    oracle: { t: oracle.t, clean: oracle.clean, why: oracle.why },
    ratio: oracle.t / state.auto,
    gain: 1 - oracle.t / ai.t,
    corners: cs.flatMap((c) => {
      const window = corner_window(line, [oracle.trace!, ai.trace!], c);
      return window ? [{ ...c, oracle: corner_run(line, oracle.trace!, c, window), ai: corner_run(line, ai.trace!, c, window) }] : [];
    }),
  };
  write_json(`${dir}/${config.name}.result.json`, result);
  const head = `# Oracle ${config.name}: ${config.car} on seed ${config.seed} ${config.route}\n\nautolap ${state.auto.toFixed(2)} s, shipped AI ${ai.t.toFixed(2)} s, oracle ${oracle.t.toFixed(2)} s ${oracle.clean ? "clean" : `NOT CLEAN (${oracle.why})`}: ${(result.gain * 100).toFixed(1)}% under the AI. ${state.gens.length} generations of ${config.pop}.\n\n`;
  writeFileSync(`${dir}/${config.name}.gap.md`, head + gap_table(line, cs, ai.trace, oracle.trace) + "\n");
  release();
  console.log(`${config.name}: oracle ${oracle.t.toFixed(2)} s vs ai ${ai.t.toFixed(2)} s (${(result.gain * 100).toFixed(1)}%), gap report ${dir}/${config.name}.gap.md`);
}

if (import.meta.main) {
  const at = process.argv.indexOf("--jobs");
  const jobs = at >= 0 ? Number(process.argv[at + 1]) : Math.max(1, Math.floor(availableParallelism() / 4));
  await run_oracle(process.argv[2], jobs);
}

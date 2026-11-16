import { availableParallelism } from "node:os";
import { existsSync, readdirSync } from "node:fs";
import { AI_TUNING } from "../../src/ai/tuning";
import { Difficulty } from "../../src/ai/difficulty";
import { mulberry32, sub } from "../../src/rng";
import { cma_init, cma_sample, type Cma } from "../ai-tune/cma";
import { score, WEIGHTS, type Score, type Weights } from "../ai-tune/objective";
import { ALL_PARAMS, DRIVER_PARAMS, param, PARAMS, whole, type Values } from "../ai-tune/params";
import { LEVEL_3_FIELD, type FieldSetup, type RaceResult, type SoloResult } from "../ai-tune/race";
import { AI_HASH, claim, DIR, Pool, read_json, runs_dir, seed_list, write_json } from "./cache";
import type { OracleResult } from "./oracle";
import { rank, step } from "./rank";
import type { MlJob, MlResult } from "./worker";

// bun scripts/ai-ml/experiment.ts <config.json> [--jobs n]: one CMA-ES search over the named AI_TUNING and driver
// params (ai-tune/params.ts), each candidate raced as a field on every island circuit of `train` and scored by the
// config's weights over ai-tune/objective.ts. The best then races the held-out `check` seeds and runs `ai-race.ts solo`
// on `solo`, against the shipped values on the same seeds. State in .ai-ml/<hash>/runs/<name>.json after every race;
// the same command resumes. A `level` config aims the field at a share of the oracle ceiling (oracle results needed).

export interface ExperimentConfig {
  kind: "tune";
  name: string;
  /** Summary table it lands in: core, archetype or level. */
  group: string;
  note?: string;
  params: string[] | "all" | "driver" | "tuning";
  ranges?: Record<string, [number, number]>;
  pop: number;
  gens: number;
  sigma: number;
  seed?: number;
  train: string;
  check: string;
  solo: string;
  cars: number;
  laps: number;
  field?: FieldSetup;
  weights?: Partial<Weights>;
  /** A difficulty level: the field's lap over the autopilot's aims at the oracle ceiling over `fraction`. */
  level?: { name: string; fraction: number };
}

interface Candidate {
  values: Values;
  score: Score;
}

interface State {
  config: ExperimentConfig;
  hash: string;
  cma: Cma;
  auto: Record<string, number>;
  done: Record<string, RaceResult[]>;
  solo: Record<string, SoloResult[]>;
  base: Candidate | null;
  gens: { sigma: number; best: number; median: number; candidates: Candidate[] }[];
  /** Lap over the autopilot's a level aims at, fixed when the run starts. */
  target: number;
}

export interface Verdict {
  /** Spins plus resets over every held-out race, stuck races, failed solo laps of all solo laps. */
  trouble: number;
  stuck: number;
  solo_failed: number;
  solo_laps: number;
  /** Held-out field lap gain over the shipped values (share, positive faster), and the solo median gain. */
  gain: number;
  solo_gain: number;
  pass: boolean;
}

export interface ExperimentResult {
  kind: "tune";
  name: string;
  config: ExperimentConfig;
  hash: string;
  target: number;
  gens: number;
  values: Values;
  defaults: Values;
  train: { base: Score; best: Score };
  check: { base: Score; best: Score };
  verdict: Verdict;
  base_verdict: Verdict;
  minutes: number;
}

const names = (p: ExperimentConfig["params"]): string[] =>
  p === "all" ? ALL_PARAMS.map((q) => q.name) : p === "driver" ? DRIVER_PARAMS.map((q) => q.name) : p === "tuning" ? PARAMS.map((q) => q.name) : p;

/** Mean oracle lap over the autopilot's of every clean, assisted oracle result in this cache: the top of the difficulty scale, on cars as they ship. */
export function ceiling(): number {
  const dir = `${DIR}/oracle`;
  if (!existsSync(dir)) return NaN;
  const files = readdirSync(dir).filter((f) => f.endsWith(".result.json"));
  const ratios = files.map((f) => read_json<OracleResult>(`${dir}/${f}`)).flatMap((r) => (r && r.oracle.clean && r.config.assists !== false ? [r.ratio] : []));
  return ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : NaN;
}

export async function run_experiment(path: string, jobs: number) {
  const t0 = performance.now();
  const config = read_json<ExperimentConfig>(path);
  if (!config) throw new Error(`no config at ${path}`);
  const space = names(config.params).map((name) => {
    const p = param(name);
    const [lo, hi] = config.ranges?.[name] ?? [p.lo, p.hi];
    return { ...p, lo, hi };
  });
  const defaults: Values = Object.fromEntries(space.map((p) => [p.name, p.read(AI_TUNING)]));
  for (const p of space) if (defaults[p.name] < p.lo || defaults[p.name] > p.hi) throw new Error(`${p.name} default ${defaults[p.name]} outside [${p.lo}, ${p.hi}]`);
  const to_unit = (v: Values) => space.map((p) => (v[p.name] - p.lo) / (p.hi - p.lo));
  const from_unit = (x: readonly number[]): Values => whole(Object.fromEntries(space.map((p, i) => [p.name, p.lo + (p.hi - p.lo) * x[i]])));
  const train = seed_list(config.train);
  const check = seed_list(config.check);
  const solo_seeds = seed_list(config.solo);
  const setup = config.field ?? LEVEL_3_FIELD;
  if (!Object.values(Difficulty).includes(setup.difficulty)) throw new Error(`difficulty ${setup.difficulty}`);
  const state_path = `${runs_dir("runs")}/${config.name}.json`;
  const release = claim(state_path);
  let state = read_json<State>(state_path);
  if (state && (state.hash !== AI_HASH || JSON.stringify({ ...state.config, gens: 0 }) !== JSON.stringify({ ...config, gens: 0 }))) throw new Error(`${state_path} was started on other code or config; rename the experiment`);
  if (!state) {
    let target = NaN;
    if (config.level) {
      const top = ceiling();
      if (!Number.isFinite(top)) throw new Error(`${config.name} needs the oracle ceiling: run the oracle configs first`);
      target = top / config.level.fraction;
    }
    state = { config, hash: AI_HASH, cma: cma_init(to_unit(defaults), config.sigma), auto: {}, done: {}, solo: {}, base: null, gens: [], target };
  }
  state.config = config;
  const st = state;
  const weights: Weights = { ...WEIGHTS, ...config.weights, ...(config.level ? { target: st.target } : {}) };
  const save = () => write_json(state_path, st);
  const pool = new Pool<MlJob, MlResult>(new URL("./worker.ts", import.meta.url), jobs);
  pool.start();

  async function autolaps(seeds: readonly number[]) {
    const missing = seeds.filter((seed) => !Object.keys(st.auto).some((key) => key.startsWith(`${seed}/`)));
    const results = await pool.run(missing.map((seed): MlJob => ({ type: "auto", id: `auto/${seed}`, seed })));
    for (const r of results) if (r.type === "auto") for (const [route, t] of Object.entries(r.laps)) st.auto[`${r.seed}/${route}`] = t;
    if (missing.length) save();
  }

  async function evaluate(entries: readonly { key: string; values: Values }[], seeds: readonly number[], floor = 0): Promise<Score[]> {
    await autolaps(seeds);
    const todo: MlJob[] = [];
    for (const { key, values } of entries) for (const seed of seeds) if (!st.done[`${key}/${seed}`]) todo.push({ type: "race", id: `${key}/${seed}`, seed, values, cars: config!.cars, laps: config!.laps, setup });
    await pool.run(todo, (r) => {
      if (r.type !== "race") return;
      st.done[r.id] = r.races;
      save();
    });
    return entries.map(({ key }) => score(seeds.flatMap((seed) => st.done[`${key}/${seed}`].map((race) => ({ seed, race }))), st.auto, config!.laps, floor, weights));
  }

  async function solo(key: string, values: Values): Promise<SoloResult[]> {
    const todo = solo_seeds.filter((seed) => !st.solo[`${key}/${seed}`]).map((seed): MlJob => ({ type: "solo", id: `${key}/${seed}`, seed, values, assists: setup.assists !== false }));
    await pool.run(todo, (r) => {
      if (r.type !== "solo") return;
      st.solo[r.id] = r.solos;
      save();
    });
    return solo_seeds.flatMap((seed) => st.solo[`${key}/${seed}`]);
  }

  const BASE = "base";
  if (!st.base) {
    const [s] = await evaluate([{ key: BASE, values: defaults }], train);
    st.base = { values: defaults, score: s };
    save();
  }
  const base = st.base;
  while (st.cma.gen < config.gens) {
    const g = st.cma.gen;
    const samples = cma_sample(st.cma, config.pop, mulberry32(sub(config.seed ?? 1, `ai-ml-${config.name}-${g}`)));
    const list = samples.map((s) => from_unit(s.x));
    const all = await evaluate(list.map((values, k) => ({ key: `g${g}/${k}`, values })), train, base.score.passes);
    const order = rank(all.map((s) => s.loss), `${config.name} gen ${g}`);
    st.gens.push({ sigma: st.cma.sigma, best: all[order[0]].loss, median: all[order[order.length >> 1]].loss, candidates: list.map((values, k) => ({ values, score: all[k] })) });
    st.cma = step(st.cma, samples, order);
    save();
    console.log(`${config.name} gen ${g}: best ${all[order[0]].loss.toFixed(2)} median ${all[order[order.length >> 1]].loss.toFixed(2)} sigma ${st.gens[g].sigma.toFixed(3)} (defaults ${base.score.loss.toFixed(2)})`);
  }
  const best = [base, ...st.gens.flatMap((g) => g.candidates)].reduce((a, b) => (b.score.loss < a.score.loss ? b : a));
  // Keyed by the values: a run resumed with more gens may pick another best, which must not inherit the old one's races.
  const best_key = `best-${Bun.hash(JSON.stringify(best.values)).toString(36)}`;
  const [base_check] = await evaluate([{ key: `check-${BASE}`, values: defaults }, { key: `check-${best_key}`, values: best.values }], check);
  const [best_check] = await evaluate([{ key: `check-${best_key}`, values: best.values }], check, base_check.passes);
  const base_solo = await solo(BASE, defaults);
  const best_solo = await solo(best_key, best.values);
  pool.stop();
  const races_of = (key: string) => check.flatMap((seed) => st.done[`${key}/${seed}`]);
  const median = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1];
  const verdict = (key: string, solos: SoloResult[], pace: number): Verdict => {
    const races = races_of(key);
    const trouble = races.reduce((s, r) => s + r.spins + r.resets, 0);
    const stuck = races.filter((r) => r.stuck).length;
    const solo_failed = solos.filter((s) => s.failed).length;
    const solo_gain = 1 - median(solos.map((s, i) => s.t / base_solo[i].t));
    return { trouble, stuck, solo_failed, solo_laps: solos.length, gain: 1 - pace / base_check.pace, solo_gain, pass: trouble === 0 && stuck === 0 && solo_failed === 0 };
  };
  const result: ExperimentResult = {
    kind: "tune",
    name: config.name,
    config,
    hash: AI_HASH,
    target: st.target,
    gens: st.gens.length,
    values: best.values,
    defaults,
    train: { base: base.score, best: best.score },
    check: { base: base_check, best: best_check },
    verdict: verdict(`check-${best_key}`, best_solo, best_check.pace),
    base_verdict: verdict(`check-${BASE}`, base_solo, base_check.pace),
    minutes: (performance.now() - t0) / 60000,
  };
  write_json(`${runs_dir("runs")}/${config.name}.result.json`, result);
  release();
  console.log(`${config.name}: ${result.verdict.pass ? "PASS" : "FAIL"} gain ${(result.verdict.gain * 100).toFixed(1)}% held-out, trouble ${result.verdict.trouble}, solo ${result.verdict.solo_laps - result.verdict.solo_failed}/${result.verdict.solo_laps}`);
}

if (import.meta.main) {
  const at = process.argv.indexOf("--jobs");
  const jobs = at >= 0 ? Number(process.argv[at + 1]) : Math.max(1, Math.floor(availableParallelism() / 4));
  await run_experiment(process.argv[2], jobs);
}

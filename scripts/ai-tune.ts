import { availableParallelism } from "node:os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mulberry32, sub } from "../src/rng";
import { cma_init, cma_sample, cma_update, type Cma, type Sample } from "./ai-tune/cma";
import { score, type Score } from "./ai-tune/objective";
import { defaults, PARAMS, type Values } from "./ai-tune/params";
import type { RaceResult, TuneJob, TuneResult } from "./ai-tune/worker";
import { run_pool } from "./proof/pool";

// bun scripts/ai-tune.ts [--run name] [--seeds 0-7] [--check 8-19|none] [--pop 8] [--gens 4] [--sigma 0.2] [--cars 6]
// [--laps 2] [--seed 1] [--jobs 3]: a CMA-ES search over the AI's tuning numbers (ai-tune/params.ts), each candidate
// raced as a level 3 field of coupes on every island circuit of --seeds and scored by ai-tune/objective.ts. State is in
// .ai-tune/<run>.json after every race, so the same command resumes, and a larger --gens extends a finished run. At the
// end the best candidate and the defaults race the held-out --check seeds. --eval <file.json> races one values file.
// Heavy: run it through `hq lock run --`; --jobs defaults to a quarter of the machine, one heavy slot's share.

const DIR = ".ai-tune";
const STATE_VERSION = 1;

const arg = (name: string, fallback: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : fallback;
};

function seed_list(text: string): number[] {
  if (text === "none") return [];
  return text.split(",").flatMap((part) => {
    const [a, b] = part.split("-").map(Number);
    return b === undefined ? [a] : Array.from({ length: b - a + 1 }, (_, i) => a + i);
  });
}

interface Config {
  seeds: number[];
  pop: number;
  sigma: number;
  cars: number;
  laps: number;
  seed: number;
  params: string[];
}

interface Candidate {
  values: Values;
  score: Score;
}

interface Gen {
  sigma: number;
  candidates: Candidate[];
}

interface State {
  version: number;
  config: Config;
  cma: Cma;
  /** `<seed>/<route>`: the autopilot's lap (s). */
  auto: Record<string, number>;
  /** `<tag>/<seed>`: one candidate's races on one seed, kept as they land so a killed run loses only the races in flight. */
  done: Record<string, RaceResult[]>;
  base: Candidate | null;
  gens: Gen[];
}

const config: Config = {
  seeds: seed_list(arg("--seeds", "0-7")),
  pop: Number(arg("--pop", "8")),
  sigma: Number(arg("--sigma", "0.2")),
  cars: Number(arg("--cars", "6")),
  laps: Number(arg("--laps", "2")),
  seed: Number(arg("--seed", "1")),
  params: PARAMS.map((p) => p.name),
};
const run = arg("--run", "tune");
const gens = Number(arg("--gens", "4"));
const check = seed_list(arg("--check", "8-19"));
const jobs = Math.max(1, Number(arg("--jobs", String(Math.max(1, Math.floor(availableParallelism() / 4))))));
const path = `${DIR}/${run}.json`;
const WORKER = new URL("./ai-tune/worker.ts", import.meta.url);

const to_unit = (values: Values) => PARAMS.map((p) => (values[p.name] - p.lo) / (p.hi - p.lo));
const from_unit = (x: readonly number[]): Values => Object.fromEntries(PARAMS.map((p, i) => [p.name, p.lo + (p.hi - p.lo) * x[i]]));

function load(): State {
  const base = defaults();
  for (const p of PARAMS) if (base[p.name] < p.lo || base[p.name] > p.hi) throw new Error(`${p.name} default ${base[p.name]} outside [${p.lo}, ${p.hi}]`);
  if (!existsSync(path)) return { version: STATE_VERSION, config, cma: cma_init(to_unit(base), config.sigma), auto: {}, done: {}, base: null, gens: [] };
  const state = JSON.parse(readFileSync(path, "utf8")) as State;
  if (state.version !== STATE_VERSION) throw new Error(`${path} is version ${state.version}, expected ${STATE_VERSION}`);
  if (JSON.stringify(state.config) !== JSON.stringify(config)) throw new Error(`${path} was started with ${JSON.stringify(state.config)}; pass the same options or a new --run`);
  return state;
}

const state = load();
const save = () => {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(path, JSON.stringify(state));
};

async function autolaps(seeds: readonly number[]) {
  const missing = seeds.filter((seed) => !Object.keys(state.auto).some((key) => key.startsWith(`${seed}/`)));
  if (!missing.length) return;
  const results = await run_pool<TuneJob, TuneResult>(WORKER, missing.map((seed) => ({ type: "auto", id: `auto/${seed}`, seed })), jobs);
  for (const r of results) if (r.type === "auto") for (const [route, t] of Object.entries(r.laps)) state.auto[`${r.seed}/${route}`] = t;
  save();
}

interface Entry {
  /** State key prefix: `<key>/<seed>` holds its races on a seed, so a resumed run races only what is missing. */
  key: string;
  values: Values;
}

async function evaluate(entries: readonly Entry[], seeds: readonly number[]): Promise<Score[]> {
  await autolaps(seeds);
  const todo: TuneJob[] = [];
  for (const { key, values } of entries) for (const seed of seeds) if (!state.done[`${key}/${seed}`]) todo.push({ type: "race", id: `${key}/${seed}`, seed, values, cars: config.cars, laps: config.laps });
  if (todo.length) {
    const t0 = performance.now();
    await run_pool<TuneJob, TuneResult>(WORKER, todo, jobs, (r, n) => {
      if (r.type !== "race") return;
      state.done[r.id] = r.races;
      save();
      process.stderr.write(`\r${n}/${todo.length} races in ${((performance.now() - t0) / 1000).toFixed(0)} s   `);
    });
    process.stderr.write("\n");
  }
  return entries.map(({ key }) => score(seeds.flatMap((seed) => state.done[`${key}/${seed}`].map((race) => ({ seed, race }))), state.auto, config.laps));
}

const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "-");
const best_of = (base: Candidate): Candidate => [base, ...state.gens.flatMap((g) => g.candidates)].reduce((a, b) => (b.score.loss < a.score.loss ? b : a));

function score_rows(columns: [string, Score][]) {
  const rows: [string, (s: Score) => string][] = [
    ["races", (s) => String(s.races)],
    ["loss", (s) => fmt(s.loss)],
    ["lap vs autolap", (s) => `${fmt((s.pace - 1) * 100, 1)}%`],
    ["overtakes / race", (s) => fmt(s.passes)],
    ["spins + resets / race", (s) => fmt(s.trouble)],
    ["reverses / race", (s) => fmt(s.reverses)],
    ["hardest hit mean (worst)", (s) => `${fmt(s.hardest, 1)} (${fmt(s.worst, 1)})`],
    ["races out of contact band", (s) => `${fmt(s.band * 100, 0)}%`],
    ["mean rho", (s) => fmt(s.rho)],
    ["stuck", (s) => `${fmt(s.stuck * 100, 0)}%`],
  ];
  console.log(`| | ${columns.map(([name]) => name).join(" | ")} |`);
  console.log(`|---|${columns.map(() => "---").join("|")}|`);
  for (const [name, f] of rows) console.log(`| ${name} | ${columns.map(([, s]) => f(s)).join(" | ")} |`);
}

if (process.argv.includes("--eval")) {
  const file = arg("--eval", "");
  const values = file === "default" ? defaults() : { ...defaults(), ...(JSON.parse(readFileSync(file, "utf8")) as { values: Values }).values };
  const [s] = await evaluate([{ key: `eval-${file}`, values }], config.seeds);
  score_rows([[file, s]]);
  process.exit(0);
}

let base = state.base;
while (state.cma.gen < gens || !base) {
  const g = state.cma.gen;
  const samples = g < gens ? cma_sample(state.cma, config.pop, mulberry32(sub(config.seed, `ai-tune-${g}`))) : [];
  const list = samples.map((s) => from_unit(s.x));
  const entries = [...(base ? [] : [{ key: "base", values: defaults() }]), ...list.map((values, k) => ({ key: `g${g}/${k}`, values }))];
  const all = await evaluate(entries, config.seeds);
  if (!base) {
    base = state.base = { values: defaults(), score: all[0] };
    all.shift();
  }
  if (!samples.length) break;
  const order = all.map((_, k) => k).sort((a, b) => all[a].loss - all[b].loss);
  state.gens.push({ sigma: state.cma.sigma, candidates: list.map((values, k) => ({ values, score: all[k] })) });
  state.cma = cma_update(state.cma, order.map((k): Sample => samples[k]));
  save();
  console.log(`gen ${g}: best ${fmt(all[order[0]].loss)} median ${fmt(all[order[order.length >> 1]].loss)} sigma ${fmt(state.gens[g].sigma, 3)}; best so far ${fmt(best_of(base).score.loss)} (defaults ${fmt(base.score.loss)})`);
}
save();

const best = best_of(base);
console.log(`\n${run}: ${state.gens.length} generations of ${config.pop}, seeds ${config.seeds.join(",")}, ${config.cars} cars x ${config.laps} laps\n`);
console.log("| gen | sigma | best | median |\n|---|---|---|---|");
state.gens.forEach((g, i) => {
  const losses = g.candidates.map((c) => c.score.loss).sort((a, b) => a - b);
  console.log(`| ${i} | ${fmt(g.sigma, 3)} | ${fmt(losses[0])} | ${fmt(losses[losses.length >> 1])} |`);
});
console.log("\n| parameter | default | best | range |\n|---|---|---|---|");
for (const p of PARAMS) console.log(`| ${p.name} | ${fmt(base.values[p.name], 3)} | ${fmt(best.values[p.name], 3)} | ${p.lo}-${p.hi} |`);
console.log("");
const columns: [string, Score][] = [["defaults (train)", base.score], ["best (train)", best.score]];
if (check.length) {
  const [base_check, best_check] = await evaluate([{ key: `check-base`, values: base.values }, { key: `check-g${state.gens.length}`, values: best.values }], check);
  columns.push(["defaults (check)", base_check], ["best (check)", best_check]);
}
score_rows(columns);
writeFileSync(`${DIR}/${run}.best.json`, JSON.stringify({ run, config, score: best.score, values: best.values }, null, 2));
console.log(`\nbest values: ${DIR}/${run}.best.json`);

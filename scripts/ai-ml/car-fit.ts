import { availableParallelism } from "node:os";
import { mkdirSync } from "node:fs";
import { COUPE, car_spec, type CarAi } from "../../src/car/cars";
import { capability } from "../../src/ai/capability";
import { stat_pace } from "../../src/car/pi";
import { mulberry32, sub } from "../../src/rng";
import { cma_init, cma_sample, type Cma } from "../ai-tune/cma";
import type { RaceResult, SoloResult } from "../ai-tune/race";
import { Pool, read_json, ROOT, seed_list, write_json } from "./cache";
import { rank, step } from "./rank";
import type { MlJob, MlResult } from "./worker";

// bun scripts/ai-ml/car-fit.ts <car> [--name n] [--from slow,fast,brake|0.53] [--span s] [--hard] [--accept n] [--train 50-73] [--pop 6] [--gens 4] [--sigma 0.15] [--jobs n] [--minutes m]:
// a CMA-ES search over the car's `ai` block (CarSpec.ai: slow, fast, brake), each candidate a 6-car 2-lap field of the
// car on every island circuit of `train` plus a solo lap on each. It starts at `from` (`0.53`: the block that plans as 0.53
// did), or where the coupe's grip caps the car's own; each factor searches `span` either side.
// --hard: no trouble, no stuck race and every solo lap clean are constraints, not loss: a candidate that breaks one ranks
// under every one that keeps them. After the search the `accept` fastest that keep them on train run the bar, and the
// first that keeps them there too is the pick.
// State in .ai-ml/car-fit/<name>.json after every seed; it stops starting work past `minutes` and the same command resumes.
// bun scripts/ai-ml/car-fit.ts <car> --bar [--ai slow,fast,brake|0.53] [--jobs n]: the bar, a field on seeds 0-49 and a solo
// lap on 0-24, printed as scratch sweep lines (`seed S races R spins X resets Y stuck Z lap L`) and the solo summary.
// --eps e (bar and fit): every factor times 1 + e, 1e-7 to 1e-5: another draw of the same block. One bar swings 3 trouble
// on noise alone, so judge trouble on the mean of three.

const KEYS = ["slow", "fast", "brake"] as const;
/** Each factor's search box around its start, by default. */
const SPAN = 0.25;
/** --hard: loss a candidate starts from when it breaks a constraint, over any pace a kept one can score. */
const BROKEN = 1000;
/** Loss points: per 1% of lap over the start's, per spin or reset a race, per failed solo lap. */
const PACE = 2;
const TROUBLE = 6;
const SOLO_FAIL = 6;
const STUCK = 40;
const BAR_SEEDS = "0-49";
const SOLO_SEEDS = "0-24";

interface Eval {
  races: RaceResult[];
  solos: SoloResult[];
}

interface State {
  car: string;
  train: string;
  start: CarAi;
  /** Absent on runs from before them: SPAN, and not hard. */
  span?: number;
  hard?: boolean;
  /** Absent on runs from before it: 0. */
  eps?: number;
  cma: Cma;
  done: Record<string, Eval>;
  gens: { sigma: number; candidates: { ai: CarAi; loss: number }[] }[];
}

const arg = (name: string, fallback: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : fallback;
};

/** The car's ai block that plans its grip at the coupe's where it measures more: the v3 variant of t338. */
function capped(car: string): CarAi {
  const c = capability(car_spec(car));
  const ref = capability(COUPE);
  return { slow: Math.min(1, ref.slow / c.slow), fast: Math.min(1, ref.fast / c.fast), brake: 1 };
}

/** m/s the 0.53 grip share was read at (`grip_pace` in 0.53's field.ts). */
const OLD_GRIP_AT = 20;

/**
 * The car's ai block that plans as 0.53 did: on the coupe's numbers, its speeds times the stat grip share under the
 * coupe's (`grip_pace`, capped at 1). Speeds times g are every planned m/s² times g², so the share goes in squared.
 */
function shipped(car: string): CarAi {
  const spec = car_spec(car);
  const c = capability(spec);
  const ref = capability(COUPE);
  const g = Math.min(1, stat_pace(spec).lateral(OLD_GRIP_AT) / stat_pace(COUPE).lateral(OLD_GRIP_AT)) ** 2;
  return { slow: Number(((g * ref.slow) / c.slow).toFixed(4)), fast: Number(((g * ref.fast) / c.fast).toFixed(4)), brake: Number(((g * ref.brake) / c.brake).toFixed(4)) };
}

const from_list = ([slow, fast, brake]: readonly number[]): CarAi => ({ slow, fast, brake });

const ai_key = (ai: CarAi) => KEYS.map((k) => ai[k].toFixed(4)).join(",");

function lap_of(races: readonly RaceResult[]): { sum: number; n: number } {
  let sum = 0;
  let n = 0;
  for (const r of races) {
    if (!r.finished) continue;
    sum += r.lap * r.finished;
    n += r.finished;
  }
  return { sum, n };
}

function summary(evals: readonly Eval[]) {
  const races = evals.flatMap((e) => e.races);
  const solos = evals.flatMap((e) => e.solos);
  const { sum, n } = lap_of(races);
  return {
    lap: n ? sum / n : NaN,
    trouble: races.reduce((s, r) => s + r.spins + r.resets, 0),
    stuck: races.filter((r) => r.stuck).length,
    solo_failed: solos.filter((s) => s.failed).length,
    solo_laps: solos.length,
    races: races.length,
  };
}

async function evaluate(pool: Pool<MlJob, MlResult>, car: string, entries: readonly CarAi[], seeds: readonly number[], solo_seeds: readonly number[], done: Record<string, Eval>, save: () => void, deadline: number): Promise<boolean> {
  const todo: MlJob[] = [];
  for (const ai of entries) for (const seed of seeds) if (!done[`${ai_key(ai)}/${seed}`]) todo.push({ type: "car", id: `${ai_key(ai)}/${seed}`, seed, car, ai, solo: solo_seeds.includes(seed), eps });
  for (let i = 0; i < todo.length; i += pool_size) {
    if (performance.now() > deadline) return false;
    await pool.run(todo.slice(i, i + pool_size), (r) => {
      if (r.type !== "car") return;
      done[r.id] = { races: r.races, solos: r.solos };
      save();
    });
  }
  return true;
}

const eps = Number(arg("eps", "0"));
const jobs = Number(arg("jobs", String(Math.max(1, availableParallelism() - 2))));
const pool_size = jobs;

const kept = (s: ReturnType<typeof summary>) => s.trouble === 0 && s.stuck === 0 && s.solo_failed === 0;

/** The bar's evals of `ai`: the fields on `seeds`, the solo laps only on `solo_seeds`. */
const bar_evals = (ai: CarAi, seeds: readonly number[], solo_seeds: readonly number[], done: Record<string, Eval>): Eval[] =>
  seeds.map((seed) => ({ races: done[`${ai_key(ai)}/${seed}`].races, solos: solo_seeds.includes(seed) ? done[`${ai_key(ai)}/${seed}`].solos : [] }));

function print_bar(car: string, ai: CarAi, seeds: readonly number[], solo_seeds: readonly number[], done: Record<string, Eval>) {
  for (const seed of seeds) {
    const { races } = done[`${ai_key(ai)}/${seed}`];
    const { sum, n } = lap_of(races);
    const where = races.map((r) => `${r.route}:${r.spins}/${r.resets}`).join(" ");
    console.log(`seed ${seed} races ${races.length} spins ${races.reduce((s, r) => s + r.spins, 0)} resets ${races.reduce((s, r) => s + r.resets, 0)} stuck ${races.filter((r) => r.stuck).length} lap ${n ? (sum / n).toFixed(2) : "-"} ${where}`);
  }
  for (const seed of solo_seeds) for (const s of done[`${ai_key(ai)}/${seed}`].solos) if (s.failed) console.log(`solo seed ${seed} ${s.route} FAILED: ${s.done ? "" : "stopped, "}off ${s.offroad.toFixed(2)} s, ${((s.t / s.auto - 1) * 100).toFixed(1)}% vs auto`);
  const solos = solo_seeds.flatMap((seed) => done[`${ai_key(ai)}/${seed}`].solos);
  const ratios = solos.map((s) => s.t / s.auto).sort((a, b) => a - b);
  const pct = (r: number) => `${((r - 1) * 100).toFixed(1)}%`;
  const failed = solos.filter((s) => s.failed).length;
  console.log(`solo ${car} ai ${ai_key(ai)}`);
  console.log(`${ratios.length} laps: ai vs auto min ${pct(ratios[0])}, median ${pct(ratios[ratios.length >> 1])}, max ${pct(ratios[ratios.length - 1])}; ${failed ? `${failed} FAILED` : "all within"} (slack 5%)`);
  const s = summary(bar_evals(ai, seeds, solo_seeds, done));
  console.log(`bar ${car} ai ${ai_key(ai)}: lap ${s.lap.toFixed(3)} trouble ${s.trouble} stuck ${s.stuck} solo ${s.solo_laps - s.solo_failed}/${s.solo_laps}`);
}

const ai_arg = (car: string, text: string): CarAi => (text === "0.53" ? shipped(car) : from_list(text.split(",").map(Number)));

async function bar(car: string) {
  const spec = car_spec(car);
  const given = arg("ai", "");
  const ai: CarAi = given ? ai_arg(car, given) : (spec.ai ?? { slow: 1, fast: 1, brake: 1 });
  const seeds = seed_list(arg("seeds", BAR_SEEDS));
  const solo_seeds = seed_list(arg("solo", SOLO_SEEDS));
  const done: Record<string, Eval> = {};
  const pool = new Pool<MlJob, MlResult>(new URL("./worker.ts", import.meta.url), jobs);
  pool.start();
  await evaluate(pool, car, [ai], seeds, solo_seeds, done, () => {}, Infinity);
  pool.stop();
  print_bar(car, ai, seeds, solo_seeds, done);
}

async function fit(car: string) {
  const name = arg("name", car);
  const train = arg("train", "50-73");
  const pop = Number(arg("pop", "6"));
  const gens = Number(arg("gens", "4"));
  const sigma = Number(arg("sigma", "0.15"));
  const deadline = performance.now() + Number(arg("minutes", "8.5")) * 60000;
  const seeds = seed_list(train);
  const dir = `${ROOT}/car-fit`;
  mkdirSync(dir, { recursive: true });
  const path = `${dir}/${name}.json`;
  const from = arg("from", "");
  const start = from ? ai_arg(car, from) : capped(car);
  const span = Number(arg("span", String(SPAN)));
  const hard = process.argv.includes("--hard");
  const box = (k: (typeof KEYS)[number]) => [start[k] * (1 - span), start[k] * (1 + span)] as const;
  const to_ai = (x: readonly number[]): CarAi => from_list(KEYS.map((k, i) => Number((box(k)[0] + (box(k)[1] - box(k)[0]) * x[i]).toFixed(4))));
  let st = read_json<State>(path);
  if (st && (st.car !== car || st.train !== train || ai_key(st.start) !== ai_key(start) || (st.span ?? SPAN) !== span || (st.hard ?? false) !== hard || (st.eps ?? 0) !== eps)) throw new Error(`${path} was started on ${st.car} ${st.train} from ${ai_key(st.start)} span ${st.span ?? SPAN}${st.hard ? " hard" : ""} eps ${st.eps ?? 0}`);
  st ??= { car, train, start, span, hard, eps, cma: cma_init([0.5, 0.5, 0.5], sigma), done: {}, gens: [] };
  const state = st;
  const save = () => write_json(path, state);
  const pool = new Pool<MlJob, MlResult>(new URL("./worker.ts", import.meta.url), jobs);
  pool.start();
  const loss_of = (ai: CarAi, base_lap: number) => {
    const s = summary(seeds.map((seed) => state.done[`${ai_key(ai)}/${seed}`]));
    const broken = TROUBLE * s.trouble + SOLO_FAIL * s.solo_failed + STUCK * s.stuck;
    if (hard) return kept(s) ? PACE * 100 * (s.lap / base_lap - 1) : BROKEN + broken;
    return PACE * 100 * (s.lap / base_lap - 1) + broken;
  };
  try {
    if (!(await evaluate(pool, car, [state.start], seeds, seeds, state.done, save, deadline))) return console.log(`${name}: out of time at the start point; rerun to resume`);
    const base_lap = summary(seeds.map((seed) => state.done[`${ai_key(state.start)}/${seed}`])).lap;
    while (state.cma.gen < gens) {
      const g = state.cma.gen;
      const samples = cma_sample(state.cma, pop, mulberry32(sub(1, `car-fit-${name}-${g}`)));
      const list = samples.map((s) => to_ai(s.x));
      if (!(await evaluate(pool, car, list, seeds, seeds, state.done, save, deadline))) return console.log(`${name}: out of time in gen ${g}; rerun to resume`);
      const losses = list.map((ai) => loss_of(ai, base_lap));
      const order = rank(losses, `${name} gen ${g}`);
      state.gens.push({ sigma: state.cma.sigma, candidates: list.map((ai, k) => ({ ai, loss: losses[k] })) });
      state.cma = step(state.cma, samples, order);
      save();
      console.log(`${name} gen ${g}: best ${losses[order[0]].toFixed(2)} ${ai_key(list[order[0]])} median ${losses[order[order.length >> 1]].toFixed(2)}`);
    }
    const all = [{ ai: state.start, loss: loss_of(state.start, base_lap) }, ...state.gens.flatMap((g) => g.candidates)];
    all.sort((a, b) => a.loss - b.loss);
    for (const c of all.slice(0, 5)) {
      const s = summary(seeds.map((seed) => state.done[`${ai_key(c.ai)}/${seed}`]));
      console.log(`${ai_key(c.ai)} loss ${c.loss.toFixed(2)} lap ${s.lap.toFixed(2)} (start ${base_lap.toFixed(2)}) trouble ${s.trouble} stuck ${s.stuck} solo ${s.solo_laps - s.solo_failed}/${s.solo_laps}`);
    }
    if (hard) await accept(pool, car, name, all.filter((c) => c.loss < BROKEN).map((c) => c.ai), state.done, save, deadline);
  } finally {
    pool.stop();
  }
}

/** The bar on each candidate in turn, fastest on train first, until one keeps every constraint there too. */
async function accept(pool: Pool<MlJob, MlResult>, car: string, name: string, candidates: readonly CarAi[], done: Record<string, Eval>, save: () => void, deadline: number) {
  const seeds = seed_list(BAR_SEEDS);
  const solo_seeds = seed_list(SOLO_SEEDS);
  for (const ai of candidates.slice(0, Number(arg("accept", "3")))) {
    if (!(await evaluate(pool, car, [ai], seeds, solo_seeds, done, save, deadline))) return console.log(`${name}: out of time on the bar; rerun to resume`);
    print_bar(car, ai, seeds, solo_seeds, done);
    if (kept(summary(bar_evals(ai, seeds, solo_seeds, done)))) return console.log(`${name}: accept ${ai_key(ai)}`);
  }
  console.log(`${name}: no candidate keeps the bar; fall back to 0.53's plan (${ai_key(shipped(car))})`);
}

const car = process.argv[2];
if (!car) throw new Error("car-fit.ts <car>");
if (process.argv.includes("--bar")) await bar(car);
else await fit(car);

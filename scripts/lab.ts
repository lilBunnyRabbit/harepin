import { build_spec, parse_build } from "../src/car/build";
import { SteerMode } from "../src/car/car";
import { is_car, type CarSpec } from "../src/car/cars";
import { CLASS_LABELS, class_of, spec_pi } from "../src/car/pi";
import { budget, drive_seconds, MAX_SECONDS, MAX_TRIALS, minutes, over_budget } from "../src/lab/budget";
import { goal_text, mods_text, short } from "../src/lab/export";
import { resolve_pack, spec_hash, type Resolved } from "../src/lab/pack";
import { PACKS } from "../src/lab/packs";
import { pool_size, run_pool } from "./proof/pool";
import type { GroundName } from "./grounds";
import { diff_files } from "./lab/diff";
import { diff_handling, golden_line, read_handling, write_handling, type Moved } from "./lab/handling-golden";
import { setups, type Setup } from "./lab/setups";
import { STOP_FROM_KMH, type SimValues } from "./lab/sims";
import type { LabJob, LabResult } from "./lab/worker";

const WORKER = new URL("./lab/worker.ts", import.meta.url);
const JOBS = pool_size(process.argv);
const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !["--jobs", "--base"].includes(all[i - 1]));

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at < 0 ? undefined : process.argv[at + 1];
}

const progress = (done: number, of: number) => process.stderr.write(`\r${done}/${of}${done === of ? "\n" : ""}`);

function failed(results: LabResult[], label: (i: number) => string): string[] {
  return results.flatMap((r, i) => (r.kind === "error" ? [`${label(i)}: ${r.message}`] : []));
}

const values_text = (values: SimValues, stop_from: number) => values.map(([key, v]) => `${key}=${short(v)}${key === "stop" ? `@${stop_from}` : ""}`).join(" ");

function delta_text(values: SimValues, base: SimValues): string {
  const from = new Map(base);
  return values.flatMap(([key, v]) => {
    const b = from.get(key);
    if (b === undefined) return [];
    const d = v - b;
    return [`${key}=${d < 0 ? "" : "+"}${short(d)}`];
  }).join(" ");
}

function trial_job(r: Resolved): LabJob {
  return { kind: "trial", spec: r.spec, station: r.station.id, surface: r.lane.surface, mode: r.trial.aids?.steer_mode ?? SteerMode.SMOOTH, stop_from: r.trial.goal.kind === "stop" ? r.trial.goal.from_kmh : STOP_FROM_KMH };
}

async function run_pack(id: string): Promise<number> {
  const load = PACKS[id];
  if (!load) throw new Error(`unknown pack "${id}", expected matrix or one of ${Object.keys(PACKS).join(", ")}`);
  const pack = (await load()).default;
  const trials = resolve_pack(pack);
  const named = flag("--base");
  const fixed = named === undefined ? -1 : trials.findIndex((r) => r.trial.id === named);
  if (named !== undefined && fixed < 0) throw new Error(`no trial "${named}" in ${pack.id}`);

  const keys = trials.map((r) => JSON.stringify(trial_job(r)));
  const unique = [...new Set(keys)];
  const ran = await run_pool<LabJob, LabResult>(WORKER, unique.map((k) => JSON.parse(k) as LabJob), JOBS, (_, done) => progress(done, unique.length));
  const results = keys.map((k) => ran[unique.indexOf(k)]);
  const sims = results.map((r) => (r.kind === "trial" ? r.sim : null));
  // Until packs mark their own base (plan P5), a trial reads against the pack's first trial that ran the same scenarios.
  const base_of = (i: number) => (fixed >= 0 ? fixed : sims.findIndex((s) => s?.scenario === sims[i]?.scenario));

  console.log(`#sim ${pack.id} r${pack.rev} base ${named ?? "first trial per scenario"}`);
  trials.forEach((r, i) => {
    const { trial } = r;
    console.log(`#trial ${trial.id} ${trial.car}${mods_text(trial.mods)} spec#${r.hash} pi${r.pi}${CLASS_LABELS[r.class]} ${trial.station}/${r.lane.name} ${goal_text(trial.goal)} est ${minutes(drive_seconds(r))}`);
    const sim = sims[i];
    if (!sim) return;
    if (!sim.values.length) return console.log(" sim -");
    console.log(` sim ${values_text(sim.values, sim.stop_from)}${sim.ground === r.lane.surface ? "" : ` on ${sim.ground}`}`);
    const base = base_of(i);
    const delta = base === i ? "" : delta_text(sim.values, sims[base]?.values ?? []);
    if (delta) console.log(` d ${delta} vs ${trials[base].trial.id}`);
  });
  const b = budget(trials);
  console.log(`#end ${b.trials} trials, drive ${minutes(b.drive)} + cards ${minutes(b.cards)} = ${minutes(b.total)}`);

  const errors = failed(results, (i) => trials[i].trial.id);
  for (const e of errors) console.error(`sim failed: ${e}`);
  if (over_budget(b)) console.error(`over budget: ${b.trials} trials (cap ${MAX_TRIALS}), ${minutes(b.total)} (cap ${minutes(MAX_SECONDS)})`);
  return errors.length || over_budget(b) ? 1 : 0;
}

const num = (v: number, digits: number) => (Number.isNaN(v) ? "-" : v.toFixed(digits));

const COLUMNS = ["setup", "ground", "spec#", "PI", "0-100 s", "top km/h", "100-0 m", "skidpad g", "turn-in ms to 0.2 rad/s", "lift-off °", "power-on °", "flick °", "kick 220 s"];

interface Row {
  setup: Setup;
  spec: CarSpec;
  ground: GroundName;
}

async function run_traits(car?: string): Promise<{ rows: Row[]; results: LabResult[] }> {
  if (car !== undefined && !is_car(car)) throw new Error(`unknown car "${car}"`);
  const rows = setups(car).flatMap((s) => {
    const build = parse_build(s.code);
    if (!build) throw new Error(`${s.id}: bad build code ${s.code}`);
    const spec = build_spec(build);
    return s.grounds.map((ground) => ({ setup: s, spec, ground }));
  });
  const jobs: LabJob[] = rows.map(({ spec, ground }) => ({ kind: "traits", spec, ground }));
  const results = await run_pool<LabJob, LabResult>(WORKER, jobs, JOBS, (_, done) => progress(done, jobs.length));
  const errors = failed(results, (i) => `${rows[i].setup.id} ${rows[i].ground}`);
  for (const e of errors) console.error(`sim failed: ${e}`);
  return { rows, results };
}

async function run_matrix(car?: string): Promise<number> {
  const { rows, results } = await run_traits(car);

  console.log(`| ${COLUMNS.join(" | ")} |`);
  console.log(`|${COLUMNS.map(() => "---").join("|")}|`);
  const rated = new Map<string, string>();
  rows.forEach(({ setup, spec, ground }, i) => {
    const r = results[i];
    if (r.kind !== "traits") return;
    const pi = rated.get(setup.id) ?? `${spec_pi(spec)} ${CLASS_LABELS[class_of(spec_pi(spec))]}`;
    rated.set(setup.id, pi);
    const t = r.traits;
    const cells = [setup.id, ground, spec_hash(spec), pi, t.t100.toFixed(2), t.top.toFixed(0), num(t.stop, 1), t.g.toFixed(2), (t.turn * 1000).toFixed(0), t.lift.toFixed(1), t.pwr.toFixed(1), t.hb.toFixed(0), num(t.kick, 2)];
    console.log(`| ${cells.join(" | ")} |`);
  });
  return results.some((r) => r.kind === "error") ? 1 : 0;
}

async function run_golden(check: boolean): Promise<Moved[] | null> {
  const { rows, results } = await run_traits();
  if (results.some((r) => r.kind === "error")) return null;
  const lines = rows.flatMap(({ setup, spec, ground }, i) => {
    const r = results[i];
    return r.kind === "traits" ? [golden_line(setup, ground, spec, r.traits)] : [];
  });
  if (!check) {
    write_handling(lines);
    console.log(`wrote scripts/golden/handling.txt: ${lines.length} rows`);
    return [];
  }
  const moved = diff_handling(read_handling(), lines);
  for (const m of moved) console.log(`${m.key}: ${m.fields.join(", ")}`);
  console.log(moved.length ? `${moved.length}/${lines.length} handling rows moved: ${[...new Set(moved.map((m) => m.car))].join(", ")}` : `handling golden: ${lines.length} rows match`);
  return moved;
}

async function main(command: string, arg?: string, other?: string): Promise<number> {
  if (command === "matrix") return run_matrix(arg);
  if (command === "diff") {
    if (!arg || !other) throw new Error("usage: bun scripts/lab.ts diff <old paste> <new paste>");
    for (const line of diff_files(arg, other)) console.log(line);
    return 0;
  }
  if (command === "golden") {
    const moved = await run_golden(process.argv.includes("--check"));
    return moved === null || moved.length ? 1 : 0;
  }
  return run_pack(command);
}

const [command, arg, other] = args;
if (!command) {
  console.error("usage: bun scripts/lab.ts <pack> [--base <trial>] | matrix [car] | golden [--check] | diff <old> <new>   [--jobs n]");
  process.exit(1);
}
process.exit(await main(command, arg, other));

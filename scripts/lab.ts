import { build_spec, parse_build } from "../src/car/build";
import { SteerMode } from "../src/car/car";
import { is_car } from "../src/car/cars";
import { CLASS_LABELS, class_of, spec_pi } from "../src/car/pi";
import { budget, drive_seconds, MAX_SECONDS, MAX_TRIALS, minutes, over_budget } from "../src/lab/budget";
import { goal_text, mods_text, short } from "../src/lab/export";
import { resolve_pack, spec_hash, type Resolved } from "../src/lab/pack";
import { PACKS } from "../src/lab/packs";
import { pool_size, run_pool } from "./proof/pool";
import { setups } from "./lab/setups";
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

const values_text = (values: SimValues) => values.map(([key, v]) => `${key}=${short(v)}${key === "stop" ? `@${STOP_FROM_KMH}` : ""}`).join(" ");

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
  return { kind: "trial", spec: r.spec, station: r.station.id, surface: r.lane.surface, mode: r.trial.aids?.steer_mode ?? SteerMode.SMOOTH };
}

async function run_pack(id: string): Promise<number> {
  const load = PACKS[id];
  if (!load) throw new Error(`unknown pack "${id}", expected matrix or one of ${Object.keys(PACKS).join(", ")}`);
  const pack = (await load()).default;
  const trials = resolve_pack(pack);
  const named = flag("--base");
  const fixed = named === undefined ? -1 : trials.findIndex((r) => r.trial.id === named);
  if (named !== undefined && fixed < 0) throw new Error(`no trial "${named}" in ${pack.id}`);
  // Until packs mark their own base (plan P5), a trial reads against the pack's first trial on the same station.
  const base_of = (i: number) => (fixed >= 0 ? fixed : trials.findIndex((r) => r.station.id === trials[i].station.id));

  const keys = trials.map((r) => JSON.stringify(trial_job(r)));
  const unique = [...new Set(keys)];
  const ran = await run_pool<LabJob, LabResult>(WORKER, unique.map((k) => JSON.parse(k) as LabJob), JOBS, (_, done) => progress(done, unique.length));
  const results = keys.map((k) => ran[unique.indexOf(k)]);
  const sims = results.map((r) => (r.kind === "trial" ? r.sim : null));

  console.log(`#sim ${pack.id} r${pack.rev} base ${named ?? "first trial per station"}`);
  trials.forEach((r, i) => {
    const { trial } = r;
    console.log(`#trial ${trial.id} ${trial.car}${mods_text(trial.mods)} spec#${r.hash} pi${r.pi}${CLASS_LABELS[r.class]} ${trial.station}/${r.lane.name} ${goal_text(trial.goal)} est ${minutes(drive_seconds(r))}`);
    const sim = sims[i];
    if (!sim) return;
    if (!sim.values.length) return console.log(" sim -");
    console.log(` sim ${values_text(sim.values)}${sim.ground === r.lane.surface ? "" : ` on ${sim.ground}`}`);
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

const COLUMNS = ["setup", "ground", "spec#", "PI", "0-100 s", "top km/h", "100-0 m", "skidpad g", "turn-in ms", "lift-off °", "power-on °", "flick °", "kick 220 s"];

async function run_matrix(car?: string): Promise<number> {
  if (car !== undefined && !is_car(car)) throw new Error(`unknown car "${car}"`);
  const rows = setups(car).flatMap((s) => {
    const build = parse_build(s.code);
    if (!build) throw new Error(`${s.id}: bad build code ${s.code}`);
    const spec = build_spec(build);
    return s.grounds.map((ground) => ({ setup: s, spec, ground }));
  });
  const jobs: LabJob[] = rows.map(({ spec, ground }) => ({ kind: "traits", spec, ground }));
  const results = await run_pool<LabJob, LabResult>(WORKER, jobs, JOBS, (_, done) => progress(done, jobs.length));

  console.log(`| ${COLUMNS.join(" | ")} |`);
  console.log(`|${COLUMNS.map(() => "---").join("|")}|`);
  const rated = new Map<string, string>();
  rows.forEach(({ setup, spec, ground }, i) => {
    const r = results[i];
    if (r.kind !== "traits") return;
    const pi = rated.get(setup.id) ?? `${spec_pi(spec)} ${CLASS_LABELS[class_of(spec_pi(spec))]}`;
    rated.set(setup.id, pi);
    const t = r.traits;
    const cells = [setup.id, ground, spec_hash(spec), pi, t.t100.toFixed(2), t.top.toFixed(0), t.stop.toFixed(1), t.g.toFixed(2), (t.turn * 1000).toFixed(0), t.lift.toFixed(1), t.pwr.toFixed(1), t.hb.toFixed(0), t.kick.toFixed(2)];
    console.log(`| ${cells.join(" | ")} |`);
  });
  const errors = failed(results, (i) => `${rows[i].setup.id} ${rows[i].ground}`);
  for (const e of errors) console.error(`sim failed: ${e}`);
  return errors.length ? 1 : 0;
}

const [command, arg] = args;
if (!command) {
  console.error("usage: bun scripts/lab.ts <pack> [--base <trial>] | matrix [car]   [--jobs n]");
  process.exit(1);
}
process.exit(command === "matrix" ? await run_matrix(arg) : await run_pack(command));

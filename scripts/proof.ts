import { seed_of } from "../src/rng";
import type { WorldKind } from "../src/worldgen/types";
import { diff_digest, read_golden, type Golden } from "./proof/golden-file";
import { pool_size, run_pool } from "./proof/pool";
import type { ProofJob, ProofResult } from "./proof/worker";

// One pass per seed: generate and mesh once, then the golden digest, the world rules (worldcheck.ts), the spur drives
// (spurs.ts) and a circuit lap (seeds.ts) on the island, a lap (sky-seeds.ts) on the sky track, across all cores.
// --seeds N island seeds plus the lobby's, --sky N sky seeds, --desert N desert seeds (checked and driven like the island), --no-drive skips the drives, --all lists every failure.
const arg = (name: string, fallback: number) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? Number(process.argv[at + 1]) : fallback;
};
const ISLAND = [...Array(arg("--seeds", 20)).keys(), seed_of("lobby")];
const SKY = [...Array(arg("--sky", 20)).keys()];
const DESERT = [...Array(arg("--desert", 10)).keys()];
const DRIVES = !process.argv.includes("--no-drive");
const ALL = process.argv.includes("--all");

const jobs: ProofJob[] = [
  ...ISLAND.map((seed) => ({ kind: "island" as const, seed, checks: true, drives: DRIVES })),
  ...SKY.map((seed) => ({ kind: "sky" as const, seed, checks: true, drives: DRIVES })),
  ...DESERT.map((seed) => ({ kind: "desert" as const, seed, checks: true, drives: DRIVES })),
];
const golden: Record<WorldKind, Golden> = { island: read_golden("island"), sky: read_golden("sky"), desert: read_golden("desert") };
const size = pool_size(process.argv);
const t0 = performance.now();
const results = await run_pool<ProofJob, ProofResult>(new URL("./proof/worker.ts", import.meta.url), jobs, size, (r, done) =>
  process.stderr.write(`\r${done}/${jobs.length} ${r.kind} ${r.seed}      `),
);
process.stderr.write("\n");
const wall = (performance.now() - t0) / 1000;

const failing: Record<string, string[]> = { "world rules": [], spurs: [], lap: [], golden: [] };
const kinds = new Map<string, { count: number; example: string }>();
const lines: string[] = [];
const pad = (text: string | number, n: number) => String(text).padEnd(n);
console.log(`${pad("world", 18)}${pad("gen ms", 8)}${pad("mesh ms", 9)}${pad("rules", 9)}${pad("spurs", 8)}${pad("lap", 6)}golden`);
for (const r of results) {
  const name = `${r.kind} ${r.seed}`;
  const has_golden = golden[r.kind].has(r.seed);
  const diff = has_golden ? diff_digest(golden[r.kind].get(r.seed), r.digest) : [];
  const bad_spurs = r.spurs?.filter((s) => !s.clean) ?? [];
  if (r.world?.length) failing["world rules"].push(name);
  if (bad_spurs.length) failing.spurs.push(name);
  if (r.lap && !r.lap.clean) failing.lap.push(name);
  if (diff.length) failing.golden.push(name);
  for (const what of r.world ?? []) {
    const kind = what.replace(/[-\d.,]+/g, "#");
    const seen = kinds.get(kind) ?? { count: 0, example: `${name}: ${what}` };
    seen.count++;
    kinds.set(kind, seen);
    if (ALL) lines.push(`  ${name}: ${what}`);
  }
  for (const s of bad_spurs) lines.push(`  ${name} ${s.text}  FAIL`);
  if (r.lap && !r.lap.clean) lines.push(`  ${name} lap: ${r.lap.text}  FAIL`);
  if (diff.length) lines.push(`  ${name} golden: ${diff.join(", ")}`);
  const rules = r.world ? (r.world.length ? `${r.world.length} fail` : "ok") : "-";
  const spurs = r.spurs ? `${r.spurs.length - bad_spurs.length}/${r.spurs.length}` : "-";
  const lap = r.lap ? (r.lap.clean ? "ok" : "FAIL") : "-";
  console.log(`${pad(name, 18)}${pad(r.gen_ms.toFixed(0), 8)}${pad(r.mesh_ms.toFixed(0), 9)}${pad(rules, 9)}${pad(spurs, 8)}${pad(lap, 6)}${has_golden ? (diff.length ? `${diff.length} parts` : "same") : "-"}`);
}

for (const kind of ["island", "sky"] as const) {
  const of_kind = results.filter((r) => r.kind === kind);
  if (!of_kind.length) continue;
  const gen = of_kind.map((r) => r.gen_ms).sort((a, b) => a - b);
  const stages = new Map<string, number>();
  for (const r of of_kind) for (const [stage, ms] of r.stages) stages.set(stage, Math.max(stages.get(stage) ?? 0, ms));
  const slowest = of_kind.reduce((a, b) => (b.gen_ms > a.gen_ms ? b : a));
  console.log(
    `${kind} gen median ${gen[gen.length >> 1].toFixed(0)} ms, slowest ${slowest.gen_ms.toFixed(0)} ms (seed ${slowest.seed}); stage max ms: ${[...stages].map(([s, ms]) => `${s} ${ms.toFixed(0)}`).join(", ")}`,
  );
}
for (const [kind, { count, example }] of kinds) console.log(`  ${count} x ${kind}  e.g. ${example}`);
for (const line of lines) console.log(line);
for (const [check, names] of Object.entries(failing)) console.log(`failing ${check}: ${names.length ? names.join(", ") : "none"}`);
console.log(`${results.length} worlds in ${wall.toFixed(1)} s on ${size} workers${size > 1 ? "; gen and mesh times are contended, time with --no-drive --jobs 1" : ""}`);
if (Object.values(failing).some((names) => names.length)) process.exitCode = 1;

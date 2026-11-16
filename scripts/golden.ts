import type { WorldKind } from "../src/worldgen/types";
import { diff_digest, GOLDEN_MAPS, GOLDEN_SEEDS, golden_name, read_golden, write_golden } from "./proof/golden-file";
import { pool_size, run_pool } from "./proof/pool";
import type { ProofJob, ProofResult } from "./proof/worker";

// `bun scripts/golden.ts` rewrites scripts/golden/*.txt from the current code; `--check` compares instead and fails on
// any difference, naming the parts of each seed that moved.
const CHECK = process.argv.includes("--check");
const KINDS = Object.keys(GOLDEN_SEEDS) as WorldKind[];

const t0 = performance.now();
const jobs: ProofJob[] = [
  ...KINDS.flatMap((kind) => GOLDEN_SEEDS[kind].map((seed) => ({ kind, seed, checks: false, drives: false }))),
  ...GOLDEN_MAPS.flatMap(({ kind, levels, seeds }) => seeds.map((seed) => ({ kind, seed, levels, checks: false, drives: false }))),
];
const results = await run_pool<ProofJob, ProofResult>(new URL("./proof/worker.ts", import.meta.url), jobs, pool_size(process.argv));
const secs = ((performance.now() - t0) / 1000).toFixed(1);
const name_of = (r: ProofResult) => golden_name(r.kind, r.opts);
const NAMES = [...new Set(results.map(name_of))];

if (!CHECK) {
  for (const name of NAMES) write_golden(name, results.filter((r) => name_of(r) === name).map((r) => [r.seed, r.digest]));
  console.log(`wrote scripts/golden/{${NAMES.join(",")}}.txt: ${results.length} worlds in ${secs} s`);
} else {
  const tally = new Map<string, number>();
  let moved = 0;
  for (const name of NAMES) {
    const golden = read_golden(name);
    for (const r of results.filter((r) => name_of(r) === name)) {
      const diff = diff_digest(golden.get(r.seed), r.digest);
      if (!diff.length) continue;
      moved++;
      for (const part of diff) tally.set(part, (tally.get(part) ?? 0) + 1);
      console.log(`${name} ${r.seed}: ${diff.join(", ")}`);
    }
  }
  if (!moved) console.log(`golden: ${results.length} worlds identical (${secs} s)`);
  else {
    console.log(`golden: ${moved}/${results.length} worlds differ (${secs} s); parts: ${[...tally].map(([part, n]) => `${part} x${n}`).join(", ")}`);
    console.log("intended? run `bun scripts/golden.ts` and commit scripts/golden with the change");
    process.exitCode = 1;
  }
}

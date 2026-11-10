import type { WorldKind } from "../src/worldgen/types";
import { diff_digest, GOLDEN_SEEDS, read_golden, write_golden } from "./proof/golden-file";
import { pool_size, run_pool } from "./proof/pool";
import type { ProofJob, ProofResult } from "./proof/worker";

// `bun scripts/golden.ts` rewrites scripts/golden/*.txt from the current code; `--check` compares instead and fails on
// any difference, naming the parts of each seed that moved.
const CHECK = process.argv.includes("--check");
const KINDS = Object.keys(GOLDEN_SEEDS) as WorldKind[];

const t0 = performance.now();
const jobs: ProofJob[] = KINDS.flatMap((kind) => GOLDEN_SEEDS[kind].map((seed) => ({ kind, seed, checks: false, drives: false })));
const results = await run_pool<ProofJob, ProofResult>(new URL("./proof/worker.ts", import.meta.url), jobs, pool_size(process.argv));
const secs = ((performance.now() - t0) / 1000).toFixed(1);

if (!CHECK) {
  for (const kind of KINDS) write_golden(kind, results.filter((r) => r.kind === kind).map((r) => [r.seed, r.digest]));
  console.log(`wrote scripts/golden/{${KINDS.join(",")}}.txt: ${results.length} worlds in ${secs} s`);
} else {
  const tally = new Map<string, number>();
  let moved = 0;
  for (const kind of KINDS) {
    const golden = read_golden(kind);
    for (const r of results.filter((r) => r.kind === kind)) {
      const diff = diff_digest(golden.get(r.seed), r.digest);
      if (!diff.length) continue;
      moved++;
      for (const part of diff) tally.set(part, (tally.get(part) ?? 0) + 1);
      console.log(`${kind} ${r.seed}: ${diff.join(", ")}`);
    }
  }
  if (!moved) console.log(`golden: ${results.length} worlds identical (${secs} s)`);
  else {
    console.log(`golden: ${moved}/${results.length} worlds differ (${secs} s); parts: ${[...tally].map(([part, n]) => `${part} x${n}`).join(", ")}`);
    console.log("intended? run `bun scripts/golden.ts` and commit scripts/golden with the change");
    process.exitCode = 1;
  }
}

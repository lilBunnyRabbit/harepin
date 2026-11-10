import { build_chunks } from "../src/worldgen/chunks";
import { seed_of } from "../src/rng";
import { spur_edges } from "../src/worldgen/graph";
import { generate } from "../src/worldgen/index";
import { check_world } from "./proof/world-checks";
import { MESH_TONES } from "./proof/tones";

const SEEDS = [...Array(Number(process.argv[2] ?? 100)).keys(), seed_of("lobby")];

interface Failure {
  seed: number;
  what: string;
}

const failures: Failure[] = [];
let slowest = 0;
let slowest_seed = 0;
let total = 0;
let towns = 0;
let linked = 0;
let lots = 0;
let buildings = 0;
const stages = new Map<string, number>();
const t0 = performance.now();
for (const seed of SEEDS) {
  const t = performance.now();
  const data = generate(seed);
  const ms = performance.now() - t;
  total += ms;
  if (ms > slowest) {
    slowest = ms;
    slowest_seed = seed;
  }
  for (const [stage, stage_ms] of data.timings) stages.set(stage, Math.max(stages.get(stage) ?? 0, stage_ms));
  towns += data.towns.length;
  linked += spur_edges(data.graph, data.circuit).length;
  lots += data.lots.length;
  buildings += data.buildings.length;
  check_world(data, build_chunks(data, MESH_TONES), (what) => failures.push({ seed, what }));
}
console.log(
  `${SEEDS.length} seeds in ${((performance.now() - t0) / 1000).toFixed(1)} s, gen mean ${(total / SEEDS.length).toFixed(0)} ms, slowest ${slowest.toFixed(0)} ms (seed ${slowest_seed}); stage max ms: ${[...stages].map(([s, ms]) => `${s} ${ms.toFixed(0)}`).join(", ")}`,
);
console.log(`towns ${towns}, with spur ${linked}, lots ${lots}, buildings ${buildings}`);
const kinds = new Map<string, number>();
for (const f of failures) {
  const kind = f.what.replace(/[-\d.,]+/g, "#");
  kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
}
for (const [kind, count] of kinds) console.log(`  ${count} x ${kind}  e.g. seed ${failures.find((f) => f.what.replace(/[-\d.,]+/g, "#") === kind)?.seed}: ${failures.find((f) => f.what.replace(/[-\d.,]+/g, "#") === kind)?.what}`);
if (failures.length) console.log(`failing seeds: ${[...new Set(failures.map((f) => f.seed))].join(", ")}`);
if (process.argv.includes("--all")) for (const f of failures) console.log(`  seed ${f.seed}: ${f.what}`);
if (failures.length) throw new Error(`${failures.length} world checks failed`);
console.log("all world checks pass");

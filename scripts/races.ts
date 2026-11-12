import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CARS } from "../src/car/cars";
import { World } from "../src/world/world";
import { generate_world } from "../src/worldgen/kinds/kinds";
import { WorldKind } from "../src/worldgen/types";
import { autolap } from "./autolap";
import { route_digest } from "./proof/digest";
import { GOLDEN_SEEDS, read_golden } from "./proof/golden-file";

// Drives every race route of each seed with every car: a route is sound when all of them finish it on the road, inside par.
// `--changed` drives only the routes of the golden seeds whose route digest differs from scripts/golden, plus CANARY.
// Fails only on runs missing from the baseline; `--baseline` drives every route of the golden seeds and rewrites it.
// `--world <kind>` drives that kind's routes instead of the island's; its runs are named with the kind in front, and
// `--baseline --world <kind>` rewrites only that kind's lines.
const CHANGED = process.argv.includes("--changed");
const BASELINE = process.argv.includes("--baseline");
const world_at = process.argv.indexOf("--world");
const WORLD = (world_at >= 0 ? process.argv[world_at + 1] : WorldKind.ISLAND) as WorldKind;
const [seeds_arg, KIND] = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--world");
if (BASELINE && (seeds_arg || KIND || CHANGED)) throw new Error("--baseline drives every golden seed of the world: no seeds, kind or --changed");
const own = (run: string) => (WORLD === WorldKind.ISLAND ? /^\d/.test(run) : run.startsWith(`${WORLD} `));
const SEEDS = seeds_arg ? seeds_arg.split(",").map(Number) : CHANGED || BASELINE ? GOLDEN_SEEDS[WORLD] : [0, 1, 2, 3, 4];
/** Always driven under `--changed`, so a change to the cars or the autopilot still shows on routes the golden keeps. */
const CANARY = new Set(["0 circuit", "1 street-1", "3 offroad-1"]);
const golden = CHANGED ? read_golden(WORLD) : null;
const BASELINE_FILE = new URL("golden/races-baseline.txt", import.meta.url);
const baseline = new Set(existsSync(BASELINE_FILE) ? readFileSync(BASELINE_FILE, "utf8").split(/\r?\n/).filter(Boolean) : []);

const failures: string[] = [];
const fixed: string[] = [];
let failed = 0;
let driven = 0;
let skipped = 0;
// circuit-rev is offered only where every car's autopilot finishes it: a seed listed here needs reverse_circuit to drop it.
const reversed = new Set<number>();
for (const seed of SEEDS) {
  const world = WORLD === WorldKind.ISLAND ? new World(seed) : new World(seed, generate_world(seed, WORLD));
  for (const route of world.routes) {
    if (KIND && route.kind !== KIND && route.id !== KIND) continue;
    const canary = WORLD === WorldKind.ISLAND && CANARY.has(`${seed} ${route.id}`);
    if (golden && !canary && golden.get(seed)?.get(`route:${route.id}`) === route_digest(route)) {
      skipped++;
      continue;
    }
    driven++;
    const line = route.closed ? [...route.points, route.points[0]] : route.points;
    const unplace = world.place(route.closure);
    const rows = Object.values(CARS).filter((spec) => !route.excludes?.includes(spec.id)).map((spec) => {
      const lap = autolap(world, spec, line, false);
      const done = lap.index >= line.length - 10 && !lap.flipped;
      const over = lap.t * 1000 > route.par_ms;
      const run = `${WORLD === WorldKind.ISLAND ? "" : `${WORLD} `}${seed} ${route.id} ${spec.id}`;
      if (!done || lap.offroad > 0 || over) {
        failed++;
        failures.push(run);
        if (route.id === "circuit-rev") reversed.add(seed);
      } else if (baseline.has(run)) fixed.push(run);
      return `${spec.id} ${lap.t.toFixed(0)}s${done ? "" : ` STOPPED ${lap.index}/${line.length}`}${over ? " OVER PAR" : ""}${lap.offroad > 0 ? ` off ${lap.offroad.toFixed(1)}s` : ""}`;
    });
    unplace();
    console.log(`seed ${seed} ${route.id}${golden ? (canary ? " (canary)" : " (changed)") : ""}: ${(route.length / 1000).toFixed(2)} km, par ${(route.par_ms / 1000).toFixed(1)} s | ${rows.join(", ")}`);
  }
}
if (golden) console.log(`${driven} routes driven, ${skipped} unchanged from golden skipped`);
if (reversed.size) console.log(`circuit-rev not drivable by every car on seed ${[...reversed].join(", ")}: drop it there`);
console.log(failed ? `${failed} runs failed` : "all runs clean");
if (BASELINE) {
  const other = [...baseline].filter((run) => !own(run));
  writeFileSync(BASELINE_FILE, [...failures, ...other].map((run) => run + "\n").join(""));
  console.log(`wrote ${failures.length} failing runs to scripts/golden/races-baseline.txt`);
} else {
  const fresh = failures.filter((run) => !baseline.has(run));
  if (fixed.length) console.log(`fixed since baseline (rerun with --baseline to drop them): ${fixed.join(", ")}`);
  console.log(fresh.length ? `NEW failures: ${fresh.join(", ")}` : `no new failures (${failed - fresh.length} known in the baseline)`);
  if (fresh.length) process.exitCode = 1;
}

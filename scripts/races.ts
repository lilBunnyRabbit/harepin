import { CARS } from "../src/car/cars";
import { World } from "../src/world/world";
import { autolap } from "./autolap";
import { route_digest } from "./proof/digest";
import { GOLDEN_SEEDS, read_golden } from "./proof/golden-file";

// Drives every race route of each seed with every car: a route is sound when all of them finish it on the road, inside par.
// `--changed` drives only the routes of the golden seeds whose route digest differs from scripts/golden, plus CANARY.
const CHANGED = process.argv.includes("--changed");
const [seeds_arg, KIND] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SEEDS = seeds_arg ? seeds_arg.split(",").map(Number) : CHANGED ? GOLDEN_SEEDS.island : [0, 1, 2, 3, 4];
/** Always driven under `--changed`, so a change to the cars or the autopilot still shows on routes the golden keeps. */
const CANARY = new Set(["0 circuit", "1 street-1", "3 offroad-1"]);
const golden = CHANGED ? read_golden("island") : null;

let failed = 0;
let driven = 0;
let skipped = 0;
// circuit-rev is offered only where every car's autopilot finishes it: a seed listed here needs reverse_circuit to drop it.
const reversed = new Set<number>();
for (const seed of SEEDS) {
  const world = new World(seed);
  for (const route of world.routes) {
    if (KIND && route.kind !== KIND && route.id !== KIND) continue;
    const canary = CANARY.has(`${seed} ${route.id}`);
    if (golden && !canary && golden.get(seed)?.get(`route:${route.id}`) === route_digest(route)) {
      skipped++;
      continue;
    }
    driven++;
    const line = route.closed ? [...route.points, route.points[0]] : route.points;
    const unplace = world.place(route.closure);
    const rows = Object.values(CARS).map((spec) => {
      const lap = autolap(world, spec, line, false);
      const done = lap.index >= line.length - 10 && !lap.flipped;
      const over = lap.t * 1000 > route.par_ms;
      if (!done || lap.offroad > 0 || over) {
        failed++;
        if (route.id === "circuit-rev") reversed.add(seed);
      }
      return `${spec.id} ${lap.t.toFixed(0)}s${done ? "" : ` STOPPED ${lap.index}/${line.length}`}${over ? " OVER PAR" : ""}${lap.offroad > 0 ? ` off ${lap.offroad.toFixed(1)}s` : ""}`;
    });
    unplace();
    console.log(`seed ${seed} ${route.id}${golden ? (canary ? " (canary)" : " (changed)") : ""}: ${(route.length / 1000).toFixed(2)} km, par ${(route.par_ms / 1000).toFixed(1)} s | ${rows.join(", ")}`);
  }
}
if (golden) console.log(`${driven} routes driven, ${skipped} unchanged from golden skipped`);
if (reversed.size) console.log(`circuit-rev not drivable by every car on seed ${[...reversed].join(", ")}: drop it there`);
console.log(failed ? `${failed} runs failed` : "all runs clean");
if (failed) process.exitCode = 1;

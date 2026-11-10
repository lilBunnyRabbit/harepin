import { CARS } from "../src/car/cars";
import { World } from "../src/world";
import { autolap } from "./autolap";

// Drives every race route of each seed with every car: a route is sound when all of them finish it on the road, inside par.
const SEEDS = (process.argv[2] ?? "0,1,2,3,4").split(",").map(Number);
const KIND = process.argv[3];

let failed = 0;
// circuit-rev is offered only where every car's autopilot finishes it: a seed listed here needs reverse_circuit to drop it.
const reversed = new Set<number>();
for (const seed of SEEDS) {
  const world = new World(seed);
  for (const route of world.routes) {
    if (KIND && route.kind !== KIND && route.id !== KIND) continue;
    const line = route.closed ? [...route.points, route.points[0]] : route.points;
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
    console.log(`seed ${seed} ${route.id}: ${(route.length / 1000).toFixed(2)} km, par ${(route.par_ms / 1000).toFixed(1)} s | ${rows.join(", ")}`);
  }
}
if (reversed.size) console.log(`circuit-rev not drivable by every car on seed ${[...reversed].join(", ")}: drop it there`);
console.log(failed ? `${failed} runs failed` : "all runs clean");
if (failed) process.exitCode = 1;

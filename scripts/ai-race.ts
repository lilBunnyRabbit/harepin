import { Car, drop_height } from "../src/car/car";
import { COUPE, car_spec, type CarSpec } from "../src/car/cars";
import { Driver } from "../src/ai/driver";
import { race_line } from "../src/ai/line";
import { World } from "../src/world/world";
import { RouteKind, type Route } from "../src/worldgen/types";
import { autolap, DT } from "./autolap";
import { GOLDEN_SEEDS } from "./proof/golden-file";

// bun scripts/ai-race.ts solo [seeds] [car]: one AI car alone on each circuit of the island's golden seeds, its standing
// lap against the autopilot's on the same route. Fails when an AI lap is more than SOLO_SLACK slower, or leaves the road.
const SOLO_SLACK = 0.05;
/** Metres off the centreline that count as off the road, as the autopilot counts them. */
const OFF_ROAD = 7;

interface Solo {
  t: number;
  done: boolean;
  offroad: number;
  worst: number;
}

export function circuits(world: World): Route[] {
  return world.routes.filter((r) => r.kind === RouteKind.CIRCUIT);
}

function solo(world: World, route: Route, spec: CarSpec, limit = 400): Solo {
  const line = race_line(route.points, world.ramps, spec.radius);
  const driver = new Driver(line);
  const car = new Car(spec);
  const p = route.points[0];
  car.place(p.x, world.height(p.x, p.z) + drop_height(spec, 0.75), p.z, Math.atan2(p.tx, p.tz));
  const n = route.points.length;
  let t = 0, offroad = 0, worst = 0;
  while (t < limit && driver.progress < n - 10) {
    car.step(DT, driver.drive(car), world);
    world.collide(car);
    t += DT;
    const d = world.distance_to_road(car.pos.x, car.pos.z);
    worst = Math.max(worst, d);
    if (d > OFF_ROAD) offroad += DT;
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
  }
  return { t, done: driver.progress >= n - 10, offroad, worst };
}

function run_solo(seeds: readonly number[], spec: CarSpec) {
  let failed = 0;
  const ratios: number[] = [];
  for (const seed of seeds) {
    const world = new World(seed);
    for (const route of circuits(world)) {
      if (route.excludes?.includes(spec.id)) continue;
      const unplace = world.place(route.closure);
      const auto = autolap(world, spec, [...route.points, route.points[0]], false);
      const ai = solo(world, route, spec);
      unplace();
      const ratio = ai.t / auto.t;
      ratios.push(ratio);
      const bad = !ai.done || ai.offroad > 0 || ratio > 1 + SOLO_SLACK;
      if (bad) failed++;
      console.log(`seed ${seed} ${route.id.padEnd(11)} auto ${auto.t.toFixed(1)}s ai ${ai.t.toFixed(1)}s ${((ratio - 1) * 100).toFixed(1).padStart(5)}%${ai.done ? "" : " STOPPED"}${ai.offroad > 0 ? ` off ${ai.offroad.toFixed(1)}s` : ""} worst ${ai.worst.toFixed(1)} m${bad ? " FAIL" : ""}`);
    }
  }
  ratios.sort((a, b) => a - b);
  const pct = (r: number) => `${((r - 1) * 100).toFixed(1)}%`;
  console.log(`${ratios.length} laps: ai vs auto min ${pct(ratios[0])}, median ${pct(ratios[ratios.length >> 1])}, max ${pct(ratios[ratios.length - 1])}; ${failed ? `${failed} FAILED` : "all within"} (slack ${SOLO_SLACK * 100}%)`);
  if (failed) process.exitCode = 1;
}

if (import.meta.main) {
  const [mode = "solo", seeds_arg, car] = process.argv.slice(2);
  const seeds = seeds_arg ? seeds_arg.split(",").map(Number) : GOLDEN_SEEDS.island;
  const spec = car ? car_spec(car) : COUPE;
  if (mode === "solo") run_solo(seeds, spec);
  else throw new Error(`unknown mode ${mode}`);
}

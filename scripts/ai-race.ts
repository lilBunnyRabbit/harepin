import { Car, drop_height } from "../src/car/car";
import { COUPE, car_spec, type CarSpec } from "../src/car/cars";
import { Driver, OFF_ROAD } from "../src/ai/driver";
import { at_difficulty, Difficulty } from "../src/ai/difficulty";
import { Field, personalities } from "../src/ai/field";
import { race_line } from "../src/ai/line";
import { plan_scale } from "../src/ai/capability";
import { World } from "../src/world/world";
import { generate_world } from "../src/worldgen/kinds/kinds";
import { is_kind, RouteKind, WorldKind, type Route } from "../src/worldgen/types";
import { autolap, DT } from "./autolap";
import { GOLDEN_SEEDS } from "./proof/golden-file";

// `--world <kind>` races that kind's circuits on its golden seeds instead of the island's.
// bun scripts/ai-race.ts solo [seeds] [car]: one AI car alone on each circuit of the island's golden seeds, its standing
// lap against the autopilot's on the same route. Fails when an AI lap is more than SOLO_SLACK slower, or leaves the road.
export const SOLO_SLACK = 0.05;
// bun scripts/ai-race.ts field [seeds|all] [car] [count] [laps] [aggression] [mistakes] [difficulty]: a field of AI cars on each circuit. Fails
// when a car is stuck, a race's contacts per lap fall outside CONTACT_BAND, or the finish order follows the grid. Aggression
// and mistakes are the owner's 1-5 levels, 3 by default; difficulty is the player's setting, normal by default.
export const CONTACT_BAND = [0, 10] as const;
/** Share of races that may finish in grid order, and the highest mean grid-to-finish rank correlation allowed. */
const GRID_KEPT_MAX = 0.2;
const RHO_MAX = 0.7;

interface Solo {
  t: number;
  done: boolean;
  offroad: number;
  worst: number;
}

// A sky-generator kind has no ground to stream: its world is whole from its data.
function world_of(seed: number, kind: WorldKind): World {
  return kind === WorldKind.ISLAND ? new World(seed) : new World(seed, generate_world(seed, kind));
}

export function circuits(world: World): Route[] {
  return world.routes.filter((r) => r.kind === RouteKind.CIRCUIT);
}

export function solo(world: World, route: Route, spec: CarSpec, limit = 400, assists = true): Solo {
  const line = race_line(route.points, world.ramps, spec.radius, world, plan_scale(spec));
  const driver = new Driver(line);
  const car = new Car(spec);
  car.assist = car.stability = assists;
  const p = route.points[0];
  car.place(p.x, world.height(p.x, p.z) + drop_height(spec, 0.75), p.z, Math.atan2(p.tx, p.tz));
  const n = route.points.length;
  let t = 0, offroad = 0, worst = 0;
  while (t < limit && driver.progress < n - 10) {
    car.step(DT, driver.drive(car, DT), world);
    world.collide(car);
    t += DT;
    const d = world.distance_to_road(car.pos.x, car.pos.z);
    worst = Math.max(worst, d);
    if (d > OFF_ROAD) offroad += DT;
    if (!Number.isFinite(car.pos.x)) throw new Error("NaN");
  }
  return { t, done: driver.progress >= n - 10, offroad, worst };
}

function run_solo(seeds: readonly number[], spec: CarSpec, kind: WorldKind = WorldKind.ISLAND) {
  let failed = 0;
  const ratios: number[] = [];
  for (const seed of seeds) {
    const world = world_of(seed, kind);
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

/** Seconds a field race may take per lap of the line's plan before a car still out counts as stuck. */
export const FIELD_SLACK = 1.6;

export function spearman(order: readonly number[]): number {
  const n = order.length;
  let d2 = 0;
  order.forEach((slot, place) => (d2 += (slot - place) ** 2));
  return 1 - (6 * d2) / (n * (n * n - 1));
}

function run_field(seeds: readonly number[], spec: CarSpec, count: number, laps: number, aggression: number, mistakes: number, difficulty: Difficulty, kind: WorldKind = WorldKind.ISLAND) {
  let stuck = 0, out_of_band = 0, grid_kept = 0, races = 0;
  const per_lap: number[] = [];
  const rhos: number[] = [];
  const finishes: number[] = [];
  let resets = 0, reverses = 0, spins = 0, overtakes = 0, hardest = 0;
  for (const seed of seeds) {
    const world = world_of(seed, kind);
    for (const route of circuits(world)) {
      if (route.excludes?.includes(spec.id)) continue;
      const unplace = world.place(route.closure);
      const field = new Field(world, route, Array.from({ length: count }, () => spec), at_difficulty(personalities(seed, count, aggression, mistakes), difficulty), seed);
      let plan = 0;
      for (let i = 0; i < field.line.step.length; i++) plan += field.line.step[i] / field.line.speed[i];
      const all = field.run(DT, laps, plan * laps * FIELD_SLACK + 30);
      unplace();
      races++;
      const order = field.racers.map((_, k) => k).sort((a, b) => field.racers[a].stats.finish - field.racers[b].stats.finish || field.racers[b].driver.progress - field.racers[a].driver.progress);
      const contacts = field.racers.reduce((sum, r) => sum + r.stats.contacts, 0) / 2;
      const rate = contacts / laps;
      per_lap.push(rate);
      const band = rate >= CONTACT_BAND[0] && rate <= CONTACT_BAND[1];
      if (!band) out_of_band++;
      if (!all) stuck++;
      const rho = spearman(order);
      rhos.push(rho);
      if (order.every((slot, place) => slot === place)) grid_kept++;
      const best = Math.min(...field.racers.map((r) => r.stats.finish));
      for (const r of field.racers) if (Number.isFinite(r.stats.finish)) finishes.push(r.stats.finish / laps);
      console.log(`seed ${seed} ${route.id}: ${all ? "all finished" : "STUCK"}, ${contacts} contacts (${rate.toFixed(1)}/lap${band ? "" : " OUT OF BAND"}), grid-finish rho ${rho.toFixed(2)}`);
      order.forEach((k, place) => {
        const { stats, personality } = { stats: field.racers[k].stats, personality: field.racers[k].driver.personality };
        const lap_times = stats.laps.map((t, i) => t - (i ? stats.laps[i - 1] : 0));
        resets += stats.resets;
        reverses += stats.reverses;
        spins += stats.spins;
        overtakes += stats.overtakes;
        hardest = Math.max(hardest, stats.hardest);
        console.log(`  P${place + 1} grid ${k + 1} pace ${personality.pace.toFixed(3)} agg ${personality.aggression.toFixed(2)} | ${Number.isFinite(stats.finish) ? `${stats.finish.toFixed(1)}s +${(stats.finish - best).toFixed(1)}` : `out at lap ${stats.laps.length}`} laps ${lap_times.map((t) => t.toFixed(1)).join("/")} | pass ${stats.overtakes} hit ${stats.contacts} (max ${stats.hardest.toFixed(1)} m/s) spin ${stats.spins} rev ${stats.reverses} reset ${stats.resets} off ${stats.offroad.toFixed(1)}s`);
      });
    }
  }
  per_lap.sort((a, b) => a - b);
  const mean_rho = rhos.reduce((a, b) => a + b, 0) / rhos.length;
  const lap = finishes.reduce((a, b) => a + b, 0) / finishes.length;
  console.log(`${races} races of ${count} x ${spec.id}, ${laps} laps, ${difficulty}: mean lap ${lap.toFixed(1)}s, stuck ${stuck}, contacts/lap min ${per_lap[0].toFixed(1)} median ${per_lap[per_lap.length >> 1].toFixed(1)} max ${per_lap[per_lap.length - 1].toFixed(1)} (band ${CONTACT_BAND.join("-")}, ${out_of_band} out), grid order kept ${grid_kept}, mean rho ${mean_rho.toFixed(2)}, overtakes ${overtakes}, spins ${spins}, reverses ${reverses}, resets ${resets}, hardest ${hardest.toFixed(1)} m/s`);
  if (stuck || out_of_band || grid_kept > races * GRID_KEPT_MAX || mean_rho > RHO_MAX) process.exitCode = 1;
}

if (import.meta.main) {
  const world_at = process.argv.indexOf("--world");
  const kind = world_at >= 0 ? process.argv[world_at + 1] : WorldKind.ISLAND;
  if (!is_kind(kind)) throw new Error(`world ${kind}, expected one of ${Object.values(WorldKind).join(", ")}`);
  const [mode = "solo", seeds_arg, car, count = "6", laps = "2", aggression = "3", mistakes = "3", difficulty = Difficulty.NORMAL] = process.argv.slice(2).filter((a, i, all) => a !== "--world" && all[i - 1] !== "--world");
  const level = Object.values(Difficulty).find((d) => d === difficulty);
  if (!level) throw new Error(`difficulty ${difficulty}, expected one of ${Object.values(Difficulty).join(", ")}`);
  const seeds = seeds_arg && seeds_arg !== "all" ? seeds_arg.split(",").map(Number) : GOLDEN_SEEDS[kind];
  const spec = car ? car_spec(car) : COUPE;
  if (mode === "solo") run_solo(seeds, spec, kind);
  else if (mode === "field") run_field(seeds, spec, Number(count), Number(laps), Number(aggression), Number(mistakes), level, kind);
  else throw new Error(`unknown mode ${mode}`);
}

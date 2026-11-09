import { build_spec, parse_build } from "../src/build";
import { car_spec } from "../src/cars";
import { World } from "../src/world";
import { generate_sky } from "../src/worldgen/sky";
import { autolap } from "./autolap";

const SEEDS = 20;
/** Rail hits slower than this are scrapes; faster ones count as a crash. */
const IMPACT = 8;
const ARG = process.argv[2] ?? "coupe";
const BUILD = parse_build(ARG);
const SPEC = BUILD ? build_spec(BUILD) : car_spec(ARG);

let failed = 0;
for (let seed = 0; seed < SEEDS; seed++) {
  const world = new World(seed, generate_sky(seed));
  const lap = autolap(world, SPEC);
  const clean = !lap.fell && !lap.flipped && lap.impact <= IMPACT && lap.index >= world.road.length - 10;
  if (!clean) failed++;
  console.log(`seed ${seed}: ${(world.road.length * 2 / 1000).toFixed(2)} km, lap ${lap.t.toFixed(1)} s to ${lap.index}/${world.road.length}, slowest ${(lap.slowest * 3.6).toFixed(0)} km/h, hardest hit ${lap.impact.toFixed(1)} m/s${lap.fell ? ", fell" : ""}${lap.flipped ? ", flipped" : ""}${clean ? "" : "  FAIL"}`);
}
console.log(`${SEEDS - failed}/${SEEDS} sky seeds clean on ${ARG}`);
if (failed) throw new Error(`${failed} sky seeds failed the autolap`);

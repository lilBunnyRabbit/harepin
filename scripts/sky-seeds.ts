import { build_spec, parse_build } from "../src/car/build";
import { car_spec } from "../src/car/cars";
import { World } from "../src/world/world";
import { generate_sky } from "../src/worldgen/sky";
import { sky_lap } from "./proof/drives";

const SEEDS = 20;
const ARG = process.argv[2] ?? "coupe";
const BUILD = parse_build(ARG);
const SPEC = BUILD ? build_spec(BUILD) : car_spec(ARG);

let failed = 0;
const toes: number[] = [];
for (let seed = 0; seed < SEEDS; seed++) {
  const lap = sky_lap(new World(seed, generate_sky(seed)), SPEC);
  if (!lap.clean) failed++;
  toes.push(...lap.toes);
  console.log(`seed ${seed}: ${lap.text}${lap.clean ? "" : "  FAIL"}`);
}
console.log(`${SEEDS - failed}/${SEEDS} sky seeds clean on ${ARG}; ${toes.length} gap toes at ${Math.min(...toes).toFixed(1)}-${Math.max(...toes).toFixed(1)} m/s`);
if (failed) throw new Error(`${failed} sky seeds failed the autolap`);

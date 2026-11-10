import { World } from "../src/world/world";
import { car_spec } from "../src/car/cars";
import { build_spec, parse_build } from "../src/car/build";
import { circuit_lap } from "./proof/drives";

const SEEDS = 20;
const ARG = process.argv[2] ?? "coupe";
const BUILD = parse_build(ARG);
const SPEC = BUILD ? build_spec(BUILD) : car_spec(ARG);

let failed = 0;
for (let seed = 0; seed < SEEDS; seed++) {
  const lap = circuit_lap(new World(seed), SPEC);
  if (!lap.clean) failed++;
  console.log(`seed ${seed}: ${lap.text}${lap.clean ? "" : "  FAIL"}`);
}
console.log(`${SEEDS - failed}/${SEEDS} seeds clean`);
if (failed) throw new Error(`${failed} seeds failed the autolap`);

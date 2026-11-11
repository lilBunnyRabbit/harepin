import { build_spec, parse_build } from "../src/car/build";
import { car_spec } from "../src/car/cars";
import { World } from "../src/world/world";
import { generate_world } from "../src/worldgen/kinds/kinds";
import { parse_kind, WorldKind } from "../src/worldgen/types";
import { sky_lap } from "./proof/drives";

const SEEDS = 20;
// `bun scripts/sky-seeds.ts [car] [--kind rooftops]`: any deck kind, the sky track by default.
const ARGS = process.argv.slice(2);
const AT = ARGS.indexOf("--kind");
const KIND = AT < 0 ? WorldKind.SKY : parse_kind(ARGS[AT + 1]);
const ARG = ARGS.filter((_, i) => AT < 0 || (i !== AT && i !== AT + 1))[0] ?? "coupe";
const BUILD = parse_build(ARG);
const SPEC = BUILD ? build_spec(BUILD) : car_spec(ARG);

let failed = 0;
const toes: number[] = [];
for (let seed = 0; seed < SEEDS; seed++) {
  const lap = sky_lap(new World(seed, generate_world(seed, KIND)), SPEC);
  if (!lap.clean) failed++;
  toes.push(...lap.toes);
  console.log(`seed ${seed}: ${lap.text}${lap.clean ? "" : "  FAIL"}`);
}
console.log(`${SEEDS - failed}/${SEEDS} ${KIND} seeds clean on ${ARG}; ${toes.length} gap toes at ${Math.min(...toes).toFixed(1)}-${Math.max(...toes).toFixed(1)} m/s`);
if (failed) throw new Error(`${failed} ${KIND} seeds failed the autolap`);

import { World, min_radius } from "../src/world";
import { car_spec } from "../src/car/cars";
import { build_spec, parse_build } from "../src/car/build";
import { autolap } from "./autolap";

const SEEDS = 20;
const ARG = process.argv[2] ?? "coupe";
const BUILD = parse_build(ARG);
const SPEC = BUILD ? build_spec(BUILD) : car_spec(ARG);

let failed = 0;
for (let seed = 0; seed < SEEDS; seed++) {
  const world = new World(seed);
  const radius = min_radius(world.road.map((p) => [p.x, p.z]));
  const lap = autolap(world, SPEC);
  const clean = lap.offroad === 0 && lap.index >= world.road.length - 10;
  if (!clean) failed++;
  console.log(`seed ${seed}: min radius ${radius.toFixed(0)} m, lap ${lap.t.toFixed(1)} s to ${lap.index}/${world.road.length}, offroad ${lap.offroad.toFixed(1)} s, worst ${lap.worst.toFixed(1)} m${clean ? "" : "  FAIL"}`);
}
console.log(`${SEEDS - failed}/${SEEDS} seeds clean`);
if (failed) throw new Error(`${failed} seeds failed the autolap`);

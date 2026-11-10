import { car_spec } from "../src/car/cars";
import { seed_of } from "../src/rng";
import { World } from "../src/world/world";
import { drive_spurs } from "./proof/drives";

const SEEDS = [...Array(Number(process.argv[2] ?? 20)).keys(), seed_of("lobby")];
const SPEC = car_spec(process.argv[3] ?? "coupe");

let failed = 0;
let spurs = 0;
for (const seed of SEEDS) {
  for (const run of drive_spurs(new World(seed), SPEC)) {
    spurs++;
    if (run.clean) continue;
    failed++;
    console.log(`seed ${seed} ${run.text}  FAIL`);
  }
}
console.log(`${spurs - failed}/${spurs} spurs driven clean`);
if (failed) throw new Error(`${failed} spurs failed the drive`);

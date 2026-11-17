import { tune } from "../src/worldgen/kinds/options";
import { RACEWAY_KNOBS } from "../src/worldgen/kinds/raceway";
import { RACEWAY } from "../src/worldgen/raceway";
import { ATTEMPTS, LAP, raceway_lap } from "../src/worldgen/raceway-plan";
import { levels_of } from "./proof/golden-file";

// `bun scripts/raceway-seeds.ts 200 E0C0` draws that map of each seed and counts the seeds that fall back to their plain lap.
const SEEDS = Number(process.argv[2] ?? 20);
const OPTS = process.argv[3] ?? "";
const recipe = tune(RACEWAY, RACEWAY_KNOBS, levels_of("raceway", OPTS)).lap;
let fallbacks = 0;
let worst = 0;
const t0 = performance.now();
for (let seed = 0; seed < SEEDS; seed++) {
  const lap = raceway_lap(seed, recipe);
  if (lap.attempt === ATTEMPTS || lap.recipe !== recipe) fallbacks++;
  else worst = Math.max(worst, lap.attempt);
  console.log(`seed ${seed}: attempt ${lap.attempt}${lap.recipe === recipe ? "" : " of the plain lap"}, ${(lap.length / 1000).toFixed(2)} km, ${lap.corners.join(" ")}`);
}
console.log(`${SEEDS - fallbacks}/${SEEDS} seeds drew their own lap, the slowest on attempt ${worst}; ${((performance.now() - t0) / SEEDS).toFixed(1)} ms a seed`);
if (fallbacks && recipe === LAP) throw new Error(`${fallbacks} seeds fell back`);

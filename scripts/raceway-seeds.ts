import { ATTEMPTS, raceway_lap } from "../src/worldgen/raceway-plan";

const SEEDS = Number(process.argv[2] ?? 20);
let fallbacks = 0;
let worst = 0;
const t0 = performance.now();
for (let seed = 0; seed < SEEDS; seed++) {
  const lap = raceway_lap(seed);
  if (lap.attempt === ATTEMPTS) fallbacks++;
  else worst = Math.max(worst, lap.attempt);
  console.log(`seed ${seed}: attempt ${lap.attempt}, ${(lap.length / 1000).toFixed(2)} km, ${lap.corners.join(" ")}`);
}
console.log(`${SEEDS - fallbacks}/${SEEDS} seeds drew their own lap, the slowest on attempt ${worst}; ${((performance.now() - t0) / SEEDS).toFixed(1)} ms a seed`);
if (fallbacks) throw new Error(`${fallbacks} seeds fell back`);

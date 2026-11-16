import { COUPE } from "../../src/car/cars";
import { at_difficulty, Difficulty } from "../../src/ai/difficulty";
import { Field, personalities } from "../../src/ai/field";
import { World } from "../../src/world/world";
import { circuits, FIELD_SLACK } from "../ai-race";
import { DT } from "../autolap";
import { apply, type Values } from "../ai-tune/params";
import { read_json } from "./cache";

// bun scripts/ai-ml/trouble.ts <seed> [values.json|result.json] [cars] [laps]: races a level 3 field on the seed's
// circuits at those values and prints every spin and reset as it happens (car, time, road point, speed, plan), to find
// where a spin/reset loop sits.

const [seed_arg, file, cars = "6", laps = "2"] = process.argv.slice(2);
const seed = Number(seed_arg);
if (file) apply(read_json<{ values: Values }>(file)?.values ?? {});
const world = new World(seed);
for (const route of circuits(world)) {
  const unplace = world.place(route.closure);
  const field = new Field(world, route, Array.from({ length: Number(cars) }, () => COUPE), at_difficulty(personalities(seed, Number(cars)), Difficulty.NORMAL), seed);
  let plan = 0;
  for (let i = 0; i < field.line.step.length; i++) plan += field.line.step[i] / field.line.speed[i];
  const limit = plan * Number(laps) * FIELD_SLACK + 30;
  const rs = field.racers;
  const seen = rs.map((r) => ({ spins: 0, resets: 0 }));
  let t = 0;
  while (t < limit && rs.some((r) => !Number.isFinite(r.stats.finish))) {
    field.step(DT, Number(laps));
    t += DT;
    rs.forEach((r, k) => {
      const what = r.stats.spins > seen[k].spins ? "spin" : r.stats.resets > seen[k].resets ? "reset" : "";
      if (!what) return;
      seen[k] = { spins: r.stats.spins, resets: r.stats.resets };
      const i = r.driver.index;
      console.log(`${route.id} t ${t.toFixed(1)} car ${k + 1} ${what} at road ${i} lap ${r.driver.laps} speed ${Math.hypot(r.car.vel.x, r.car.vel.z).toFixed(1)} plan ${field.line.speed[i].toFixed(1)} bend r ${(1 / Math.max(1e-9, Math.abs(field.line.bend[i]))).toFixed(0)} m`);
    });
  }
  unplace();
  console.log(`${route.id}: ${rs.map((r) => `${r.stats.spins}s/${r.stats.resets}r`).join(" ")}`);
}

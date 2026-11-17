import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { at_difficulty, Difficulty } from "../../src/ai/difficulty";
import { Field, field_personalities, grid_spot } from "../../src/ai/field";
import { field_builds } from "../../src/ai/field-pick";
import { build_spec } from "../../src/car/build";
import { Car } from "../../src/car/car";
import { export_block } from "../../src/lab/export";
import type { TrialResult } from "../../src/lab/lab";
import { race_path, race_resolved, resolve_pack, type RaceResolved } from "../../src/lab/pack";
import { PACKS } from "../../src/lab/packs";
import { PassTrace } from "../../src/lab/pass-trace";
import { Recorder } from "../../src/lab/recorder";
import { race_laps } from "../../src/modes/race-laps";
import { World } from "../../src/world/world";
import { is_plain } from "../../src/worldgen/kinds/kinds";
import { parse_map_code } from "../../src/worldgen/kinds/map-code";
import { WorldKind } from "../../src/worldgen/types";
import { DT } from "../autolap";
import { ROOT } from "./cache";

// bun scripts/ai-ml/pass-self.ts [pack] [out]: every race trial of a pack that keeps passes (`ai-pass`), driven headless
// with the field's own driver in the player's car, written as the export the lab's Download gives. Proves the pack's
// maps race and gives `passes.ts` a file before the owner drives.

/** s: a race the field's driver has not finished by then is stopped. */
const LIMIT = 600;

export function self_drive(r: RaceResolved): TrialResult {
  const { trial } = r;
  const read = parse_map_code(trial.map);
  if (!read.ok) throw new Error(`${trial.id}: map code ${trial.map} does not read (${read.why})`);
  if (read.map.kind !== WorldKind.ISLAND || !is_plain(read.map)) throw new Error(`${trial.id}: ${trial.map} is not a plain island`);
  const world = new World(read.map.seed);
  const route = world.routes.find((x) => x.id === r.lane.name && x.closed);
  if (!route) throw new Error(`${trial.id}: no closed route ${r.lane.name} on ${trial.map}`);
  world.place(route.closure);
  const count = trial.field.cars.length;
  const specs = field_builds(r.build, { class: r.class, pi: r.pi }, count, route.excludes).map(build_spec);
  const traits = at_difficulty(field_personalities(world.seed, trial.field.cars), trial.field.difficulty ?? Difficulty.NORMAL);
  const laps = race_laps(route.par_ms, null);
  const field = new Field(world, route, specs, traits, world.seed, count);
  const car = new Car(r.spec);
  const spot = grid_spot(route, count);
  car.park(spot.x, spot.z, spot.heading, world);
  field.rival = car;
  field.drives_rival = true;
  const recorder = new Recorder({ ...r.lane, path: race_path(route.points) }, trial.goal);
  recorder.placed(car);
  const passes = new PassTrace(field);
  const end = laps * route.points.length;
  while (field.t < LIMIT && !(field.progress[count] >= end)) {
    const controls = field.rival_controls(DT);
    car.step(DT, controls, world);
    world.collide(car);
    field.step(DT, laps);
    recorder.step(DT, car, controls);
    passes.step(car, controls);
    if (!Number.isFinite(car.pos.x)) throw new Error(`${trial.id}: NaN`);
  }
  return { status: field.progress[count] >= end ? "done" : "stopped", metrics: recorder.metrics(), field: null, trace: passes };
}

if (import.meta.main) {
  const [id = "ai-pass", out = `${ROOT}/pass-self/${id}.txt`] = process.argv.slice(2);
  const load = PACKS[id];
  if (!load) throw new Error(`no lab pack "${id}"`);
  const pack = (await load()).default;
  const trials = resolve_pack(pack);
  const results = trials.map((r): TrialResult => (race_resolved(r) && r.trial.passes ? self_drive(r) : { status: "new", metrics: null, field: null, trace: null }));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${export_block(pack, trials, results, {}, "self", { input: "keys", width: 0, height: 0 }, new Date())}\n`);
  results.forEach((result, i) => console.log(`${trials[i].trial.id}: ${result.status}${result.metrics ? ` ${result.metrics.time.toFixed(1)} s` : ""}${result.trace ? `, ${result.trace.lines()[0].trim()}` : ""}`));
  console.log(`export in ${out}`);
}

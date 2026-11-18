import { car_spec } from "../../src/car/cars";
import { STEADY } from "../../src/ai/driver";
import { Field, personalities } from "../../src/ai/field";
import type { RaceLine } from "../../src/ai/line";
import { AI_TUNING } from "../../src/ai/tuning";
import { World } from "../../src/world/world";
import { circuits, FIELD_SLACK } from "../ai-race";
import { DT } from "../autolap";
import { seed_list } from "./cache";

// bun scripts/ai-ml/brakes.ts <car> [seeds] [line_brake] [late_brake]: braking zones planned against driven, solo flying lap and field lap 1 vs 2.

const ZONE_DROP = 6;
const ZONE_DECEL = 1.5;
const FIELD = 6;
const LAPS = 2;

interface Zone {
  from: number;
  mid: number;
  to: number;
}

function zones(line: RaceLine): Zone[] {
  const { speed, step } = line;
  const n = speed.length;
  const decel = (i: number) => (speed[i] ** 2 - speed[(i + 1) % n] ** 2) / (2 * Math.max(1e-9, step[i]));
  const out: Zone[] = [];
  let start = 0;
  while (start < n && decel(start) > ZONE_DECEL) start++;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (decel(i) <= ZONE_DECEL) continue;
    let j = i;
    let len = 0;
    while (decel(j % n) > ZONE_DECEL && len < n) {
      j++;
      len++;
    }
    const to = j % n;
    if (speed[i] - speed[to] >= ZONE_DROP) {
      const half = (speed[i] + speed[to]) / 2;
      let mid = i;
      while (speed[mid % n] > half) mid++;
      out.push({ from: i, mid: mid % n, to });
    }
    k += len;
  }
  return out;
}

interface Lap {
  speed: Float64Array;
  pedal: Float64Array;
  capped: Uint8Array;
  time: number;
}

const blank = (n: number): Lap => ({ speed: new Float64Array(n).fill(NaN), pedal: new Float64Array(n).fill(NaN), capped: new Uint8Array(n), time: NaN });

interface Tally {
  entry: number[];
  mid: number[];
  end: number[];
  pedal: number[];
  capped: number[];
  driven: number[];
  planned: number[];
  lap: number[];
}

const tally = (): Tally => ({ entry: [], mid: [], end: [], pedal: [], capped: [], driven: [], planned: [], lap: [] });

function read(line: RaceLine, zs: readonly Zone[], lap: Lap, pace: number, into: Tally) {
  const n = line.road.length;
  const plan = line.speed;
  if (Number.isFinite(lap.time)) into.lap.push(lap.time);
  for (const z of zs) {
    const v = (i: number) => lap.speed[i] - plan[i] * pace;
    if ([z.from, z.mid, z.to].some((i) => Number.isNaN(lap.speed[i]))) continue;
    into.entry.push(v(z.from));
    into.mid.push(v(z.mid));
    into.end.push(v(z.to));
    let pedal = 0;
    let capped = 0;
    let count = 0;
    let dist = 0;
    for (let i = z.from; i !== z.to; i = (i + 1) % n) {
      if (!Number.isNaN(lap.pedal[i])) {
        pedal += lap.pedal[i];
        capped += lap.capped[i];
        count++;
      }
      dist += line.step[i];
    }
    if (count) {
      into.pedal.push(pedal / count);
      into.capped.push(capped / count);
    }
    into.driven.push((lap.speed[z.from] ** 2 - lap.speed[z.to] ** 2) / (2 * dist));
    into.planned.push(((plan[z.from] * pace) ** 2 - (plan[z.to] * pace) ** 2) / (2 * dist));
  }
}

function race(field: Field, laps: Lap[][], limit: number) {
  const done = () => field.racers.every((r) => r.stats.laps.length >= LAPS);
  while (field.t < limit && !done()) {
    field.step(DT, LAPS);
    for (let k = 0; k < field.racers.length; k++) {
      const { car, driver, stats } = field.racers[k];
      const lap = driver.laps;
      if (lap < 0 || lap >= LAPS || stats.laps.length > lap) continue;
      const rec = laps[k][lap];
      rec.speed[driver.index] = Math.hypot(car.vel.x, car.vel.z);
      rec.pedal[driver.index] = driver.controls.brake;
      rec.capped[driver.index] = driver.cap < Infinity ? 1 : 0;
    }
  }
  for (let k = 0; k < field.racers.length; k++) {
    const t = field.racers[k].stats.laps;
    for (let l = 0; l < t.length && l < LAPS; l++) laps[k][l].time = t[l] - (l ? t[l - 1] : 0);
  }
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "-");

function row(name: string, t: Tally): string {
  return `${name.padEnd(12)} ${String(t.entry.length).padStart(4)} ${f(mean(t.entry)).padStart(6)} ${f(mean(t.mid)).padStart(6)} ${f(mean(t.end)).padStart(6)} ${f(mean(t.pedal), 2).padStart(6)} ${f(mean(t.capped), 2).padStart(6)} ${f(mean(t.driven)).padStart(6)} ${f(mean(t.planned)).padStart(6)} ${f(mean(t.lap)).padStart(7)}`;
}

if (import.meta.main) {
  const [car = "coupe", seeds_arg = "0-5", line_brake, late_brake] = process.argv.slice(2);
  if (line_brake) AI_TUNING.line_brake = Number(line_brake);
  if (late_brake) AI_TUNING.late_brake = Number(late_brake);
  const spec = car_spec(car);
  const solo = tally();
  const lap1 = tally();
  const lap2 = tally();
  let solo_times = 0;
  const trouble = { solo: [0, 0, 0], field: [0, 0, 0] };
  const count = (into: number[], f: Field) => {
    for (const { stats } of f.racers) {
      into[0] += stats.spins;
      into[1] += stats.resets;
      into[2] += stats.offroad;
    }
  };
  for (const seed of seed_list(seeds_arg)) {
    const world = new World(seed);
    for (const route of circuits(world)) {
      if (route.excludes?.includes(spec.id)) continue;
      const unplace = world.place(route.closure);
      const alone = new Field(world, route, [spec], [STEADY], seed);
      const n = alone.line.road.length;
      let plan = 0;
      for (let i = 0; i < n; i++) plan += alone.line.step[i] / alone.racers[0].driver.line.speed[i];
      const limit = plan * LAPS * FIELD_SLACK + 30;
      const solo_laps = [[blank(n), blank(n)]];
      race(alone, solo_laps, limit);
      const line = alone.racers[0].driver.line;
      const zs = zones(line);
      read(line, zs, solo_laps[0][1], 1, solo);
      solo_times++;
      count(trouble.solo, alone);
      const field = new Field(world, route, Array.from({ length: FIELD }, () => spec), personalities(seed, FIELD), seed);
      const field_laps = field.racers.map(() => [blank(n), blank(n)]);
      race(field, field_laps, limit);
      count(trouble.field, field);
      field.racers.forEach((r, k) => {
        read(r.driver.line, zs, field_laps[k][0], r.driver.personality.pace, lap1);
        read(r.driver.line, zs, field_laps[k][1], r.driver.personality.pace, lap2);
      });
      unplace();
    }
  }
  console.log(`${car} line_brake ${AI_TUNING.line_brake} late_brake ${AI_TUNING.late_brake}, ${solo_times} circuits; m/s over plan x pace`);
  console.log(`${"run".padEnd(12)} ${"zones".padStart(4)} ${"entry".padStart(6)} ${"mid".padStart(6)} ${"end".padStart(6)} ${"pedal".padStart(6)} ${"capped".padStart(6)} ${"drove".padStart(6)} ${"plan".padStart(6)} ${"lap s".padStart(7)}`);
  console.log(row("solo flying", solo));
  console.log(row("field lap 1", lap1));
  console.log(row("field lap 2", lap2));
  const t = (x: number[]) => `spins ${x[0]} resets ${x[1]} off ${x[2].toFixed(1)} s`;
  console.log(`solo ${t(trouble.solo)}; field ${t(trouble.field)}`);
}

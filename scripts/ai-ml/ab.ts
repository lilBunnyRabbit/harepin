import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "./cache";
import { run_rows, type BarJob, type BarResult, type Rows, type Setup } from "./bar-rows";
import { mean, paired, type Interval } from "./pace";

// bar.ts --ab <checkout>: paired pace A/B, A run from that checkout's bar.ts (one with these job types), B from this one.

/** A seed's pace: its mean flying lap alone (`--solo`), else its mean race lap, over every car, eps and circuit; NaN when a run stopped. */
export function seed_pace(rows: Rows, setup: Setup, seed: number): number {
  const laps: number[] = [];
  for (const car of setup.cars)
    for (const eps of setup.epses)
      for (const r of rows[`${car}/${eps}/${seed}`]) {
        if (!("flying" in r)) laps.push(r.lap);
        else if (r.done) laps.push(mean(r.flying));
        else return NaN;
      }
  return mean(laps);
}

/** Paired A/B on pace: seeds in batches, A from the checkout at `other`, B from this one; stops once the 99% interval of B - A excludes 0, or at the last seed. */
export async function run_ab(other: string, seeds: readonly number[], setup: Setup, jobs: number, min: number) {
  const side = Math.max(1, jobs >> 1);
  const a = new Pool<BarJob, BarResult>(pathToFileURL(resolve(other, "scripts/ai-ml/bar.ts")), side);
  const b = new Pool<BarJob, BarResult>(new URL("./bar.ts", import.meta.url), side);
  a.start();
  b.start();
  const rows_a: Rows = {};
  const rows_b: Rows = {};
  const diffs: number[] = [];
  const looks: (Interval & { seeds: number })[] = [];
  let skipped = 0;
  let at = 0;
  while (at < seeds.length) {
    const from = at;
    at = Math.min(seeds.length, Math.max(at + side, min));
    const batch = seeds.slice(from, at);
    const [ra, rb] = await Promise.all([run_rows(a, batch, setup), run_rows(b, batch, setup)]);
    Object.assign(rows_a, ra);
    Object.assign(rows_b, rb);
    for (const seed of batch) {
      const d = seed_pace(rb, setup, seed) - seed_pace(ra, setup, seed);
      if (Number.isFinite(d)) diffs.push(d);
      else skipped++;
    }
    const look = { ...paired(diffs), seeds: at };
    looks.push(look);
    console.log(`A/B after ${at} seeds: B - A ${look.mean.toFixed(3)} s +- ${look.half.toFixed(3)} (99%, ${look.n} pairs${skipped ? `, ${skipped} with a stopped run left out` : ""})`);
    if (look.n >= min && Math.abs(look.mean) > look.half) break;
  }
  a.stop();
  b.stop();
  const last = looks[looks.length - 1];
  const verdict = last.n >= min && Math.abs(last.mean) > last.half ? (last.mean < 0 ? "B faster" : "B slower") : "no difference found";
  console.log(`A/B ${verdict}: B - A ${last.mean.toFixed(3)} s +- ${last.half.toFixed(3)} on ${last.n} paired seeds of ${seeds.length}`);
  return { a: rows_a, b: rows_b, seeds: seeds.slice(0, last.seeds), looks, verdict };
}

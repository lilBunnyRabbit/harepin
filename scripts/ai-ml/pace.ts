import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { car_spec } from "../../src/car/cars";
import { World } from "../../src/world/world";
import { circuits, solo } from "../ai-race";
import { read_json, ROOT, seed_list } from "./cache";
import type { OracleResult } from "./oracle";

// bun scripts/ai-ml/pace.ts <out.json> [cars] [seeds] [oracle dirs,]: the pace gate. One standing solo lap per car per
// island circuit, as `ai-race.ts solo` drives it, and its share of the best clean oracle lap found for that car and
// route in any .ai-ml/<hash>/oracle (plus the dirs given): 1 is the oracle's pace, under 1 slower.

export interface PaceRow {
  car: string;
  seed: number;
  route: string;
  t: number;
  clean: boolean;
  /** Best clean oracle lap (s) for this car and route, and the solo lap's share of its pace. */
  oracle?: number;
  share?: number;
}

export function oracle_laps(dirs: readonly string[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".result.json"))) {
      const r = read_json<OracleResult>(`${dir}/${f}`);
      if (r?.kind !== "oracle" || !r.oracle.clean || r.config.assists === false) continue;
      const key = `${r.config.car}/${r.config.seed}/${r.config.route}`;
      best.set(key, Math.min(best.get(key) ?? Infinity, r.oracle.t));
    }
  }
  return best;
}

export function cache_oracle_dirs(root = ROOT): string[] {
  return existsSync(root) ? readdirSync(root).map((d) => `${root}/${d}/oracle`).filter(existsSync) : [];
}

export function pace(cars: readonly string[], seeds: readonly number[], oracles: Map<string, number>): PaceRow[] {
  const rows: PaceRow[] = [];
  for (const seed of seeds) {
    const world = new World(seed);
    for (const route of circuits(world)) {
      const unplace = world.place(route.closure);
      for (const car of cars) {
        const spec = car_spec(car);
        if (route.excludes?.includes(spec.id)) continue;
        const lap = solo(world, route, spec);
        const oracle = oracles.get(`${car}/${seed}/${route.id}`);
        const clean = lap.done && lap.offroad === 0;
        rows.push({ car, seed, route: route.id, t: lap.t, clean, ...(oracle && clean ? { oracle, share: oracle / lap.t } : {}) });
      }
      unplace();
    }
  }
  return rows;
}

if (import.meta.main) {
  const [out, cars_arg = "hatch,coupe,formula", seeds_arg = "0-9", extra = ""] = process.argv.slice(2);
  const oracles = oracle_laps([...cache_oracle_dirs(), ...extra.split(",").filter(Boolean)]);
  const cars = cars_arg.split(",");
  const rows = pace(cars, seed_list(seeds_arg), oracles);
  writeFileSync(out, JSON.stringify(rows, null, 1));
  for (const car of cars) {
    const mine = rows.filter((r) => r.car === car);
    const shared = mine.filter((r) => r.share !== undefined);
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
    console.log(`${car}: ${mine.filter((r) => r.clean).length}/${mine.length} clean, total ${mine.reduce((s, r) => s + r.t, 0).toFixed(1)} s, oracle share ${shared.length ? mean(shared.map((r) => r.share!)).toFixed(4) : "-"} over ${shared.length}`);
    for (const r of mine) console.log(`  ${r.seed} ${r.route.padEnd(12)} ${r.t.toFixed(2).padStart(7)}${r.clean ? "" : " NOT CLEAN"}${r.share ? `  oracle ${r.oracle!.toFixed(2)} share ${r.share.toFixed(4)}` : ""}`);
  }
}

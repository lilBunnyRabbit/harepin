import { readdirSync, writeFileSync } from "node:fs";
import { COUPE, car_spec } from "../../src/car/cars";
import { World } from "../../src/world/world";
import { circuits } from "../ai-race";
import { AI_HASH, read_json, runs_dir, write_json } from "./cache";
import { corners } from "../../src/ai/corners";
import { corner_run, corner_window, gap_table } from "./corners";
import { ai_lap, oracle_lap, track_of } from "./drive";
import type { OracleConfig, OracleResult } from "./oracle";

// bun scripts/ai-ml/regap.ts <old cache dir>: carries an earlier cache's oracles over to today's code, so the gap
// reports and the level runs' ceiling need no new search. Each oracle's best controls drive again (the lap moves only
// when the line's path or the car changed), then today's AI lap; writes <name>.result.json and <name>.gap.md under
// .ai-ml/<hash>/oracle/ and prints the AI lap and gap before and after.

const SOLO_LIMIT = 400;
const old = process.argv[2];
if (!old) throw new Error("usage: regap.ts <old cache dir>");
const dir = runs_dir("oracle");
const rows: string[] = [];
for (const file of readdirSync(`${old}/oracle`).filter((f) => f.endsWith(".result.json")).sort()) {
  const before = read_json<OracleResult>(`${old}/oracle/${file}`);
  const state = read_json<{ config: OracleConfig; best: { x: number[] } | null }>(`${old}/oracle/${file.replace(".result.json", ".json")}`);
  if (!before || !state?.best) continue;
  const { config } = state;
  const world = new World(config.seed);
  const route = circuits(world).find((r) => r.id === config.route);
  if (!route) throw new Error(`seed ${config.seed} has no circuit ${config.route}`);
  world.place(route.closure);
  const tk = track_of(world, route, config.car === COUPE.id ? COUPE : car_spec(config.car), config.assists !== false);
  const oracle = oracle_lap(tk, state.best.x, config.knot, SOLO_LIMIT, true);
  const ai = ai_lap(tk, SOLO_LIMIT);
  const ot = oracle.trace;
  const at = ai.trace;
  if (!ot || !at) throw new Error("no trace");
  const cs = corners(tk.line);
  const result: OracleResult = {
    ...before,
    hash: AI_HASH,
    ai: { t: ai.t, clean: ai.clean },
    oracle: { t: oracle.t, clean: oracle.clean, why: oracle.why },
    ratio: oracle.t / before.auto,
    gain: 1 - oracle.t / ai.t,
    corners: cs.flatMap((c) => {
      const window = corner_window(tk.line, [ot, at], c);
      return window ? [{ ...c, oracle: corner_run(tk.line, ot, c, window), ai: corner_run(tk.line, at, c, window) }] : [];
    }),
  };
  write_json(`${dir}/${config.name}.result.json`, result);
  const head = `# Oracle ${config.name}: ${config.car} on seed ${config.seed} ${config.route}, carried over from ${old}\n\nAI ${before.ai.t.toFixed(2)} s there, ${ai.t.toFixed(2)} s now ${ai.clean ? "clean" : `NOT CLEAN (${ai.why})`}; oracle ${oracle.t.toFixed(2)} s ${oracle.clean ? "clean" : `NOT CLEAN (${oracle.why})`}: ${(result.gain * 100).toFixed(1)}% under the AI, ${(before.gain * 100).toFixed(1)}% before.\n\n`;
  writeFileSync(`${dir}/${config.name}.gap.md`, head + gap_table(tk.line, cs, at, ot) + "\n");
  rows.push(`| ${config.name} | ${before.ai.t.toFixed(2)} | ${ai.t.toFixed(2)}${ai.clean ? "" : ` (${ai.why})`} | ${oracle.t.toFixed(2)}${oracle.clean ? "" : ` (${oracle.why})`} | ${(before.gain * 100).toFixed(1)}% | ${(result.gain * 100).toFixed(1)}% |`);
}
console.log(["| oracle | AI before s | AI now s | oracle s | gap before | gap now |", "|---|---|---|---|---|---|", ...rows].join("\n"));
console.log(`results and gap reports in ${dir}`);

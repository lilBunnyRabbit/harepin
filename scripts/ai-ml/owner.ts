import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { OFF_ROAD } from "../../src/ai/driver";
import { build_spec, parse_build } from "../../src/car/build";
import { spec_hash } from "../../src/lab/pack";
import { World } from "../../src/world/world";
import { is_plain } from "../../src/worldgen/kinds/kinds";
import { parse_map_code } from "../../src/worldgen/kinds/map-code";
import { WorldKind } from "../../src/worldgen/types";
import { circuits } from "../ai-race";
import { autolaps } from "../ai-tune/race";
import { AI_HASH, DIR, write_json } from "./cache";
import { ai_lap, track_of } from "./drive";
import { lifts, lifts_table, owner_table } from "./owner-gap";
import { owner_laps, read_export, type TracedTrial } from "./owner-read";

// bun scripts/ai-ml/owner.ts <file>...: the owner's reference laps (`?lab=ai-ref-*`, src/lab/packs/ai-ref.ts) from
// the lab's Download files (`<pack>-<date>.txt`) as saved, or pasted Copy blocks. Per traced trial: every lap and whether it was clean, the fastest clean lap against
// today's AI solo lap corner by corner in the oracle gap format, and where the owner lifted outside the corners. Writes
// <pack>.gap.md and <pack>.result.json under .ai-ml/<hash>/owner/.

const SOLO_LIMIT = 400;
/** Route points short of the line where `drive.ts` ends the AI's lap: the owner's standing lap is timed there for the gain. */
const AI_LAP_SHORT = 10;

export interface OwnerResult {
  pack: string;
  trial: string;
  seed: number;
  route: string;
  car: string;
  hash: string;
  laps: { lap: number; t: number; clean: boolean; why: string }[];
  /** Fastest clean lap, flying or standing; `standing` is lap 1 when clean, null otherwise. */
  best: number;
  standing: number | null;
  ai: { t: number; clean: boolean };
  auto: number;
  /** The standing lap over the autopilot's and under the AI's, both standing laps too: like for like or null. */
  ratio: number | null;
  gain: number | null;
}

function world_of(trial: TracedTrial): { world: World; seed: number } {
  const read = parse_map_code(trial.map);
  if (!read.ok) throw new Error(`${trial.pack} ${trial.id}: map code ${trial.map} does not read (${read.why})`);
  const { kind, seed } = read.map;
  if (kind !== WorldKind.ISLAND || !is_plain(read.map)) throw new Error(`${trial.pack} ${trial.id}: ${trial.map} is not a plain island; the AI test tracks are`);
  return { world: new World(seed), seed };
}

function report(trial: TracedTrial): OwnerResult | null {
  const build = parse_build(trial.car);
  if (!build) throw new Error(`${trial.pack} ${trial.id}: ${trial.car} is not a build code`);
  const spec = build_spec(build);
  const { world, seed } = world_of(trial);
  const route = circuits(world).find((r) => r.id === trial.route);
  if (!route) throw new Error(`${trial.pack} ${trial.id}: seed ${seed} has no circuit ${trial.route}`);
  const unplace = world.place(route.closure);
  const laps = owner_laps(trial, route.points, (x, z) => world.distance_to_road(x, z) > OFF_ROAD);
  const clean = laps.filter((l) => l.clean);
  const head = `# Owner ${trial.pack} r${trial.rev} ${trial.id}: ${trial.car} on seed ${seed} ${trial.route}\n\n`;
  const lap_lines = laps.map((l) => `- lap ${l.lap + 1}${l.lap === 0 ? " (standing)" : ""}: ${l.t.toFixed(2)} s ${l.clean ? "clean" : `NOT CLEAN (${l.why})`}`);
  const warn = [
    ...(spec_hash(spec) === trial.hash ? [] : [`Driven on spec#${trial.hash}, today's ${trial.car} is spec#${spec_hash(spec)}: the car moved since.`]),
    ...(trial.full ? ["The trace ran out of room: the laps after it are missing."] : []),
    ...(trial.aids.assist === "off" || trial.aids.stability === "off" ? [`Driven with assist=${trial.aids.assist} stability=${trial.aids.stability}; the AI drives with both on.`] : []),
  ];
  const dir = `${DIR}/owner`;
  mkdirSync(dir, { recursive: true });
  const name = `${trial.pack}-${trial.id}`;
  if (!clean.length) {
    writeFileSync(`${dir}/${name}.gap.md`, `${head}${[...warn, ...lap_lines].join("\n")}\n\nNo clean lap: nothing to set against the AI.\n`);
    unplace();
    return null;
  }
  const best = clean.reduce((a, b) => (b.t < a.t ? b : a));
  const standing = laps[0]?.clean ? laps[0] : null;
  const tk = track_of(world, route, spec);
  const ai = ai_lap(tk, SOLO_LIMIT);
  if (!ai.trace) throw new Error("no AI trace");
  const auto = autolaps(seed)[trial.route];
  unplace();
  const result: OwnerResult = {
    pack: trial.pack,
    trial: trial.id,
    seed,
    route: trial.route,
    car: trial.car,
    hash: AI_HASH,
    laps: laps.map(({ lap, t, clean: c, why }) => ({ lap, t, clean: c, why })),
    best: best.t,
    standing: standing?.t ?? null,
    ai: { t: ai.t, clean: ai.clean },
    auto,
    ratio: standing ? standing.t / auto : null,
    gain: standing && ai.clean ? 1 - standing.trace.t[route.points.length - AI_LAP_SHORT] / ai.t : null,
  };
  const under = result.gain === null ? "" : ` is ${(result.gain * 100).toFixed(1)}% under it,`;
  const pace = standing && result.ratio !== null ? `your standing lap ${standing.t.toFixed(2)} s${under} ${result.ratio.toFixed(3)} of the autolap (${auto.toFixed(2)} s)` : "lap 1 was not clean, so no standing lap to set against it";
  const table_note = best.lap === 0 ? "" : " The corner table reads your flying lap against the AI's standing one: the corners near the start favour you.";
  const summary = `AI ${ai.t.toFixed(2)} s ${ai.clean ? "clean" : `NOT CLEAN (${ai.why})`} from a standing start; ${pace}. Your best clean lap ${best.t.toFixed(2)} s (lap ${best.lap + 1}).${table_note}`;
  const body = [...warn, ...lap_lines, "", summary, "", owner_table(tk.line, ai.trace, best), "", lifts_table(lifts(tk.line, ai.trace, best))].join("\n");
  writeFileSync(`${dir}/${name}.gap.md`, `${head}${body}\n`);
  write_json(`${dir}/${name}.result.json`, result);
  return result;
}

if (import.meta.main) {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("usage: owner.ts <downloaded or pasted export>...");
  const trials = files.flatMap((f) => read_export(readFileSync(f, "utf8")));
  if (!trials.length) throw new Error("no traced trial in the paste: drive a ?lab=ai-ref-* pack and Download");
  const rows = trials.map((trial) => {
    const r = report(trial);
    return r ? `| ${trial.pack} | ${trial.id} | ${r.laps.filter((l) => l.clean).length}/${r.laps.length} | ${r.best.toFixed(2)} | ${r.standing?.toFixed(2) ?? "-"} | ${r.ai.t.toFixed(2)} | ${r.gain === null ? "-" : `${(r.gain * 100).toFixed(1)}%`} | ${r.ratio?.toFixed(3) ?? "-"} |` : `| ${trial.pack} | ${trial.id} | 0 clean | - | - | - | - | - |`;
  });
  console.log(["| pack | trial | clean laps | best s | standing s | AI s | standing under AI | standing over autolap |", "|---|---|---|---|---|---|---|---|", ...rows].join("\n"));
  console.log(`gap reports in ${DIR}/owner`);
}

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { AI_HASH, DIR, read_json, SUMMARY } from "./cache";
import { ceiling, type ExperimentResult } from "./experiment";
import type { OracleResult } from "./oracle";

const pct = (v: number) => (Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%` : "-");
const f = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "-");

function results<T>(sub: string): T[] {
  const dir = `${DIR}/${sub}`;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".result.json"))
    .sort()
    .flatMap((name) => {
      const r = read_json<T>(`${dir}/${name}`);
      return r ? [r] : [];
    });
}

function tune_table(rows: readonly ExperimentResult[], level: boolean): string[] {
  const shipped = rows[0];
  const head = ["experiment", "params", "pop x gens", "held-out lap gain", ...(level ? ["pace vs target"] : []), "spins+resets held-out", "stuck", "solo clean", "solo gain", "passes/race", "contacts/lap", "lap sd s", "bar", "min"];
  const out = [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`];
  if (shipped) {
    const b = shipped.base_verdict;
    const s = shipped.check.base;
    out.push(`| shipped | - | - | 0.0% |${level ? " - |" : ""} ${b.trouble} | ${b.stuck} | ${b.solo_laps - b.solo_failed}/${b.solo_laps} | 0.0% | ${f(s.passes)} | ${f(s.contacts, 1)} | ${f(s.lap_sd)} | ${b.pass ? "pass" : "FAIL"} | - |`);
  }
  for (const r of rows) {
    const v = r.verdict;
    const s = r.check.best;
    const target = level ? ` ${f(s.pace, 3)} / ${f(r.target, 3)} |` : "";
    out.push(`| ${r.name} | ${Object.keys(r.values).length} | ${r.config.pop} x ${r.gens} | ${pct(v.gain)} |${target} ${v.trouble} | ${v.stuck} | ${v.solo_laps - v.solo_failed}/${v.solo_laps} | ${pct(v.solo_gain)} | ${f(s.passes)} | ${f(s.contacts, 1)} | ${f(s.lap_sd)} | ${v.pass ? "**pass**" : "FAIL"} | ${f(r.minutes, 0)} |`);
  }
  return out;
}

/** Param rows by experiment columns, only params some experiment moved more than 2% of the default. */
function values_table(rows: readonly ExperimentResult[]): string[] {
  const names = [...new Set(rows.flatMap((r) => Object.keys(r.values)))].filter((n) => rows.some((r) => n in r.values && Math.abs(r.values[n] - r.defaults[n]) > 0.02 * Math.max(1e-9, Math.abs(r.defaults[n]))));
  if (!names.length) return [];
  const out = [`| param | shipped | ${rows.map((r) => r.name).join(" | ")} |`, `|---|---|${rows.map(() => "---").join("|")}|`];
  for (const n of names) {
    const shipped = rows.find((r) => n in r.defaults)?.defaults[n] ?? NaN;
    out.push(`| ${n} | ${f(shipped, 3)} | ${rows.map((r) => (n in r.values ? f(r.values[n], 3) : "")).join(" | ")} |`);
  }
  return out;
}

/** Rebuilds the whole summary from every result in the cache: a resumed queue writes the same file a straight run would. */
export function write_summary(status: string[] = []) {
  const oracles = results<OracleResult>("oracle");
  const tunes = results<ExperimentResult>("runs");
  const md: string[] = [`# AI ML runs`, "", `Cache \`${DIR}\` (src/ai hash ${AI_HASH}), updated ${new Date().toISOString().slice(0, 16)}Z. Bar: 0 spins+resets and 0 stuck on held-out seeds, solo 25/25 clean.`, ""];
  if (status.length) md.push("## Queue", "", ...status.map((s) => `- ${s}`), "");
  md.push("## Oracle (ceiling)", "");
  if (oracles.length) {
    md.push(`Ceiling: oracle lap = ${f(ceiling(), 3)} x autolap (mean of clean oracle laps).`, "", "| oracle | car | track | autolap s | shipped AI s | oracle s | gain over AI | clean | gap report |", "|---|---|---|---|---|---|---|---|---|");
    for (const o of oracles) md.push(`| ${o.name} | ${o.config.car} | seed ${o.config.seed} ${o.config.route} | ${f(o.auto, 1)} | ${f(o.ai.t, 1)} | ${f(o.oracle.t, 1)} | ${pct(o.gain)} | ${o.oracle.clean ? "yes" : o.oracle.why} | \`${DIR}/oracle/${o.name}.gap.md\` |`);
  } else md.push("none finished yet");
  md.push("");
  for (const group of [...new Set(tunes.map((r) => r.config.group))]) {
    const rows = tunes.filter((r) => r.config.group === group);
    const level = group === "level";
    if (level) rows.sort((a, b) => (a.config.level?.fraction ?? 0) - (b.config.level?.fraction ?? 0));
    md.push(`## ${group}`, "", ...rows.map((r) => `- **${r.name}**: ${r.config.note ?? ""}`), "", ...tune_table(rows, level), "");
    const vt = values_table(rows);
    if (vt.length) md.push(level ? "Level to params curve:" : "Best values:", "", ...vt, "");
  }
  md.push(`Best values per run: \`${DIR}/runs/<name>.result.json\` (\`values\`). Logs: \`${DIR}/logs/\`.`, "");
  writeFileSync(SUMMARY, md.join("\n"));
}

if (import.meta.main) write_summary();

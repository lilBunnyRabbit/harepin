import { readFileSync } from "node:fs";
import { short } from "../../src/lab/export";

interface Driven {
  id: string;
  spec: string;
  where: string;
  metrics: Map<string, number>;
  /** The lead's ` sim` line for the trial, when `lab.ts <pack>` output was appended to the paste. */
  sim: Map<string, number>;
  ratings: Map<string, number>;
  picks: Map<string, string>;
}

interface Session {
  head: string;
  trials: Map<string, Driven>;
}

const INPUTS = ["lock", "rev", "thr"];

function pairs(text: string): Map<string, string> {
  return new Map(text.trim().split(" ").flatMap((p) => {
    const at = p.indexOf("=");
    return at > 0 ? [[p.slice(0, at), p.slice(at + 1)] as [string, string]] : [];
  }));
}

/** The first number of a value: `stop=31.6@100` and `latg=0.81/0.74` read as their first figure. */
const first = (v: string) => Number.parseFloat(v);

export function read_session(text: string): Session {
  const lines = text.split(/\r?\n/);
  const head = lines.find((l) => l.startsWith("#lab ")) ?? "";
  if (!head) throw new Error("no #lab line: not an export block");
  const trials = new Map<string, Driven>();
  let now: Driven | null = null;
  for (const line of lines) {
    if (line.startsWith("#trial ") && trials.has(line.split(" ")[1])) now = trials.get(line.split(" ")[1]) ?? null;
    else if (line.startsWith("#trial ")) {
      const words = line.split(" ");
      const spec = words.find((w) => w.startsWith("spec#")) ?? "spec#?";
      const where = words[words.indexOf(spec) + 2] ?? "";
      now = { id: words[1], spec: spec.slice(5), where, metrics: new Map(), sim: new Map(), ratings: new Map(), picks: new Map() };
      trials.set(now.id, now);
    } else if (now && line.startsWith(" m ")) {
      for (const [k, v] of pairs(line.slice(3))) if (Number.isFinite(first(v))) now.metrics.set(k, first(v));
    } else if (now && line.startsWith(" a ")) {
      for (const [k, v] of pairs(line.slice(3))) {
        if (Number.isFinite(Number(v))) now.ratings.set(k, Number(v));
        else now.picks.set(k, v.replace(/^"|"$/g, ""));
      }
    } else if (now && line.startsWith(" sim ")) {
      for (const [k, v] of pairs(line.slice(5))) if (Number.isFinite(first(v))) now.sim.set(k, first(v));
    }
  }
  return { head, trials };
}

/** Largest rating gap between two runs of one spec on one lane in a session: the anchors' noise band. */
function anchor_spread(s: Session): number {
  const seen = new Map<string, Driven[]>();
  for (const t of s.trials.values()) seen.set(`${t.spec} ${t.where}`, [...(seen.get(`${t.spec} ${t.where}`) ?? []), t]);
  let spread = Number.NaN;
  for (const runs of seen.values()) {
    if (runs.length < 2) continue;
    for (const [k] of runs[0].ratings) {
      const vs = runs.flatMap((r) => (r.ratings.has(k) ? [r.ratings.get(k) as number] : []));
      if (vs.length > 1) spread = Math.max(Number.isNaN(spread) ? 0 : spread, Math.max(...vs) - Math.min(...vs));
    }
  }
  return spread;
}

const signed = (d: number) => `${d < 0 ? "" : "+"}${short(d)}`;

export function diff_sessions(old_text: string, new_text: string): string[] {
  const a = read_session(old_text);
  const b = read_session(new_text);
  const spread = Math.max(anchor_spread(a), anchor_spread(b));
  const band = Number.isNaN(spread) ? "no anchor pair: every rating change flagged" : `anchor spread ${spread}`;
  const out = [`#diff ${a.head.slice(5)} -> ${b.head.slice(5)}`, `# ${band}`];
  for (const [id, now] of b.trials) {
    const was = a.trials.get(id);
    if (!was) {
      out.push(`#trial ${id} (new)`);
      continue;
    }
    out.push(`#trial ${id} spec#${was.spec === now.spec ? "same" : `moved ${was.spec}->${now.spec}`}`);
    const metric = [...now.metrics].flatMap(([k, v]) => {
      if (INPUTS.includes(k) || !was.metrics.has(k)) return [];
      const s = now.sim.get(k);
      const w = was.sim.get(k);
      const sim = s !== undefined && w !== undefined ? ` (sim ${signed(s - w)})` : "";
      return [`${k}=${signed(v - (was.metrics.get(k) as number))}${sim}`];
    });
    if (metric.length) out.push(` m ${metric.join(" ")}`);
    const rating = [...now.ratings].flatMap(([k, v]) => {
      const old = was.ratings.get(k);
      if (old === undefined || old === v) return [];
      const flag = Number.isNaN(spread) || Math.abs(v - old) > spread ? "!" : "";
      return [`${k}=${old}->${v}${flag}`];
    });
    for (const [k, v] of now.picks) {
      const old = was.picks.get(k);
      if (old !== undefined && old !== v) rating.push(`${k}=${old}->${v}`);
    }
    if (rating.length) out.push(` a ${rating.join(" ")}`);
    const inputs = INPUTS.flatMap((k) => (now.metrics.has(k) && was.metrics.has(k) ? [`${k}=${signed((now.metrics.get(k) as number) - (was.metrics.get(k) as number))}`] : []));
    if (inputs.length) out.push(` in ${inputs.join(" ")}`);
  }
  for (const id of a.trials.keys()) if (!b.trials.has(id)) out.push(`#trial ${id} (gone)`);
  return out;
}

export const diff_files = (old_path: string, new_path: string) => diff_sessions(readFileSync(old_path, "utf8"), readFileSync(new_path, "utf8"));

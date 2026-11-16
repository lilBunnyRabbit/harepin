import { existsSync, openSync, readdirSync } from "node:fs";
import { availableParallelism } from "node:os";
import { claim, DIR, read_json, ROOT, runs_dir } from "./cache";
import type { ExperimentConfig } from "./experiment";
import type { OracleConfig } from "./oracle";
import { write_summary } from "./summary";

// bun scripts/ai-ml/queue.ts [batch dir] [--parallel 3] [--jobs 3] [--max-wait 720]: runs every config in the batch dir
// (default scripts/ai-ml/batch), `--parallel` at a time, each as its own `hq lock run --` so it waits for a free heavy
// slot. Oracle configs go first; a `level` config waits for every oracle to finish, as it aims at their ceiling. A
// finished config (its result file in .ai-ml/<hash>/) is skipped, a half-run one resumes from its state file: after a
// crash, run the same command again. .ai-ml/summary.md is rebuilt as each one ends; logs in .ai-ml/<hash>/logs/.
// Detached on Windows: Start-Process bun -ArgumentList 'scripts/ai-ml/queue.ts' -WindowStyle Hidden

type Config = ExperimentConfig | OracleConfig;

interface Item {
  path: string;
  config: Config;
  attempts: number;
}

const arg = (name: string, fallback: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const batch = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "scripts/ai-ml/batch";
const parallel = Number(arg("--parallel", "3"));
const jobs = arg("--jobs", String(Math.max(1, Math.floor(availableParallelism() / 4))));
const max_wait = arg("--max-wait", "720");
/** A config that fails this many times is left for a human: a crash loop would hold a heavy slot all night. */
const ATTEMPTS = 2;

runs_dir("logs");
const release = claim(`${ROOT}/queue`);

const result_of = (c: Config) => `${DIR}/${c.kind === "oracle" ? "oracle" : "runs"}/${c.name}.result.json`;
const items: Item[] = readdirSync(batch)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => ({ path: `${batch}/${f}`, config: read_json<Config>(`${batch}/${f}`) as Config, attempts: 0 }))
  .sort((a, b) => (a.config.kind === "oracle" ? 0 : 1) - (b.config.kind === "oracle" ? 0 : 1));
const names = new Set<string>();
for (const it of items) {
  if (names.has(it.config.name)) throw new Error(`two configs named ${it.config.name}`);
  names.add(it.config.name);
}

const running = new Map<string, { started: number; done: Promise<void> }>();
const failed = new Set<string>();
const finished = (it: Item) => existsSync(result_of(it.config));
const oracles_settled = () => items.filter((it) => it.config.kind === "oracle").every((it) => finished(it) || failed.has(it.config.name));
const ready = (it: Item) => !finished(it) && !failed.has(it.config.name) && !running.has(it.config.name) && (it.config.kind === "oracle" || !it.config.level || oracles_settled());

function status(): string[] {
  const now = Date.now();
  return items.map((it) => {
    const name = it.config.name;
    const r = running.get(name);
    const state = finished(it) ? "done" : failed.has(name) ? `FAILED (see logs/${name}.log)` : r ? `running ${((now - r.started) / 60000).toFixed(0)} min` : "queued";
    return `${name}: ${state}`;
  });
}

function launch(it: Item) {
  const { name, kind } = it.config;
  it.attempts++;
  const log = openSync(`${DIR}/logs/${name}.log`, "a");
  const script = kind === "oracle" ? "scripts/ai-ml/oracle.ts" : "scripts/ai-ml/experiment.ts";
  const child = Bun.spawn(["hq", "lock", "run", "--label", `ai-ml ${name}`, "--max-wait", max_wait, "--", "bun", script, it.path, "--jobs", jobs], { stdout: log, stderr: log, stdin: "ignore" });
  const started = Date.now();
  const done = child.exited.then((code) => {
    running.delete(name);
    if (code !== 0 || !finished(it)) {
      console.log(`${new Date().toISOString()} ${name} exited ${code} (attempt ${it.attempts})`);
      if (it.attempts >= ATTEMPTS) failed.add(name);
    } else console.log(`${new Date().toISOString()} ${name} done in ${((Date.now() - started) / 60000).toFixed(0)} min`);
    write_summary(status());
  });
  running.set(name, { started, done });
  console.log(`${new Date().toISOString()} ${name} started`);
}

write_summary(status());
for (;;) {
  for (const it of items) if (running.size < parallel && ready(it)) launch(it);
  if (!running.size) break;
  await Promise.race([...running.values()].map((r) => r.done));
}
write_summary(status());
release();
console.log(`${new Date().toISOString()} queue empty: ${items.filter(finished).length}/${items.length} done, ${failed.size} failed`);

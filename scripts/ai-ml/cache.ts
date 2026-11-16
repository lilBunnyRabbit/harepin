import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { AI_TUNING } from "../../src/ai/tuning";

const sources = (dir: URL, keep: (name: string) => boolean = () => true) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts") && keep(name))
    .sort()
    .map((name) => name + readFileSync(new URL(name, dir), "utf8"))
    .join("");
const here = (name: string) => new URL(name, import.meta.url);

/**
 * Keys every cached run on what decides its numbers: AI_TUNING, src/ai, the car physics in src/car, and the oracle
 * drive, race and objective scripts. An edit to any starts a fresh cache dir; the old one stays readable.
 */
export const AI_HASH = Bun.hash(
  JSON.stringify(AI_TUNING) + sources(new URL("../../src/ai/", import.meta.url)) + sources(new URL("../../src/car/", import.meta.url)) + ["drive.ts", "../ai-tune/race.ts", "../ai-tune/objective.ts"].map((f) => readFileSync(here(f), "utf8")).join(""),
).toString(36);
export const ROOT = ".ai-ml";
export const DIR = `${ROOT}/${AI_HASH}`;
export const SUMMARY = `${ROOT}/summary.md`;

export const runs_dir = (kind: "runs" | "oracle" | "logs") => {
  const dir = `${DIR}/${kind}`;
  mkdirSync(dir, { recursive: true });
  return dir;
};

export function read_json<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : null;
}

/** Writes through a temp file, so a run killed mid-write leaves the last whole state, never half of one. */
export function write_json(path: string, value: unknown) {
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 1));
  renameSync(`${path}.tmp`, path);
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Takes `<path>.pid` for this process, thrown when a live one holds it: a queue restarted after a crash must not race a run its dead parent left going. */
export function claim(path: string): () => void {
  const pid_path = `${path}.pid`;
  if (existsSync(pid_path)) {
    const pid = Number(readFileSync(pid_path, "utf8"));
    if (pid !== process.pid && alive(pid)) throw new Error(`${path} is being run by pid ${pid}`);
  }
  writeFileSync(pid_path, String(process.pid));
  return () => existsSync(pid_path) && unlinkSync(pid_path);
}

export function seed_list(text: string): number[] {
  if (text === "none" || text === "") return [];
  return text.split(",").flatMap((part) => {
    const [a, b] = part.split("-").map(Number);
    return b === undefined ? [a] : Array.from({ length: b - a + 1 }, (_, i) => a + i);
  });
}

/** Workers kept for a whole run: each caches its worlds, which take a second or two to build. */
export class Pool<J, R> {
  private readonly workers: Worker[] = [];

  constructor(
    private readonly script: URL,
    private readonly size: number,
  ) {}

  start() {
    for (let w = 0; w < this.size; w++) this.workers.push(new Worker(this.script.href));
  }

  stop() {
    for (const w of this.workers) w.terminate();
    this.workers.length = 0;
  }

  run(jobs: readonly J[], on_result?: (result: R, done: number) => void): Promise<R[]> {
    const results: R[] = new Array(jobs.length);
    let next = 0;
    let done = 0;
    return new Promise((resolve, reject) => {
      if (!jobs.length) return resolve(results);
      for (const worker of this.workers) {
        let current = -1;
        const feed = () => {
          if (next >= jobs.length) return;
          current = next++;
          worker.postMessage(jobs[current]);
        };
        worker.onmessage = (event: MessageEvent<R>) => {
          results[current] = event.data;
          done++;
          on_result?.(event.data, done);
          if (done === jobs.length) resolve(results);
          feed();
        };
        worker.onerror = (event) => reject(new Error(`worker failed on job ${current}: ${event.message}`));
        feed();
      }
    });
  }
}

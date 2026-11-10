import { availableParallelism } from "node:os";

export function pool_size(argv: string[]): number {
  const at = argv.indexOf("--jobs");
  return at >= 0 ? Math.max(1, Number(argv[at + 1])) : Math.max(1, availableParallelism() - 1);
}

export function run_pool<J, R>(script: URL, jobs: J[], size: number, on_result?: (result: R, done: number) => void): Promise<R[]> {
  const results: R[] = new Array(jobs.length);
  let next = 0;
  let done = 0;
  return new Promise((resolve, reject) => {
    if (!jobs.length) return resolve(results);
    for (let w = 0; w < Math.min(size, jobs.length); w++) {
      const worker = new Worker(script.href);
      let current = -1;
      const feed = () => {
        if (next >= jobs.length) return worker.terminate();
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

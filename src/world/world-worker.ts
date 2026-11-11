import type { WorldPick } from "./world-pick";
import type { WorkerReply, WorkerRequest } from "../worldgen/worker";

export type Held = { type: "reply"; reply: WorkerReply } | { type: "error"; message: string };

/** The generation worker for one world; replies wait here until `listen`, so it can start before anyone listens. */
export class WorldWorker {
  private held: Held[] = [];
  private on: ((event: Held) => void) | null = null;

  private constructor(
    private readonly worker: Worker,
    readonly pick: WorldPick,
  ) {}

  /** A worker already planning the picked world; its chunks wait for `tones`. */
  static start(pick: WorldPick): WorldWorker {
    const gen = new WorldWorker(new Worker(new URL("../worldgen/worker.ts", import.meta.url), { type: "module" }), pick);
    gen.worker.addEventListener("message", (event: MessageEvent<WorkerReply>) => gen.take({ type: "reply", reply: event.data }));
    gen.worker.addEventListener("error", (event) => gen.take({ type: "error", message: event.message }));
    gen.post({ type: "gen", ...pick });
    return gen;
  }

  /** Every reply held so far, then each one as it comes. */
  listen(on: (event: Held) => void) {
    for (const event of this.held) on(event);
    this.held = [];
    this.on = on;
  }

  post(request: WorkerRequest) {
    this.worker.postMessage(request);
  }

  stop() {
    this.worker.terminate();
  }

  private take(event: Held) {
    if (this.on) this.on(event);
    else this.held.push(event);
  }
}

let early: WorldWorker | null = null;

/** The boot entry's start: generation runs while the game bundle downloads and evaluates. */
export function start_early(pick: WorldPick) {
  early = WorldWorker.start(pick);
}

/** The early worker, once, if it was started for this world; one started for another is stopped. */
export function take_early(pick: WorldPick): WorldWorker | null {
  const gen = early;
  early = null;
  if (gen && gen.pick.seed === pick.seed && gen.pick.kind === pick.kind && gen.pick.code === pick.code) return gen;
  gen?.stop();
  return null;
}

import type { ChunkBuffers, MeshTones } from "../worldgen/chunks";
import type { WorldKind } from "../worldgen/types";
import type { WorkerReply, WorkerRequest } from "../worldgen/worker";
import { World } from "./world";

/** One persistent generation worker: the world's plan first, then its chunks nearest the area someone waits on. */
export class WorldStream {
  private readonly arrived: ChunkBuffers[] = [];
  private listener: ((chunk: ChunkBuffers) => void) | null = null;
  mesh_ms = 0;

  private constructor(
    private readonly worker: Worker,
    readonly world: World,
    readonly gen_ms: number,
  ) {
    world.tiles.on_need = (x, z) => this.post({ type: "focus", x, z });
  }

  static open(seed: number, kind: WorldKind, tones: MeshTones): Promise<WorldStream> {
    const worker = new Worker(new URL("../worldgen/worker.ts", import.meta.url), { type: "module" });
    return new Promise((resolve, reject) => {
      let stream: WorldStream | null = null;
      worker.addEventListener("message", (event: MessageEvent<WorkerReply>) => {
        const reply = event.data;
        if (reply.type === "plan") {
          stream = new WorldStream(worker, new World(seed, reply.data, []), reply.gen_ms);
          resolve(stream);
        } else stream?.receive(reply);
      });
      worker.addEventListener("error", (event) => {
        worker.terminate();
        reject(new Error(`world worker: ${event.message}`));
      });
      worker.postMessage({ type: "gen", seed, kind, tones } satisfies WorkerRequest);
    });
  }

  /** Every chunk mesh so far, then each one as it arrives; its tile is already in `world.tiles`. */
  listen(listener: (chunk: ChunkBuffers) => void) {
    for (const chunk of this.arrived) listener(chunk);
    this.listener = listener;
  }

  stop() {
    this.worker.terminate();
    this.listener = null;
  }

  private post(request: WorkerRequest) {
    this.worker.postMessage(request);
  }

  private receive(reply: Exclude<WorkerReply, { type: "plan" }>) {
    if (reply.type === "done") {
      this.mesh_ms = reply.mesh_ms;
      return;
    }
    this.world.tiles.add(reply.index, reply.tile);
    if (!reply.chunk) return;
    this.arrived.push(reply.chunk);
    this.listener?.(reply.chunk);
  }
}

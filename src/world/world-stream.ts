import type { ChunkBuffers, MeshTones } from "../worldgen/chunks";
import type { WorldKind } from "../worldgen/types";
import type { WorkerReply, WorkerRequest } from "../worldgen/worker";
import { World } from "./world";

/** One persistent generation worker: the world's plan first, then its chunks nearest the area someone waits on. */
export class WorldStream {
  /** Chunks that came before anyone listened; handed over once, then let go. */
  private waiting: ChunkBuffers[] = [];
  private listener: ((chunk: ChunkBuffers) => void) | null = null;

  private constructor(
    private readonly worker: Worker,
    readonly world: World,
  ) {
    world.tiles.on_need = (x, z) => this.post({ type: "focus", x, z });
  }

  static open(seed: number, kind: WorldKind, tones: MeshTones): Promise<WorldStream> {
    const worker = new Worker(new URL("../worldgen/worker.ts", import.meta.url), { type: "module" });
    return new Promise((resolve, reject) => {
      let stream: WorldStream | null = null;
      const fail = (error: Error) => {
        worker.terminate();
        if (!stream) return reject(error);
        console.error(error);
        stream.world.tiles.fail(error);
      };
      worker.addEventListener("message", (event: MessageEvent<WorkerReply>) => {
        const reply = event.data;
        if (reply.type === "plan") {
          stream = new WorldStream(worker, new World(seed, reply.data, []));
          resolve(stream);
        } else if (reply.type === "error") fail(new Error(`world worker: ${reply.message}`));
        else stream?.receive(reply);
      });
      worker.addEventListener("error", (event) => fail(new Error(`world worker: ${event.message}`)));
      worker.postMessage({ type: "gen", seed, kind, tones } satisfies WorkerRequest);
    });
  }

  /** Every chunk mesh so far, then each one as it arrives; its tile is already in `world.tiles`. */
  listen(listener: (chunk: ChunkBuffers) => void) {
    for (const chunk of this.waiting) listener(chunk);
    this.waiting = [];
    this.listener = listener;
  }

  /** Lets chunk `index` go; its tile reads as missing until `request` brings it back. */
  drop(index: number) {
    this.world.tiles.drop(index);
  }

  request(index: number) {
    this.post({ type: "chunk", index });
  }

  private post(request: WorkerRequest) {
    this.worker.postMessage(request);
  }

  private receive(reply: Extract<WorkerReply, { type: "chunk" }>) {
    this.world.tiles.add(reply.index, reply.tile);
    if (!reply.chunk) return;
    if (this.listener) this.listener(reply.chunk);
    else this.waiting.push(reply.chunk);
  }
}

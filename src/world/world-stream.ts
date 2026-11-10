import type { ChunkBuffers, MeshTones } from "../worldgen/chunks";
import type { WorldKind } from "../worldgen/types";
import type { WorkerReply, WorkerRequest } from "../worldgen/worker";
import { World } from "./world";

/** One persistent generation worker: the world's plan first, then its chunks nearest the area someone waits on. */
export class WorldStream {
  /** Chunks that came before anyone listened; handed over once, then let go. */
  private waiting: ChunkBuffers[] = [];
  private listener: ((chunk: ChunkBuffers) => void) | null = null;
  /** Replies still to come per chunk; the first load asks for every chunk once. */
  private readonly pending: Uint16Array;
  /** Of those, how many answer a request made before the chunk was dropped, and so are thrown away. */
  private readonly stale: Uint16Array;

  private constructor(
    private readonly worker: Worker,
    readonly world: World,
  ) {
    const { side } = world.tiles.ext;
    this.pending = new Uint16Array(side * side).fill(1);
    this.stale = new Uint16Array(side * side);
    world.tiles.on_need = (missing, focus) => {
      if (focus) this.post({ type: "focus", x: focus.x, z: focus.z });
      for (const index of missing) this.request(index);
    };
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

  /** Lets chunk `index` go; its tile reads as missing until a wait on it or `request` brings it back. */
  drop(index: number) {
    this.world.tiles.drop(index);
    this.stale[index] = this.pending[index];
  }

  /** Asks for chunk `index` unless a reply that will be kept is already on its way. */
  request(index: number) {
    if (this.pending[index] > this.stale[index]) return;
    this.pending[index]++;
    this.post({ type: "chunk", index });
  }

  private post(request: WorkerRequest) {
    this.worker.postMessage(request);
  }

  private receive(reply: Extract<WorkerReply, { type: "chunk" }>) {
    this.pending[reply.index]--;
    if (this.stale[reply.index]) {
      this.stale[reply.index]--;
      return;
    }
    this.world.tiles.add(reply.index, reply.tile);
    if (!reply.chunk) return;
    if (this.listener) this.listener(reply.chunk);
    else this.waiting.push(reply.chunk);
  }
}

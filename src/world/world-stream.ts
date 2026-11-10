import { CHUNK, chunk_corner } from "../worldgen/chunk-grid";
import type { ChunkBuffers, MeshTones } from "../worldgen/chunks";
import type { Tree } from "../worldgen/types";
import type { WorldKind } from "../worldgen/types";
import type { WorkerReply, WorkerRequest } from "../worldgen/worker";
import { World } from "./world";

export interface ChunkListener {
  /** `trees` null on a compact world, whose trees came with its plan. */
  add(chunk: ChunkBuffers, trees: readonly Tree[] | null): void;
  drop(index: number): void;
}

/**
 * One persistent generation worker: the world's plan first, then its chunks nearest the area someone waits on. A compact
 * world sends every chunk once and keeps them; a streamed one keeps only the chunks around the car (`follow`).
 */
export class WorldStream {
  /** Chunks that came before anyone listened; handed over once, then let go. */
  private waiting: { chunk: ChunkBuffers; trees: readonly Tree[] | null }[] = [];
  private listener: ChunkListener | null = null;
  /** Replies still to come per chunk; a compact world's first load asks for every chunk once. */
  private readonly pending: Uint16Array;
  /** Of those, how many answer a request made before the chunk was dropped, and so are thrown away. */
  private readonly stale: Uint16Array;
  private at = -1;
  private fog = 0;

  private constructor(
    private readonly worker: Worker,
    readonly world: World,
  ) {
    const { side } = world.tiles.ext;
    this.pending = new Uint16Array(side * side).fill(world.tiles.streamed ? 0 : 1);
    this.stale = new Uint16Array(side * side);
    world.tiles.on_need = (missing, focus) => {
      if (focus) this.post({ type: "focus", x: focus.x, z: focus.z });
      for (const index of missing) this.request(index);
    };
  }

  static open(seed: number, kind: WorldKind, tones: MeshTones, opts = ""): Promise<WorldStream> {
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
          stream = new WorldStream(worker, new World(seed, reply.data, [], opts));
          resolve(stream);
        } else if (reply.type === "error") fail(new Error(`world worker: ${reply.message}`));
        else stream?.receive(reply);
      });
      worker.addEventListener("error", (event) => fail(new Error(`world worker: ${event.message}`)));
      worker.postMessage({ type: "gen", seed, kind, opts, tones } satisfies WorkerRequest);
    });
  }

  /** Every chunk mesh so far, then each one as it arrives (its tile already in `world.tiles`) and each drop. */
  listen(listener: ChunkListener) {
    for (const { chunk, trees } of this.waiting) listener.add(chunk, trees);
    this.waiting = [];
    this.listener = listener;
  }

  /**
   * A streamed world keeps the chunks whose centre lies within `fog_far` plus one chunk of (x, z) and lets go of those
   * past one chunk more, so driving along a border does not churn. Called every frame; only a new chunk or fog works.
   */
  follow(x: number, z: number, fog_far: number) {
    const { tiles } = this.world;
    if (!tiles.streamed) return;
    const { ext } = tiles;
    const ci = Math.max(0, Math.min(ext.side - 1, Math.floor((x - ext.origin) / CHUNK)));
    const cj = Math.max(0, Math.min(ext.side - 1, Math.floor((z - ext.origin) / CHUNK)));
    const at = cj * ext.side + ci;
    if (at === this.at && fog_far === this.fog) return;
    this.at = at;
    this.fog = fog_far;
    this.post({ type: "focus", x, z });
    const keep = (fog_far + CHUNK) ** 2;
    const leave = (fog_far + 2 * CHUNK) ** 2;
    for (let index = 0; index < ext.side * ext.side; index++) {
      const [x0, z0] = chunk_corner(index, ext);
      const dx = x0 + CHUNK / 2 - x;
      const dz = z0 + CHUNK / 2 - z;
      const d = dx * dx + dz * dz;
      const held = tiles.get(index) !== undefined || this.pending[index] > this.stale[index];
      if (d <= keep && !held) this.request(index);
      else if (d > leave && held) this.drop(index);
    }
  }

  /** Lets chunk `index` go; its tile reads as missing until a wait on it or `request` brings it back. */
  drop(index: number) {
    this.world.tiles.drop(index);
    this.world.unplant(index);
    this.stale[index] = this.pending[index];
    this.listener?.drop(index);
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
    if (reply.planted) this.world.plant(reply.index, reply.planted.solids);
    if (!reply.chunk) return;
    const trees = reply.planted?.trees ?? null;
    if (this.listener) this.listener.add(reply.chunk, trees);
    else this.waiting.push({ chunk: reply.chunk, trees });
  }
}

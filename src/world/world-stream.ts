import { CHUNK, chunk_corner } from "../worldgen/chunk-grid";
import type { ChunkBuffers, MeshTones } from "../worldgen/chunks";
import type { Tree } from "../worldgen/types";
import type { WorldKind } from "../worldgen/types";
import type { WorkerReply, WorkerRequest } from "../worldgen/worker";
import { World } from "./world";
import { WorldWorker, take_early } from "./world-worker";

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
  private reach = 0;

  private constructor(
    private readonly worker: WorldWorker,
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

  /** Takes over the boot entry's worker when it was started for this world, else starts one. */
  static open(seed: number, kind: WorldKind, tones: MeshTones): Promise<WorldStream> {
    const worker = take_early(seed, kind) ?? WorldWorker.start(seed, kind);
    worker.post({ type: "tones", tones });
    return new Promise((resolve, reject) => {
      let stream: WorldStream | null = null;
      const fail = (error: Error) => {
        worker.stop();
        if (!stream) return reject(error);
        console.error(error);
        stream.world.tiles.fail(error);
      };
      worker.listen((event) => {
        if (event.type === "error") return fail(new Error(`world worker: ${event.message}`));
        const { reply } = event;
        if (reply.type === "plan") {
          stream = new WorldStream(worker, new World(seed, reply.data, []));
          resolve(stream);
        } else if (reply.type === "error") fail(new Error(`world worker: ${reply.message}`));
        else stream?.receive(reply);
      });
    });
  }

  /** Every chunk mesh so far, then each one as it arrives (its tile already in `world.tiles`) and each drop. */
  listen(listener: ChunkListener) {
    for (const { chunk, trees } of this.waiting) listener.add(chunk, trees);
    this.waiting = [];
    this.listener = listener;
  }

  /**
   * A streamed world keeps the chunks with any point within `reach` of (x, z) and lets go of those past one chunk more,
   * so driving along a border does not churn. Called every frame; only a new chunk or reach works.
   */
  follow(x: number, z: number, reach: number) {
    const { tiles } = this.world;
    if (!tiles.streamed) return;
    const { ext } = tiles;
    const ci = Math.max(0, Math.min(ext.side - 1, Math.floor((x - ext.origin) / CHUNK)));
    const cj = Math.max(0, Math.min(ext.side - 1, Math.floor((z - ext.origin) / CHUNK)));
    const at = cj * ext.side + ci;
    if (at === this.at && reach === this.reach) return;
    this.at = at;
    this.reach = reach;
    this.post({ type: "focus", x, z });
    const keep = reach ** 2;
    const leave = (reach + CHUNK) ** 2;
    for (let index = 0; index < ext.side * ext.side; index++) {
      const [x0, z0] = chunk_corner(index, ext);
      const dx = Math.max(x0 - x, 0, x - x0 - CHUNK);
      const dz = Math.max(z0 - z, 0, z - z0 - CHUNK);
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
    this.worker.post(request);
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

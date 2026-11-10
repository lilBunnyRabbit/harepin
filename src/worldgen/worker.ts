import { CHUNK, CHUNKS } from "./chunk-grid";
import { chunk_meshes, chunk_transfers, type ChunkBuffers, type MeshTones } from "./chunks";
import { generate_world } from "./kinds/kinds";
import { slice_tile, tile_transfers, type Tile } from "./tiles";
import { ORIGIN, SPAWN_INDEX, type WorldData, type WorldKind } from "./types";

export interface GenRequest {
  type: "gen";
  seed: number;
  kind: WorldKind;
  tones: MeshTones;
}

export interface FocusRequest {
  type: "focus";
  x: number;
  z: number;
}

export type WorkerRequest = GenRequest | FocusRequest;

export type WorkerReply =
  /** Everything but the terrain grids, which arrive tile by tile. */
  | { type: "plan"; data: WorldData; gen_ms: number }
  | { type: "chunk"; index: number; tile: Tile; chunk: ChunkBuffers | null }
  | { type: "done"; mesh_ms: number };

let focus: [number, number] = [0, 0];

function nearest(left: number[]): number {
  let best = 0;
  let dist = Infinity;
  left.forEach((index, at) => {
    const dx = ORIGIN + ((index % CHUNKS) + 0.5) * CHUNK - focus[0];
    const dz = ORIGIN + (Math.floor(index / CHUNKS) + 0.5) * CHUNK - focus[1];
    const d = dx * dx + dz * dz;
    if (d < dist) {
      dist = d;
      best = at;
    }
  });
  return left.splice(best, 1)[0];
}

async function stream({ seed, kind, tones }: GenRequest) {
  const t0 = performance.now();
  const data = generate_world(seed, kind);
  const t1 = performance.now();
  const spawn = data.road.at(SPAWN_INDEX) ?? data.road[0];
  if (spawn) focus = [spawn.x, spawn.z];
  const empty = { heights: new Float32Array(0), road_dist: new Float32Array(0), surface: new Uint8Array(0) };
  postMessage({ type: "plan", data: { ...data, terrain: { ...data.terrain, ...empty } }, gen_ms: t1 - t0 } satisfies WorkerReply);
  const build = chunk_meshes(data, tones);
  const left = Array.from({ length: CHUNKS * CHUNKS }, (_, index) => index);
  while (left.length) {
    const index = nearest(left);
    const tile = slice_tile(data.terrain, index);
    const chunk = build(index);
    postMessage({ type: "chunk", index, tile, chunk } satisfies WorkerReply, { transfer: [...tile_transfers(tile), ...(chunk ? chunk_transfers([chunk]) : [])] });
    // A turn of the event loop between chunks lets a focus request reorder what is left.
    await new Promise((next) => setTimeout(next, 0));
  }
  postMessage({ type: "done", mesh_ms: performance.now() - t1 } satisfies WorkerReply);
}

addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === "focus") focus = [request.x, request.z];
  else void stream(request);
});

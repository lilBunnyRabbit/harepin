import { build_chunks, chunk_transfers, type ChunkBuffers, type MeshTones } from "./chunks";
import { generate_world } from "./index";
import type { WorldData, WorldKind } from "./types";

export interface GenRequest {
  seed: number;
  kind: WorldKind;
  tones: MeshTones;
}

export interface GenResult {
  data: WorldData;
  chunks: ChunkBuffers[];
  /** Worker-side time spent generating and meshing, in ms. */
  gen_ms: number;
  mesh_ms: number;
}

addEventListener("message", (event: MessageEvent<GenRequest>) => {
  const { seed, kind, tones } = event.data;
  const t0 = performance.now();
  const data = generate_world(seed, kind);
  const t1 = performance.now();
  const chunks = build_chunks(data, tones);
  const result: GenResult = { data, chunks, gen_ms: t1 - t0, mesh_ms: performance.now() - t1 };
  postMessage(result, { transfer: [data.terrain.heights.buffer, data.terrain.road_dist.buffer, data.terrain.surface.buffer, ...chunk_transfers(chunks)] });
});

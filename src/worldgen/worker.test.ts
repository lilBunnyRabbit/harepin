/// <reference types="bun" />
import { expect, test } from "bun:test";
import { build_chunks, type MeshTones } from "./chunks";
import { checksum, world_checksum } from "./checksum";
import { generate } from "./index";
import type { GenRequest, GenResult } from "./worker";

const SEED = 7;
const TONES: MeshTones = {
  terrain: Float32Array.from({ length: 8 * 64 * 3 }, (_, i) => (i % 97) / 97),
  asphalt: [0.1, 0.1, 0.12],
  sidewalk: [0.4, 0.4, 0.38],
  line: [0.9, 0.9, 0.9],
  edge_line: [0.8, 0.8, 0.5],
  walls: [
    [0.6, 0.5, 0.4],
    [0.5, 0.6, 0.4],
    [0.4, 0.5, 0.6],
  ],
  roofs: [
    [0.5, 0.2, 0.2],
    [0.2, 0.3, 0.4],
  ],
  roof_flat: [0.3, 0.3, 0.3],
};

function from_worker(request: GenRequest): Promise<GenResult> {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    worker.addEventListener("message", (event: MessageEvent<GenResult>) => {
      worker.terminate();
      resolve(event.data);
    });
    worker.addEventListener("error", (event) => {
      worker.terminate();
      reject(new Error(event.message));
    });
    worker.postMessage(request);
  });
}

function chunk_checksum(chunks: GenResult["chunks"]): string {
  return checksum(chunks.flatMap((c) => [c.terrain.positions, c.terrain.colors, c.terrain.index, ...[c.road, c.buildings, c.parking].flatMap((p) => (p ? [p.positions, p.colors] : [])), c.glass?.positions ?? []]));
}

test("the worker builds the same world and meshes as a direct call", async () => {
  const direct = generate(SEED);
  const direct_chunks = build_chunks(direct, TONES);
  const { data, chunks } = await from_worker({ seed: SEED, tones: TONES });
  expect(world_checksum(data)).toBe(world_checksum(direct));
  expect(chunk_checksum(chunks)).toBe(chunk_checksum(direct_chunks));
  expect({ ...data, timings: [] }).toEqual({ ...direct, timings: [] });
}, 30_000);

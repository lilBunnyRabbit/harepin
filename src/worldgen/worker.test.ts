/// <reference types="bun" />
import { expect, test } from "bun:test";
import { build_chunks, JITTER_LEVELS, TERRAIN_BASES, type MeshTones } from "./chunks";
import { checksum, world_checksum } from "./checksum";
import { generate } from "./index";
import { generate_world } from "./kinds/kinds";
import type { GenRequest, GenResult } from "./worker";

const SEED = 7;
const TONES: MeshTones = {
  terrain: Float32Array.from({ length: TERRAIN_BASES * JITTER_LEVELS * 3 }, (_, i) => (i % 97) / 97),
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
  landmark: { pale: [0.85, 0.85, 0.8], band: [0.6, 0.2, 0.2], cap: [0.2, 0.2, 0.25], stone: [0.5, 0.45, 0.4], stone_shade: [0.4, 0.36, 0.32] },
  deck: { deck: [0.2, 0.5, 0.8], side: [0.1, 0.2, 0.3], rail: [0.9, 0.9, 0.9], joint: [0.05, 0.05, 0.05], pad: [0.4, 0.6, 0.9], chevron: [0.1, 0.3, 0.6] },
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
  return checksum(chunks.flatMap((c) => [...(c.terrain ? [c.terrain.positions, c.terrain.colors, c.terrain.index] : []), ...[c.road, c.buildings, c.parking].flatMap((p) => (p ? [p.positions, p.colors] : [])), c.glass?.positions ?? []]));
}

test("the worker builds the same world and meshes as a direct call", async () => {
  const direct = generate(SEED);
  const direct_chunks = build_chunks(direct, TONES);
  const { data, chunks } = await from_worker({ seed: SEED, kind: "island", tones: TONES });
  expect(world_checksum(data)).toBe(world_checksum(direct));
  expect(chunk_checksum(chunks)).toBe(chunk_checksum(direct_chunks));
  expect({ ...data, timings: [] }).toEqual({ ...direct, timings: [] });
}, 30_000);

test("the worker builds the sky track as a direct call does, with no terrain mesh", async () => {
  const direct = generate_world(SEED, "sky");
  const { data, chunks } = await from_worker({ seed: SEED, kind: "sky", tones: TONES });
  expect(data.kind).toBe("sky");
  expect(data.deck?.line).toEqual(direct.deck?.line);
  expect(chunk_checksum(chunks)).toBe(chunk_checksum(build_chunks(direct, TONES)));
  expect(chunks.length).toBeGreaterThan(4);
  expect(chunks.every((c) => c.terrain === null && c.road)).toBe(true);
}, 30_000);

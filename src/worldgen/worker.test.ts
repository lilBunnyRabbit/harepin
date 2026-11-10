/// <reference types="bun" />
import { expect, test } from "bun:test";
import { build_chunks, JITTER_LEVELS, TERRAIN_BASES, type ChunkBuffers, type MeshTones } from "./chunks";
import { checksum } from "./checksum";
import { generate } from "./index";
import { generate_world } from "./kinds/kinds";
import { CHUNK, CHUNKS } from "./chunk-grid";
import { slice_tiles, type Tile } from "./tiles";
import { ORIGIN, SPAWN_INDEX, type WorldData } from "./types";
import type { GenRequest, TonesRequest, WorkerReply } from "./worker";

const SEED = 7;
const TONES: MeshTones = {
  terrain: Float32Array.from({ length: TERRAIN_BASES * JITTER_LEVELS * 3 }, (_, i) => (i % 97) / 97),
  asphalt: [0.1, 0.1, 0.12],
  water: [0.1, 0.3, 0.6],
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
  landmark: { pale: [0.85, 0.85, 0.8], band: [0.6, 0.2, 0.2], cap: [0.2, 0.2, 0.25], stone: [0.5, 0.45, 0.4], stone_shade: [0.4, 0.36, 0.32], plant: [0.3, 0.45, 0.3], plant_shade: [0.24, 0.36, 0.24] },
  deck: { deck: [0.2, 0.5, 0.8], side: [0.1, 0.2, 0.3], rail: [0.9, 0.9, 0.9], joint: [0.05, 0.05, 0.05], pad: [0.4, 0.6, 0.9], chevron: [0.1, 0.3, 0.6] },
};

interface Streamed {
  data: WorldData;
  chunks: ChunkBuffers[];
  tiles: Tile[];
  order: number[];
}

function from_worker({ tones, ...request }: Omit<GenRequest, "type"> & { tones: MeshTones }): Promise<Streamed> {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const out: Partial<Streamed> & Omit<Streamed, "data"> = { chunks: [], tiles: [], order: [] };
  return new Promise((resolve, reject) => {
    worker.addEventListener("message", (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.type === "plan") out.data = reply.data;
      else if (reply.type === "error") {
        worker.terminate();
        reject(new Error(`error reply: ${reply.message}`));
      } else {
        out.order.push(reply.index);
        out.tiles[reply.index] = reply.tile;
        if (reply.chunk) out.chunks.push(reply.chunk);
        if (out.order.length < CHUNKS * CHUNKS) return;
        worker.terminate();
        if (!out.data) return reject(new Error("no plan"));
        out.chunks.sort((a, b) => a.index - b.index);
        resolve({ ...out, data: out.data });
      }
    });
    worker.addEventListener("error", (event) => {
      worker.terminate();
      reject(new Error(event.message));
    });
    worker.postMessage({ type: "gen", ...request } satisfies GenRequest);
    worker.postMessage({ type: "tones", tones } satisfies TonesRequest);
  });
}

function chunk_checksum(chunks: ChunkBuffers[]): string {
  return checksum(chunks.flatMap((c) => [...(c.terrain ? [c.terrain.positions, c.terrain.colors, c.terrain.index] : []), ...[c.road, c.buildings, c.parking].flatMap((p) => (p ? [p.positions, p.colors] : [])), c.glass?.positions ?? []]));
}

function tile_checksum(tiles: Tile[]): string {
  return checksum(tiles.flatMap((t) => [t.heights, t.road_dist, t.surface]));
}

test("the streamed world, once every chunk is in, equals a direct call", async () => {
  const direct = generate(SEED);
  const direct_chunks = build_chunks(direct, TONES);
  const { data, chunks, tiles, order } = await from_worker({ seed: SEED, kind: "island", tones: TONES });
  expect(chunk_checksum(chunks)).toBe(chunk_checksum(direct_chunks));
  expect(tiles.length).toBe(CHUNKS * CHUNKS);
  expect(tile_checksum(tiles)).toBe(tile_checksum(slice_tiles(direct.terrain)));
  expect(data.terrain.heights.length).toBe(0);
  const { terrain: _, timings: __, ground: _g, ...rest } = data;
  const { terrain: ___, timings: ____, ground: __g, ...direct_rest } = direct;
  expect(rest).toEqual(direct_rest);
  const spawn = direct.road.at(SPAWN_INDEX) ?? direct.road[0];
  const dist = (index: number) => Math.hypot(ORIGIN + ((index % CHUNKS) + 0.5) * CHUNK - spawn.x, ORIGIN + (Math.floor(index / CHUNKS) + 0.5) * CHUNK - spawn.z);
  expect(order.map(dist)).toEqual(order.map(dist).toSorted((a, b) => a - b));
}, 30_000);

test("the worker builds the sky track as a direct call does, with no terrain mesh", async () => {
  const direct = generate_world(SEED, "sky");
  const { data, chunks, tiles } = await from_worker({ seed: SEED, kind: "sky", tones: TONES });
  expect(tiles.filter(Boolean).length).toBe(CHUNKS * CHUNKS);
  expect(data.kind).toBe("sky");
  expect(data.deck?.line).toEqual(direct.deck?.line);
  expect(chunk_checksum(chunks)).toBe(chunk_checksum(build_chunks(direct, TONES)));
  expect(chunks.length).toBeGreaterThan(4);
  expect(chunks.every((c) => c.terrain === null && c.road)).toBe(true);
}, 30_000);

test("a throw in the worker comes back as an error reply instead of a silent hang", async () => {
  await expect(from_worker({ seed: SEED, kind: "nowhere" as WorldData["kind"], tones: TONES })).rejects.toThrow(/^error reply: /);
}, 30_000);

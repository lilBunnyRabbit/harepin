/// <reference types="bun" />
import { expect, test } from "bun:test";
import { CHUNK, CHUNKS } from "../worldgen/chunk-grid";
import type { ChunkBuffers, MeshTones } from "../worldgen/chunks";
import { ORIGIN, type WorldKind } from "../worldgen/types";
import { WorldStream } from "./world-stream";

const BROKEN = {} as MeshTones;
const pick = (seed: number, kind: WorldKind) => [{ seed, kind, code: null }, { seed, kind, levels: [] }] as const;

test("a world that fails to generate rejects open instead of hanging", async () => {
  await expect(WorldStream.open(...pick(0, "nowhere" as WorldKind), BROKEN)).rejects.toThrow(/world worker/);
}, 30_000);

test("meshing that throws after the plan rejects every wait on a missing chunk", async () => {
  const stream = await WorldStream.open(...pick(0, "island"), BROKEN);
  await expect(stream.world.tiles.whole()).rejects.toThrow(/world worker/);
  await expect(stream.world.tiles.ensure(900, 900)).rejects.toThrow(/world worker/);
}, 30_000);

test("a dropped chunk comes back on request with the same tile and mesh", async () => {
  const { MESH_TONES: TONES } = await import("../../scripts/proof/tones");
  const { checksum } = await import("../worldgen/checksum");
  const stream = await WorldStream.open(...pick(3, "island"), TONES);
  const meshes = new Map<number, string>();
  const mesh_sum = (c: ChunkBuffers) => checksum([...(c.terrain ? [c.terrain.positions, c.terrain.colors, c.terrain.index] : []), ...[c.road, c.buildings, c.parking].flatMap((p) => (p ? [p.positions, p.colors] : []))]);
  const again: string[] = [];
  stream.listen({ add: (c) => void (meshes.has(c.index) ? again.push(mesh_sum(c)) : meshes.set(c.index, mesh_sum(c))), drop: () => {} });
  await stream.world.tiles.whole();
  const index = 27;
  const x0 = ORIGIN + (index % CHUNKS) * CHUNK;
  const z0 = ORIGIN + Math.floor(index / CHUNKS) * CHUNK;
  const probe = () => Array.from({ length: 400 }, (_, k) => [stream.world.tiles.height(x0 + (k % 20) * 12.7, z0 + Math.floor(k / 20) * 12.7), stream.world.tiles.road_dist(x0 + (k % 20) * 12.7, z0 + Math.floor(k / 20) * 12.7)]).flat();
  const before = checksum([probe()]);
  stream.drop(index);
  expect(stream.world.tiles.complete).toBe(false);
  expect(checksum([probe()])).not.toBe(before);
  stream.request(index);
  await stream.world.tiles.whole();
  expect(checksum([probe()])).toBe(before);
  expect(again).toEqual([meshes.get(index) ?? ""]);
}, 60_000);

test("a wait on a dropped chunk asks for it again, and a reply asked for before a drop is thrown away", async () => {
  const { MESH_TONES } = await import("../../scripts/proof/tones");
  const stream = await WorldStream.open(...pick(5, "island"), MESH_TONES);
  await stream.world.tiles.whole();
  const index = 27;
  const x = ORIGIN + ((index % CHUNKS) + 0.5) * CHUNK;
  const z = ORIGIN + (Math.floor(index / CHUNKS) + 0.5) * CHUNK;
  const before = stream.world.tiles.height(x, z);
  stream.drop(index);
  stream.request(index);
  stream.drop(index);
  await new Promise((done) => setTimeout(done, 500));
  expect(stream.world.tiles.complete).toBe(false);
  await stream.world.tiles.ensure(x, z);
  expect(stream.world.tiles.height(x, z)).toBe(before);
  expect(stream.world.tiles.complete).toBe(true);
}, 60_000);

test("a streamed world keeps only the chunks around the car, nearest first, and lets the far ones go", async () => {
  const { MESH_TONES } = await import("../../scripts/proof/tones");
  const stream = await WorldStream.open(...pick(0, "mainland"), MESH_TONES);
  const { tiles } = stream.world;
  const { ext } = tiles;
  const shown = new Set<number>();
  const order: number[] = [];
  stream.listen({ add: (c) => void (shown.add(c.index), order.push(c.index)), drop: (index) => void shown.delete(index) });
  const fog = 700;
  const pad = 128;
  const from = (index: number, x: number, z: number) => {
    const x0 = ext.origin + (index % ext.side) * CHUNK;
    const z0 = ext.origin + Math.floor(index / ext.side) * CHUNK;
    return Math.hypot(Math.max(x0 - x, 0, x - x0 - CHUNK), Math.max(z0 - z, 0, z - z0 - CHUNK));
  };
  const in_fog = (x: number, z: number) => Array.from({ length: ext.side ** 2 }, (_, index) => index).filter((index) => from(index, x, z) <= fog);
  const resident = () => Array.from({ length: ext.side ** 2 }, (_, index) => index).filter((index) => tiles.get(index));
  const settle = async (x: number, z: number) => {
    stream.follow(x, z, fog + pad);
    await tiles.ensure(x, z);
    for (let last = -1; last !== order.length; ) {
      last = order.length;
      await new Promise((done) => setTimeout(done, 600));
      stream.follow(x, z, fog + pad);
    }
  };
  await settle(0, 0);
  const first = resident();
  expect(first.length).toBeGreaterThan(44);
  expect(first.length).toBeLessThan(60);
  expect(in_fog(0, 0).filter((index) => !tiles.get(index))).toEqual([]);
  expect([...shown].sort()).toEqual(first.sort());
  expect(from(order[0], 0, 0)).toBeLessThan(CHUNK);
  await settle(1500, 0);
  const now = resident();
  expect(in_fog(1500, 0).filter((index) => !tiles.get(index))).toEqual([]);
  for (const index of now) expect(from(index, 1500, 0)).toBeLessThanOrEqual(fog + pad + CHUNK);
  expect(first.filter((index) => from(index, 1500, 0) > fog + pad + CHUNK).length).toBeGreaterThan(10);
  expect([...shown].sort()).toEqual(now.sort());
  // Crossing one chunk north to south: a chunk 400 m east and one row past the fog comes into it before the car leaves.
  const x = ext.origin + Math.floor((1500 - ext.origin) / CHUNK) * CHUNK + 112;
  const north = ext.origin + Math.floor(-ext.origin / CHUNK) * CHUNK + 2;
  await settle(x, north - 1200);
  await settle(x, north);
  await settle(x, north + CHUNK - 4);
  expect(in_fog(x, north + CHUNK - 4).filter((index) => !tiles.get(index))).toEqual([]);
}, 60_000);

test("a compact world keeps every chunk wherever the car goes", async () => {
  const { MESH_TONES } = await import("../../scripts/proof/tones");
  const stream = await WorldStream.open(...pick(2, "island"), MESH_TONES);
  await stream.world.tiles.whole();
  stream.follow(900, 900, 700);
  stream.follow(-900, -900, 700);
  expect(stream.world.tiles.complete).toBe(true);
}, 60_000);

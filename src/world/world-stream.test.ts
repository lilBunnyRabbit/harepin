/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { MeshTones } from "../worldgen/chunks";
import { WorldStream } from "./world-stream";

const BROKEN = {} as MeshTones;

test("a world that fails to generate rejects open instead of hanging", async () => {
  await expect(WorldStream.open(0, "nowhere" as "island", BROKEN)).rejects.toThrow(/world worker/);
}, 30_000);

test("meshing that throws after the plan rejects every wait on a missing chunk", async () => {
  const stream = await WorldStream.open(0, "island", BROKEN);
  await expect(stream.world.tiles.whole()).rejects.toThrow(/world worker/);
  await expect(stream.world.tiles.ensure(900, 900)).rejects.toThrow(/world worker/);
}, 30_000);

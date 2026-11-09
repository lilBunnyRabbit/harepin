/// <reference types="bun" />
import { expect, test } from "bun:test";
import { JITTER_LEVELS } from "./chunks";
import { generate } from "./index";
import { MAP_SIDE, MapLineKind, map_data, type MapData, type MapTones } from "./map";
import type { MapRequest } from "./map-worker";
import { ORIGIN, SIZE } from "./types";

const SEED = 7;
const TONES: MapTones = { terrain: Float32Array.from({ length: 8 * JITTER_LEVELS * 3 }, (_, i) => (i % 97) / 97), water: [0.1, 0.2, 0.4] };

function from_worker(request: MapRequest): Promise<MapData> {
  const worker = new Worker(new URL("./map-worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    worker.addEventListener("message", (event: MessageEvent<MapData>) => {
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

test("the map worker draws the same island as a direct call", async () => {
  const direct = map_data(generate(SEED), TONES);
  expect(await from_worker({ seed: SEED, kind: "island", tones: TONES })).toEqual(direct);
}, 30_000);

test("the map covers the island and draws the circuit through the start", () => {
  const world = generate(SEED);
  const map = map_data(world, TONES);
  expect(map.seed).toBe(SEED);
  expect(map.pixels.length).toBe(MAP_SIDE * MAP_SIDE * 4);
  expect(map.pixels.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true);
  const circuit = map.lines.filter((l) => l.kind === MapLineKind.CIRCUIT);
  expect(circuit).toHaveLength(1);
  expect([circuit[0].points[0], circuit[0].points[1]]).toEqual([Math.fround(map.start.x), Math.fround(map.start.z)]);
  expect(map.lines.filter((l) => l.kind === MapLineKind.STREET).length).toBeGreaterThan(0);
  expect(map.checkpoints).toHaveLength(world.checkpoints.length);
  expect(map.jumps).toHaveLength(world.ramps.length);
  for (const l of map.lines) for (const v of l.points) expect(Math.abs(v)).toBeLessThanOrEqual(-ORIGIN);
  expect(map.size).toBe(SIZE);
});

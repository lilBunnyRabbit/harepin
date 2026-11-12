/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sweep } from "../sweep";
import { CHUNKS } from "./chunk-grid";
import { build_tile } from "./ground";
import { generate_world } from "./kinds/kinds";
import { slice_tile, type Tile } from "./tiles";
import { WorldKind } from "./types";

function same(a: Tile, b: Tile): boolean {
  const bits = (f: Float32Array) => new Uint32Array(f.buffer, f.byteOffset, f.length);
  return Bun.deepEquals(bits(a.heights), bits(b.heights)) && Bun.deepEquals(bits(a.road_dist), bits(b.road_dist)) && Bun.deepEquals(a.surface, b.surface);
}

const CASES: [WorldKind, number[]][] = [
  [WorldKind.ISLAND, sweep(20)],
  [WorldKind.ALPINE, sweep(10)],
  [WorldKind.DESERT, [0, 1]],
  [WorldKind.TUNDRA, [0, 1]],
  [WorldKind.VOLCANO, [0, 1]],
  [WorldKind.ICE_CANYON, [0, 1]],
  [WorldKind.SKY, [0]],
];

for (const [kind, seeds] of CASES)
  for (const seed of seeds)
    test(`every ${kind} ${seed} tile built alone equals its slice of the whole grid`, () => {
      const data = generate_world(seed, kind);
      let bad = 0;
      for (let index = 0; index < CHUNKS * CHUNKS; index++) if (!same(build_tile(data.ground, index), slice_tile(data.terrain, index))) bad++;
      expect(bad).toBe(0);
    }, 60_000);

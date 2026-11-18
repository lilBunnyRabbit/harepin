import { deserialize, serialize } from "bun:jsc";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { threadId } from "node:worker_threads";
import { World } from "../../src/world/world";
import { generate } from "../../src/worldgen/index";
import type { WorldData } from "../../src/worldgen/types";
import { ROOT } from "./cache";

/** Built island worlds one thread keeps: a seed's routes, cars and candidates land on the same worker one after another. */
const KEPT = 2;

const sources = (dir: URL): string =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .sort()
    .map((name) => name + readFileSync(new URL(name.replaceAll("\\", "/"), dir), "utf8"))
    .join("");

export const WORLDGEN_HASH = Bun.hash(sources(new URL("../../src/worldgen/", import.meta.url)) + readFileSync(new URL("../../src/rng.ts", import.meta.url), "utf8")).toString(36);
const DIR = `${ROOT}/worlds/${WORLDGEN_HASH}`;

/** Generating a seed takes 600 ms; reading its structured clone back takes 15 ms, bit for bit. */
export function island_data(seed: number): WorldData {
  const path = `${DIR}/${seed}.bin`;
  if (existsSync(path)) return deserialize(readFileSync(path)) as WorldData;
  const data = generate(seed);
  mkdirSync(DIR, { recursive: true });
  const tmp = `${path}.${process.pid}-${threadId}.tmp`;
  writeFileSync(tmp, serialize(data, { binaryType: "nodebuffer" }));
  try {
    renameSync(tmp, path);
  } catch (e) {
    // Two workers can build one seed at once; Windows refuses the second rename while the first file is being read.
    if (!existsSync(path)) throw e;
    unlinkSync(tmp);
  }
  return data;
}

const kept = new Map<number, World>();

export function island(seed: number): World {
  const hit = kept.get(seed);
  if (hit) {
    kept.delete(seed);
    kept.set(seed, hit);
    return hit;
  }
  const world = new World(seed, island_data(seed));
  kept.set(seed, world);
  if (kept.size > KEPT) kept.delete(kept.keys().next().value as number);
  return world;
}

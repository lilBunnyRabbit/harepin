import { deserialize, serialize } from "bun:jsc";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { threadId } from "node:worker_threads";
import { World } from "../../src/world/world";
import { generate } from "../../src/worldgen/index";
import { generate_world } from "../../src/worldgen/kinds/kinds";
import { WORLD_VERSION, WorldKind, type WorldData } from "../../src/worldgen/types";
import { closure, ROOT } from "./cache";

/** Built worlds one thread keeps, so a seed's next route on the same worker skips the rebuild. */
const KEPT = 2;

const WORLDGEN = new URL("../../src/worldgen/", import.meta.url);

/**
 * Keys the world cache: the island's version and every file generation or the World built from it reads (the worldgen
 * tree plus what it imports, sim-math among them, and world.ts's import closure). An edit to any starts a fresh dir.
 */
export const WORLDGEN_HASH = Bun.hash(
  `${WORLD_VERSION}/` +
    closure([
      ...readdirSync(WORLDGEN, { recursive: true, encoding: "utf8" })
        .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
        .map((name) => new URL(name.replaceAll("\\", "/"), WORLDGEN)),
      new URL("../../src/world/world.ts", import.meta.url),
    ]),
).toString(36);
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

const kept = new Map<string, World>();

export function world_at(seed: number, kind: WorldKind = WorldKind.ISLAND): World {
  const key = place_of(seed, kind);
  const hit = kept.get(key);
  if (hit) {
    kept.delete(key);
    kept.set(key, hit);
    return hit;
  }
  const world = new World(seed, world_data(seed, kind));
  kept.set(key, world);
  if (kept.size > KEPT) kept.delete(kept.keys().next().value as string);
  return world;
}

/** A world of any kind: the island's from its cache, another kind's generated (a raceway takes about 150 ms). */
export function world_data(seed: number, kind: WorldKind = WorldKind.ISLAND): WorldData {
  return kind === WorldKind.ISLAND ? island_data(seed) : generate_world(seed, kind);
}

/** What names a seed's world in run keys: the island's bare seed, so keys from before other kinds still match. */
export const place_of = (seed: number, kind: WorldKind = WorldKind.ISLAND) => (kind === WorldKind.ISLAND ? String(seed) : `${kind}:${seed}`);

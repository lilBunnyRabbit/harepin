import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { WorldKind } from "../../src/worldgen/types";
import type { Digest } from "./digest";

const seeds = (n: number) => [...Array(n).keys()];

export const GOLDEN_SEEDS: Record<WorldKind, number[]> = { island: seeds(20), sky: seeds(10), desert: seeds(10), mainland: [] };

/** seed -> part -> hash */
export type Golden = Map<number, Map<string, string>>;

const path = (kind: WorldKind) => new URL(`../golden/${kind}.txt`, import.meta.url);

export function read_golden(kind: WorldKind): Golden {
  const golden: Golden = new Map();
  if (!existsSync(path(kind))) return golden;
  for (const line of readFileSync(path(kind), "utf8").split("\n")) {
    const [seed, part, hash] = line.trim().split(" ");
    if (!hash) continue;
    const parts = golden.get(Number(seed)) ?? new Map<string, string>();
    parts.set(part, hash);
    golden.set(Number(seed), parts);
  }
  return golden;
}

export function write_golden(kind: WorldKind, digests: [number, Digest][]) {
  mkdirSync(new URL(".", path(kind)), { recursive: true });
  writeFileSync(path(kind), digests.flatMap(([seed, digest]) => digest.map(([part, hash]) => `${seed} ${part} ${hash}`)).join("\n") + "\n");
}

/** Parts that differ from the golden ones; `(new)` and `(gone)` mark parts only one side has. */
export function diff_digest(golden: Map<string, string> | undefined, digest: Digest): string[] {
  if (!golden) return ["(no golden)"];
  const now = new Map(digest);
  const changed = digest.filter(([part, hash]) => golden.has(part) && golden.get(part) !== hash).map(([part]) => part);
  const added = digest.filter(([part]) => !golden.has(part)).map(([part]) => `${part} (new)`);
  const gone = [...golden.keys()].filter((part) => !now.has(part)).map((part) => `${part} (gone)`);
  return [...changed, ...added, ...gone];
}

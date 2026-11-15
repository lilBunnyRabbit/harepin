import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { KINDS } from "../../src/worldgen/kinds/kinds";
import { CODE_CHARS } from "../../src/worldgen/kinds/options";
import type { WorldKind } from "../../src/worldgen/types";
import type { Digest } from "./digest";

const seeds = (n: number) => [...Array(n).keys()];

export const GOLDEN_SEEDS: Record<WorldKind, number[]> = { island: seeds(20), sky: seeds(10), desert: seeds(10), mainland: [0, 1, 2], alpine: seeds(10), tundra: seeds(10), volcano: seeds(10), rooftops: seeds(10), dunes: [0, 1, 2], icecanyon: seeds(10), velodrome: seeds(10), lab: [0, 1] };

/** Maps off their kind's normal levels the golden keeps too, each set in its own file: Winter Mainland. */
export interface GoldenMaps {
  kind: WorldKind;
  levels: number[];
  seeds: number[];
}

export const GOLDEN_MAPS: readonly GoldenMaps[] = [{ kind: "mainland", levels: [1], seeds: [0, 1, 2] }];

/** A golden file's name: the kind, plus `-<overrides>` for a map off its normal levels (`mainland-W1`). */
export const golden_name = (kind: WorldKind, opts = "") => (opts ? `${kind}-${opts}` : kind);

/** Levels from an overrides string (`W1`), the inverse of `overrides`; throws on a field or level the kind has no option for. */
export function levels_of(kind: WorldKind, opts: string): number[] {
  const { options } = KINDS[kind];
  const levels = options.map((o) => o.normal);
  for (let i = 0; i < opts.length; i += 2) {
    const at = options.findIndex((o) => o.field === opts[i]);
    const level = CODE_CHARS.indexOf(opts[i + 1] ?? "");
    if (at < 0 || level < 0 || level >= options[at].labels.length) throw new Error(`${kind} has no option ${opts.slice(i, i + 2)}`);
    levels[at] = level;
  }
  return levels;
}

/** seed -> part -> hash */
export type Golden = Map<number, Map<string, string>>;

const path = (name: string) => new URL(`../golden/${name}.txt`, import.meta.url);

export function read_golden(name: string): Golden {
  const golden: Golden = new Map();
  if (!existsSync(path(name))) return golden;
  for (const line of readFileSync(path(name), "utf8").split("\n")) {
    const [seed, part, hash] = line.trim().split(" ");
    if (!hash) continue;
    const parts = golden.get(Number(seed)) ?? new Map<string, string>();
    parts.set(part, hash);
    golden.set(Number(seed), parts);
  }
  return golden;
}

export function write_golden(name: string, digests: [number, Digest][]) {
  mkdirSync(new URL(".", path(name)), { recursive: true });
  writeFileSync(path(name), digests.flatMap(([seed, digest]) => digest.map(([part, hash]) => `${seed} ${part} ${hash}`)).join("\n") + "\n");
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

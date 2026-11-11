import { seed_of } from "../../rng";
import { DEFAULT_KIND, type WorldData, type WorldKind } from "../types";
import { alpine } from "./alpine";
import { desert } from "./desert";
import { island } from "./island";
import type { KindDef } from "./kind-def";
import type { SnowKit } from "../snow";
import { mainland } from "./mainland";
import { in_k2, normal_levels, overrides } from "./options";
import { sky } from "./sky";

export const KINDS: Record<WorldKind, KindDef> = { island, sky, desert, mainland, alpine };

export interface MapSpec {
  kind: WorldKind;
  seed: number;
  /** A level per option of the kind; missing ones are normal. */
  levels: readonly number[];
}

export const plain_map = (kind: WorldKind, seed: number): MapSpec => ({ kind, seed, levels: normal_levels(KINDS[kind].options) });

export function is_plain({ kind, levels }: Pick<MapSpec, "kind" | "levels">): boolean {
  return KINDS[kind].options.every((o, i) => (levels[i] ?? o.normal) === o.normal);
}

/** A custom map's hash rides above the kind's id, so builds that only read the kind still see the kind. */
const HASH_SHIFT = 0x10000;
const HASH_MASK = 0x7fff;

export function world_id(kind: WorldKind): number {
  return KINDS[kind].id;
}

/**
 * Peers compare it as `w`. A plain map is its kind's id, as before map codes; a custom one adds a 15-bit hash of its
 * records key, never 0, so it never equals a plain id and stays under 2^31.
 */
export function map_id(map: MapSpec): number {
  const id = world_id(map.kind);
  if (is_plain(map)) return id;
  return id + ((seed_of(world_key(map.seed, map.kind, map.levels)) & HASH_MASK) || 1) * HASH_SHIFT;
}

/** The kind behind a `world_id` or `map_id`; none, or an id this build doesn't know, is the default. */
export function kind_of_world(id: number | undefined): WorldKind {
  const base = id === undefined ? undefined : id % HASH_SHIFT;
  return Object.values(KINDS).find((def) => def.id === base)?.kind ?? DEFAULT_KIND;
}

/**
 * Records key: plain maps keep today's; a map off only K2 knobs keeps its K2 key, a digit per knob; any slider
 * off normal keys by the code's overrides, which start with a letter so never meet a K2 key.
 */
export function world_key(seed: number, kind: WorldKind = DEFAULT_KIND, levels: readonly number[] = []): string {
  const { options } = KINDS[kind];
  if (is_plain({ kind, levels })) return KINDS[kind].key(seed);
  const k2 = options.every((o, i) => in_k2(o) || (levels[i] ?? o.normal) === o.normal);
  const suffix = k2 ? options.filter(in_k2).map((o) => String(levels[options.indexOf(o)] ?? o.normal)).join("") : overrides(options, levels);
  return KINDS[kind].key(seed, suffix);
}

/** The snow kit a map lays, from its tuned recipe: winter, or a kind that is always snowy; null in summer. */
export function snow_of({ kind, levels }: Pick<MapSpec, "kind" | "levels">): SnowKit | null {
  const def = KINDS[kind];
  return (def.tuned?.(levels) ?? def.recipe)?.snow ?? null;
}

/** Softer builds a custom map gets before it gives up, each with the relief at RELIEF_STEP of the last. */
const RETRIES = 3;
const RELIEF_STEP = 0.85;

export interface Built {
  data: WorldData;
  /** Builds that failed their check before this one. */
  retries: number;
  /** Every build failed: this is the seed's plain map, never another seed's. */
  fallback: boolean;
}

/**
 * A custom map builds with its levels clamped, then checked; a failed check rebuilds with softer relief, the same way
 * on every peer, and past the last retry the seed's plain map stands in. A plain map builds once, as it always has.
 */
export function build_world(seed: number, kind: WorldKind, levels: readonly number[] = []): Built {
  const def = KINDS[kind];
  const full = def.options.map((o, i) => levels[i] ?? o.normal);
  if (is_plain({ kind, levels: full }) || !def.drivable) return { data: def.generate(seed, full), retries: 0, fallback: false };
  const clamped = def.clamp?.(full) ?? full;
  for (let retries = 0, relief = 1; retries <= RETRIES; retries++, relief *= RELIEF_STEP) {
    try {
      const data = def.generate(seed, clamped, relief);
      if (def.drivable(data, clamped)) return { data, retries, fallback: false };
    } catch (error) {
      console.warn(`worldgen: ${kind} ${seed} [${clamped.join(",")}] relief ${relief} threw`, error);
    }
  }
  return { data: def.generate(seed, normal_levels(def.options)), retries: RETRIES + 1, fallback: true };
}

export function generate_world(seed: number, kind: WorldKind, levels: readonly number[] = []): WorldData {
  return build_world(seed, kind, levels).data;
}

import { seed_of } from "../../rng";
import { DEFAULT_KIND, type WorldData, type WorldKind } from "../types";
import { alpine } from "./alpine";
import { desert } from "./desert";
import { island } from "./island";
import type { KindDef } from "./kind-def";
import { mainland } from "./mainland";
import { normal_levels, overrides } from "./options";
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
  const k2 = options.every((o, i) => !o.slider || (levels[i] ?? o.normal) === o.normal);
  const suffix = k2 ? options.filter((o) => !o.slider).map((o) => String(levels[options.indexOf(o)] ?? o.normal)).join("") : overrides(options, levels);
  return KINDS[kind].key(seed, suffix);
}

export function generate_world(seed: number, kind: WorldKind, levels: readonly number[] = []): WorldData {
  const { options } = KINDS[kind];
  return KINDS[kind].generate(seed, options.map((o, i) => levels[i] ?? o.normal));
}

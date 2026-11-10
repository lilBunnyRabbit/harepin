import type { WorldData, WorldKind } from "../types";
import { island } from "./island";
import { sky } from "./sky";

/** Worker-safe half of a world kind: no DOM, no THREE, so `generate` runs in worldgen/worker.ts. */
export interface KindDef {
  kind: WorldKind;
  /** Map identity peers and the directory compare. */
  id: number;
  /** Storage key part for records set on `seed`'s world, so a new world starts with a clean sheet. */
  key(seed: number): string;
  generate(seed: number): WorldData;
  /** Gymkhana, parking and gate hunts need it. */
  open_ground: boolean;
  /** Box solids redirect the car along them instead of bouncing it off. */
  rails: boolean;
}

export const KINDS: Record<WorldKind, KindDef> = { island, sky };

/** What a URL or save without a world, or with one this build doesn't know, drives. */
export const DEFAULT_KIND: WorldKind = island.kind;

export function is_kind(value: unknown): value is WorldKind {
  return typeof value === "string" && Object.hasOwn(KINDS, value);
}

export function world_id(kind: WorldKind): number {
  return KINDS[kind].id;
}

/** The kind behind a `world_id`; none, or an id this build doesn't know, is the default. */
export function kind_of_world(id: number | undefined): WorldKind {
  return Object.values(KINDS).find((def) => def.id === id)?.kind ?? DEFAULT_KIND;
}

export function parse_kind(text: string | null | undefined): WorldKind {
  return is_kind(text) ? text : DEFAULT_KIND;
}

export function world_key(seed: number, kind: WorldKind = DEFAULT_KIND): string {
  return KINDS[kind].key(seed);
}

export function generate_world(seed: number, kind: WorldKind): WorldData {
  return KINDS[kind].generate(seed);
}

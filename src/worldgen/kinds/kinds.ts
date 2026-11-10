import type { WorldData, WorldKind } from "../types";
import { desert } from "./desert";
import { island } from "./island";
import type { KindDef } from "./kind-def";
import { mainland } from "./mainland";
import { sky } from "./sky";

export const KINDS: Record<WorldKind, KindDef> = { island, sky, desert, mainland };

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

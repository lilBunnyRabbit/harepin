import type { WorldData, WorldKind } from "../types";
import { desert } from "./desert";
import { island } from "./island";
import type { KindDef } from "./kind-def";
import { mainland } from "./mainland";
import { normal_levels, opts_code, parse_opts } from "./options";
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

/** `text` as `kind`'s option code: canonical, or empty when it is not one. */
export function clean_opts(kind: WorldKind, text: string | null | undefined): string {
  const { options } = KINDS[kind];
  const levels = parse_opts(options, text ?? "");
  return levels ? opts_code(options, levels) : "";
}

export function levels_of(kind: WorldKind, opts: string): number[] {
  const { options } = KINDS[kind];
  return parse_opts(options, opts) ?? normal_levels(options);
}

export function parse_kind(text: string | null | undefined): WorldKind {
  return is_kind(text) ? text : DEFAULT_KIND;
}

export function world_key(seed: number, kind: WorldKind = DEFAULT_KIND, opts = ""): string {
  return KINDS[kind].key(seed, clean_opts(kind, opts));
}

export function generate_world(seed: number, kind: WorldKind, opts = ""): WorldData {
  return KINDS[kind].generate(seed, levels_of(kind, opts));
}

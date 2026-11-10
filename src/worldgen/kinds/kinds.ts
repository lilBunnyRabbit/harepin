import type { WorldData, WorldKind } from "../types";
import { desert } from "./desert";
import { island } from "./island";
import type { KindDef } from "./kind-def";
import { mainland } from "./mainland";
import { levels_of_number, normal_levels, opts_code, opts_number, parse_opts } from "./options";
import { sky } from "./sky";

export const KINDS: Record<WorldKind, KindDef> = { island, sky, desert, mainland };

/** What a URL or save without a world, or with one this build doesn't know, drives. */
export const DEFAULT_KIND: WorldKind = island.kind;

export function is_kind(value: unknown): value is WorldKind {
  return typeof value === "string" && Object.hasOwn(KINDS, value);
}

/** Options ride above the kind's id, so peers on other options see a foreign map and old builds need no new field. */
const OPTS_UNIT = 0x10000;

export function world_id(kind: WorldKind, opts = ""): number {
  const def = KINDS[kind];
  return def.id + opts_number(def.options, levels_of(kind, opts)) * OPTS_UNIT;
}

/** The kind behind a `world_id`; none, or an id this build doesn't know, is the default. */
export function kind_of_world(id: number | undefined): WorldKind {
  const base = id === undefined ? undefined : id % OPTS_UNIT;
  return Object.values(KINDS).find((def) => def.id === base)?.kind ?? DEFAULT_KIND;
}

/** The option code behind a `world_id`; empty when it carries none this build can read. */
export function opts_of_world(id: number | undefined): string {
  if (id === undefined) return "";
  const { options } = KINDS[kind_of_world(id)];
  const levels = levels_of_number(options, Math.floor(id / OPTS_UNIT));
  return levels ? opts_code(options, levels) : "";
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

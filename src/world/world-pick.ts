import { parse_seed } from "../net/net";
import { seed_of } from "../rng";
import type { WorldKind } from "../worldgen/types";
import { clean_opts, DEFAULT_KIND, KINDS, parse_kind } from "../worldgen/kinds/kinds";
import { parse_opts } from "../worldgen/kinds/options";

export interface WorldPick {
  seed: number;
  kind: WorldKind;
  /** The kind's map option code; empty for the plain map. */
  opts: string;
}

export interface SavedPick {
  last_seed: number | null;
  last_world: WorldKind | null;
  last_opts: string | null;
}

const URL_WORLD_PARAMS = ["room", "seed", "world"];
const CODE_JOIN = "-";

/**
 * The world this load drives. A URL that names a room, seed or world (an invite, a joined server, a room link) wins
 * whole, so a friend's room never opens on your map; a bare URL resumes the last pick; the room's own map comes last.
 */
export function pick_world(params: URLSearchParams, room: string, saved: SavedPick): WorldPick {
  if (URL_WORLD_PARAMS.some((param) => params.has(param))) {
    const kind = parse_kind(params.get("world"));
    return { seed: parse_seed(params.get("seed")) ?? seed_of(room), kind, opts: clean_opts(kind, params.get("opts")) };
  }
  const kind = saved.last_world ?? DEFAULT_KIND;
  return { seed: saved.last_seed ?? seed_of(room), kind, opts: clean_opts(kind, saved.last_opts) };
}

/** URL params that load `seed`'s world in `room`; the default kind and plain options stay out, so old links and new ones match. */
export function world_query(room: string, seed: number, kind: WorldKind, opts = ""): Record<string, string> {
  return { room, seed: String(seed), ...(kind === DEFAULT_KIND ? {} : { world: kind }), ...(opts ? { opts } : {}) };
}

/** The map code players share: the seed, then the option code when there is one. */
export function map_code(seed: number, opts: string): string {
  return opts ? `${seed}${CODE_JOIN}${opts}` : String(seed);
}

/** A typed map code for `kind`; null when the seed or the options are not ones it has. */
export function parse_map_code(text: string, kind: WorldKind): { seed: number; opts: string } | null {
  const [seed_text, opts = "", ...rest] = text.trim().split(CODE_JOIN);
  const seed = parse_seed(seed_text);
  if (seed === null || rest.length || !parse_opts(KINDS[kind].options, opts)) return null;
  return { seed, opts: clean_opts(kind, opts) };
}

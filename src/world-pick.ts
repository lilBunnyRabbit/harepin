import { parse_seed } from "./net/net";
import { seed_of } from "./rng";
import type { WorldKind } from "./worldgen/types";
import { DEFAULT_KIND, parse_kind } from "./worldgen/kinds/kinds";

export interface WorldPick {
  seed: number;
  kind: WorldKind;
}

export interface SavedPick {
  last_seed: number | null;
  last_world: WorldKind | null;
}

const URL_WORLD_PARAMS = ["room", "seed", "world"];

/**
 * The world this load drives. A URL that names a room, seed or world (an invite, a joined server, a room link) wins
 * whole, so a friend's room never opens on your map; a bare URL resumes the last pick; the room's own map comes last.
 */
export function pick_world(params: URLSearchParams, room: string, saved: SavedPick): WorldPick {
  if (URL_WORLD_PARAMS.some((param) => params.has(param))) return { seed: parse_seed(params.get("seed")) ?? seed_of(room), kind: parse_kind(params.get("world")) };
  return { seed: saved.last_seed ?? seed_of(room), kind: saved.last_world ?? DEFAULT_KIND };
}

/** URL params that load `seed`'s world in `room`; the default kind stays out, so old links and new ones match. */
export function world_query(room: string, seed: number, kind: WorldKind): Record<string, string> {
  return { room, seed: String(seed), ...(kind === DEFAULT_KIND ? {} : { world: kind }) };
}

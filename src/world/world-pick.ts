import { parse_seed } from "../net/seed";
import { seed_of } from "../rng";
import { LOBBY_ROOM } from "../net/room-name";
import { DEFAULT_KIND, WorldKind, parse_kind } from "../worldgen/types";

export interface WorldPick {
  seed: number;
  kind: WorldKind;
}

export interface SavedPick {
  last_seed: number | null;
  last_world: WorldKind | null;
  /** Settings were saved before: a player from before the mainland, whose unpicked world was the island. */
  played: boolean;
}

/** What a first load drives, with nothing saved and nothing in the URL. */
export const NEW_PLAYER_KIND: WorldKind = WorldKind.MAINLAND;
/** The mainland a player drives before picking one: the same for everyone, so the open lobby meets there. */
export const MAINLAND_SEED = seed_of(LOBBY_ROOM);

const URL_WORLD_PARAMS = ["room", "seed", "world"];

export const names_world = (params: URLSearchParams) => URL_WORLD_PARAMS.some((param) => params.has(param));

/**
 * The world this load drives. A URL that names a room, seed or world (an invite, a joined server, a room link) wins
 * whole, so a friend's room never opens on your map; a bare URL resumes the last pick; the room's own map comes last.
 */
export function pick_world(params: URLSearchParams, room: string, saved: SavedPick): WorldPick {
  if (names_world(params)) return { seed: parse_seed(params.get("seed")) ?? seed_of(room), kind: parse_kind(params.get("world")) };
  return { seed: saved.last_seed ?? seed_of(room), kind: saved.last_world ?? (saved.played ? DEFAULT_KIND : NEW_PLAYER_KIND) };
}

/** The mainland Play shows and drives: the one being driven, else the last one picked, else everyone's. */
export function mainland_seed(here: WorldPick, saved: number | null): number {
  return here.kind === WorldKind.MAINLAND ? here.seed : (saved ?? MAINLAND_SEED);
}

/** URL params that load `seed`'s world in `room`; the default kind stays out, so old links and new ones match. */
export function world_query(room: string, seed: number, kind: WorldKind): Record<string, string> {
  return { room, seed: String(seed), ...(kind === DEFAULT_KIND ? {} : { world: kind }) };
}

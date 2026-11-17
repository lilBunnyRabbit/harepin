import { EVENT_PARAM, event_of, spot_of, suggested } from "../career/career";
import { parse_seed } from "../net/seed";
import { seed_of } from "../rng";
import { LOBBY_ROOM } from "../net/room-name";
import { DEFAULT_KIND, WorldKind, parse_kind } from "../worldgen/types";
import { replay_of } from "../review/params";
import { RUN_PARAM, run_of } from "../runs/runs";

export interface WorldPick {
  seed: number;
  kind: WorldKind;
  /** A map code that wins over `seed` and `kind` when it reads; unread here, since reading it needs every kind's options, which the boot entry doesn't load. */
  code: string | null;
}

export interface SavedPick {
  last_seed: number | null;
  last_world: WorldKind | null;
  /** The custom map picked with `last_world`, as its code; null for the plain map. */
  last_map: string | null;
  /** Settings were saved before: a player from before the mainland, whose unpicked world was the island. */
  played: boolean;
}

/** What a first load drives, with nothing saved and nothing in the URL: the first flag's map, so the first run ends on a drive to it. */
export const NEW_PLAYER_MAP = spot_of(suggested({}, 1)[0]).map;
/** Circuit index a new player's first load starts at: about 200 m and a bend before the first flag, so the first run's drive and steer steps come before it. */
export const NEW_PLAYER_SPAWN = -100;
/** The mainland Play offers before one is picked: the same for everyone. A new player starts on `NEW_PLAYER_MAP` instead, so the open lobby meets there only once they pick it. */
export const MAINLAND_SEED = seed_of(LOBBY_ROOM);

/** `?lab=<pack>` or `?lab=~<code>`: the feel lab (`src/lab`, docs/lab.md), alone in a solo room; `&map=<code>` for a race trial's world. */
export const LAB_PARAM = "lab";

const URL_WORLD_PARAMS = ["room", "seed", "world", "map", EVENT_PARAM, RUN_PARAM, LAB_PARAM];
const K2_OPTS = /^\d{1,16}$/;

export const names_world = (params: URLSearchParams) => URL_WORLD_PARAMS.some((param) => params.has(param)) || replay_of(params) !== null;

/** Nothing saved and nothing in the URL: a first load. */
export const new_player = (params: URLSearchParams, saved: SavedPick) => !saved.played && !names_world(params);

/**
 * The world this load drives. A URL that names a room, seed or world (an invite, a joined server, a room link) wins
 * whole, so a friend's room never opens on your map; a bare URL resumes the last pick, or with nothing ever saved
 * drives the new player's map; the room's own map comes last.
 */
export function pick_world(params: URLSearchParams, room: string, saved: SavedPick): WorldPick {
  if (names_world(params)) {
    // A lab trial on a race world reloads onto its map with `map` beside `lab`.
    if (params.has(LAB_PARAM)) return { seed: 0, kind: WorldKind.LAB, code: params.get("map") };
    const seed = parse_seed(params.get("seed"));
    const event = event_of(params.get(EVENT_PARAM) ?? replay_of(params));
    const map = params.get("map") ?? (event && spot_of(event).map);
    // A run's map is the plain map of its kind and seed: no code to read before the kinds load.
    const run = map === null ? run_of(params.get(RUN_PARAM)) : null;
    if (run) return { seed: run.seed, kind: run.kind, code: null };
    const opts = params.get("opts");
    // `opts` is the one-day K2 link: its digits ride as a K2 code on the seed and world beside it.
    const code = map !== null ? map : seed !== null && opts !== null && K2_OPTS.test(opts) ? `${seed}-${opts}` : null;
    return { seed: seed ?? seed_of(room), kind: parse_kind(params.get("world")), code };
  }
  if (!saved.played) return { seed: seed_of(room), kind: DEFAULT_KIND, code: NEW_PLAYER_MAP };
  return { seed: saved.last_seed ?? seed_of(room), kind: saved.last_world ?? DEFAULT_KIND, code: saved.last_world === null ? null : saved.last_map };
}

/** The mainland Play shows and drives: the one being driven, else the last one picked, else everyone's. */
export function mainland_seed(here: Pick<WorldPick, "seed" | "kind">, saved: number | null): number {
  return here.kind === WorldKind.MAINLAND ? here.seed : (saved ?? MAINLAND_SEED);
}

/**
 * URL params that load `seed`'s world in `room`; the default kind stays out, so old links and new ones match. `code`
 * is the map code of a custom map, which carries the seed and kind itself.
 */
export function world_query(room: string, seed: number, kind: WorldKind, code: string | null = null): Record<string, string> {
  if (code) return { room, map: code };
  return { room, seed: String(seed), ...(kind === DEFAULT_KIND ? {} : { world: kind }) };
}

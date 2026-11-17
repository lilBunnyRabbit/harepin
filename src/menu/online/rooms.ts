import type { Server } from "../../net/directory";
import type { Player } from "../../net/players";
import { LOBBY_ROOM } from "../../net/room-name";
import { kind_of_world, plain_map } from "../../worldgen/kinds/kinds";
import { name_of } from "../../worlds/map-name";

export const ROOMS_PAGE = "rooms";
export const NEW_ROOM_PAGE = "room";
export const MEET_PAGE = "meet";

export const OTHER_VERSION = "Other version";

export interface RoomGroup {
  key: string;
  game: Server;
  name: string;
  map: string;
  here: boolean;
  racing: boolean;
  /** The announced count: a big room lists only its first players, so it can pass `players.length`. */
  count: number;
  players: Player[];
  more: number;
  blocked: string | null;
}

export interface Totals {
  players: number;
  rooms: number;
  racing: number;
}

export const room_name = (game: Pick<Server, "room">) => (game.room === LOBBY_ROOM ? "Open road" : game.room);

export const map_of = (game: Pick<Server, "world" | "seed">) => name_of(plain_map(kind_of_world(game.world), game.seed));

export const drivers = (count: number) => `${count} ${count === 1 ? "driver" : "drivers"}`;

/** `own_map` names this room's map as loaded: a town map off the name table reads only its kind from an announce. */
export function room_groups(players: readonly Player[], version: string, own_map?: string): RoomGroup[] {
  const groups = new Map<string, RoomGroup>();
  for (const player of players) {
    const { game } = player;
    let group = groups.get(game.key);
    if (!group) {
      group = { key: game.key, game, name: room_name(game), map: (game.here ? own_map : undefined) ?? map_of(game), here: game.here, racing: false, count: game.players, players: [], more: 0, blocked: game.here ? null : game.version === version ? null : OTHER_VERSION };
      groups.set(game.key, group);
    }
    group.players.push(player);
    group.racing ||= player.racing;
  }
  const list = [...groups.values()];
  for (const group of list) {
    group.count = Math.max(group.count, group.players.length);
    group.more = group.count - group.players.length;
  }
  return list.sort((a, b) => Number(b.here) - Number(a.here));
}

export function totals(groups: readonly RoomGroup[]): Totals {
  return { players: groups.reduce((sum, group) => sum + group.count, 0), rooms: groups.length, racing: groups.filter((group) => group.racing).length };
}

export function totals_text({ players, rooms, racing }: Totals): string {
  const parts = [`${players} ${players === 1 ? "player" : "players"}`, `${rooms} ${rooms === 1 ? "room" : "rooms"}`];
  if (racing) parts.push(`${racing} racing`);
  return parts.join(" · ");
}

export function joinable(groups: readonly RoomGroup[]): Player[] {
  return groups.filter((group) => !group.here && group.blocked === null).flatMap((group) => group.players);
}

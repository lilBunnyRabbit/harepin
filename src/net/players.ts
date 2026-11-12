import type { Announce, Server } from "./directory";
import type { Tier } from "./net";

const GOOD_PING_MS = 100;
const OK_PING_MS = 250;

export const PingClass = {
  GOOD: "good",
  OK: "ok",
  BAD: "bad",
  NONE: "none",
} as const;
export type PingClass = (typeof PingClass)[keyof typeof PingClass];

export interface Player {
  key: string;
  name: string;
  country: string | null;
  tier: Tier | null;
  racing: boolean;
  /** Round trip to the game's announcer in ms; null for this game or while not linked to it. */
  ping: number | null;
  you: boolean;
  game: Server;
}

export function ping_class(ms: number | null): PingClass {
  if (ms === null) return PingClass.NONE;
  return ms < GOOD_PING_MS ? PingClass.GOOD : ms < OK_PING_MS ? PingClass.OK : PingClass.BAD;
}

// This game's row comes from whoever announces it, but its roster comes from this player, who is always first in it.
export function player_list(games: readonly Server[], pings: ReadonlyMap<string, number>, own: Announce | null): Player[] {
  const players: Player[] = [];
  for (const game of games) {
    const roster = (game.here ? own?.roster : game.roster) ?? [{ name: game.host }];
    const ping = game.here ? null : (pings.get(game.peer) ?? null);
    roster.forEach((entry, i) =>
      players.push({ key: `${game.key}#${i}`, name: entry.name, country: entry.country ?? null, tier: entry.tier ?? null, racing: entry.racing ?? game.racing ?? false, ping, you: game.here && i === 0, game }),
    );
  }
  return players;
}

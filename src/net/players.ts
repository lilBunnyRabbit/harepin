import type { Announce } from "./directory";
import { WorldKind } from "../worldgen/types";
import { world_id } from "../worldgen/kinds/kinds";

const GOOD_PING_MS = 100;
const OK_PING_MS = 250;

export const PingClass = {
  GOOD: "good",
  OK: "ok",
  BAD: "bad",
  NONE: "none",
} as const;
export type PingClass = (typeof PingClass)[keyof typeof PingClass];

export interface Player extends Announce {
  id: string;
  /** Round trip in ms; null while not linked to that player. */
  ping: number | null;
  here: boolean;
  you: boolean;
}

export function ping_class(ms: number | null): PingClass {
  if (ms === null) return PingClass.NONE;
  return ms < GOOD_PING_MS ? PingClass.GOOD : ms < OK_PING_MS ? PingClass.OK : PingClass.BAD;
}

const world_of = (a: Announce) => a.world ?? world_id(WorldKind.ISLAND);

export function same_place(a: Announce, b: Announce): boolean {
  return a.room === b.room && a.seed === b.seed && world_of(a) === world_of(b);
}

export function player_list(entries: Iterable<readonly [string, Announce]>, pings: ReadonlyMap<string, number>, own: Announce | null): Player[] {
  const players: Player[] = [];
  for (const [id, a] of entries) players.push({ ...a, id, ping: pings.get(id) ?? null, here: own !== null && same_place(a, own), you: false });
  players.sort((a, b) => Number(b.here) - Number(a.here) || a.host.localeCompare(b.host) || a.id.localeCompare(b.id));
  if (own) players.unshift({ ...own, id: "", ping: null, here: true, you: true });
  return players;
}

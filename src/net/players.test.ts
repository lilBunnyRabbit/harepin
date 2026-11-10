/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Announce, Server } from "./directory";
import { PingClass, ping_class, player_list } from "./players";

const base: Announce = { room: "lobby", seed: 7, host: "Leader", players: 2, locked: false, version: "1.0.0" };
const game = (over: Partial<Server>): Server => ({ ...base, key: "k", here: false, peer: "p", ...over });

test("ping classes: good under 100 ms, ok under 250, none when not linked", () => {
  expect(ping_class(null)).toBe(PingClass.NONE);
  expect(ping_class(40)).toBe(PingClass.GOOD);
  expect(ping_class(100)).toBe(PingClass.OK);
  expect(ping_class(249)).toBe(PingClass.OK);
  expect(ping_class(250)).toBe(PingClass.BAD);
});

test("one row per roster entry, each carrying its game's announcer ping; this game's roster is this player's own", () => {
  const own: Announce = { ...base, roster: [{ name: "Me", country: "SI" }, { name: "Pal" }] };
  const list = player_list(
    [
      game({ key: "here", here: true, peer: "", roster: [{ name: "Leader" }, { name: "Me" }] }),
      game({ key: "den", peer: "d", room: "den", racing: true, roster: [{ name: "Ann", country: "US" }, { name: "Bo", racing: false }] }),
      game({ key: "old", peer: "o", host: "Oldie" }),
    ],
    new Map([["d", 42]]),
    own,
  );
  expect(list.map((p) => [p.key, p.name, p.country, p.racing, p.ping, p.you])).toEqual([
    ["here#0", "Me", "SI", false, null, true],
    ["here#1", "Pal", null, false, null, false],
    ["den#0", "Ann", "US", true, 42, false],
    ["den#1", "Bo", null, false, 42, false],
    ["old#0", "Oldie", null, false, null, false],
  ]);
});

/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Announce } from "./directory";
import { WorldKind } from "../worldgen/types";
import { world_id } from "../worldgen/kinds/kinds";
import { PingClass, ping_class, player_list, same_place } from "./players";

const base: Announce = { room: "lobby", seed: 7, host: "Me", players: 1, locked: false, version: "1.0.0", world: world_id(WorldKind.ISLAND) };

test("ping classes: good under 100 ms, ok under 250, none when not linked", () => {
  expect(ping_class(null)).toBe(PingClass.NONE);
  expect(ping_class(40)).toBe(PingClass.GOOD);
  expect(ping_class(100)).toBe(PingClass.OK);
  expect(ping_class(249)).toBe(PingClass.OK);
  expect(ping_class(250)).toBe(PingClass.BAD);
});

test("same place: room, map and world all match; no world means the island", () => {
  expect(same_place(base, { ...base, host: "Other" })).toBe(true);
  expect(same_place(base, { ...base, seed: 8 })).toBe(false);
  expect(same_place(base, { ...base, room: "x" })).toBe(false);
  expect(same_place({ ...base, world: undefined }, base)).toBe(true);
});

test("players: you first, then players here, then by name, each with its ping", () => {
  const list = player_list(
    [
      ["c", { ...base, host: "Cleo", seed: 9 }],
      ["b", { ...base, host: "Bob", room: "den", locked: true }],
      ["a", { ...base, host: "Zed" }],
    ],
    new Map([["c", 42]]),
    base,
  );
  expect(list.map((p) => [p.id, p.host, p.here, p.you, p.ping])).toEqual([
    ["", "Me", true, true, null],
    ["a", "Zed", true, false, null],
    ["b", "Bob", false, false, null],
    ["c", "Cleo", false, false, 42],
  ]);
});

test("players without an own announce list only the others", () => {
  expect(player_list([["a", base]], new Map(), null).map((p) => p.you)).toEqual([false]);
});

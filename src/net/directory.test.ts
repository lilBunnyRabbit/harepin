/// <reference types="bun" />
import { expect, test } from "bun:test";
import { WorldKind } from "../worldgen/types";
import { kind_of_world, world_id } from "../worldgen/kinds/kinds";
import { Admission, clean_password, locked_name, group_servers, sanitize_announce, type Announce } from "./directory";
import { DIRECTORY_ROOM, clean_room } from "./room-name";

const announce: Announce = { room: "lobby", seed: 42, host: "Alice", players: 2, locked: false, version: "0.5.1" };

test("room names: trimmed, 32 code points, no control characters, never the directory", () => {
  expect(clean_room("  my room ")).toBe("my room");
  expect(clean_room("🐰".repeat(32))).toBe("🐰".repeat(32));
  expect(clean_room("x".repeat(33))).toBeNull();
  expect(clean_room("a\u0000b")).toBeNull();
  expect(clean_room("a‮b")).toBeNull();
  expect(clean_room(" ")).toBeNull();
  expect(clean_room(DIRECTORY_ROOM)).toBeNull();
  expect(clean_room(7)).toBeNull();
});

test("passwords: kept exactly, capped, no control characters", () => {
  expect(clean_password(" s3cret ")).toBe(" s3cret ");
  expect(clean_password("")).toBeNull();
  expect(clean_password("x".repeat(65))).toBeNull();
  expect(clean_password("a\nb")).toBeNull();
});

test("announces are shape-checked, names cleaned, players capped, extras dropped", () => {
  expect(sanitize_announce({ ...announce, extra: "x".repeat(1000) })).toEqual(announce);
  expect(sanitize_announce({ ...announce, host: "  Bob‮ (you)" })?.host).toBe("Bob");
  expect(sanitize_announce({ ...announce, players: 9000 })?.players).toBe(64);
  expect(sanitize_announce({ ...announce, room: " lobby" })).toBeNull();
  expect(sanitize_announce({ ...announce, room: "x".repeat(40) })).toBeNull();
  expect(sanitize_announce({ ...announce, seed: -1 })).toBeNull();
  expect(sanitize_announce({ ...announce, seed: 2 ** 32 })).toBeNull();
  expect(sanitize_announce({ ...announce, seed: 1.5 })).toBeNull();
  expect(sanitize_announce({ ...announce, players: 0 })).toBeNull();
  expect(sanitize_announce({ ...announce, locked: "yes" })).toBeNull();
  expect(sanitize_announce({ ...announce, version: "<script>" })).toBeNull();
  expect(sanitize_announce({ ...announce, password: "leak" })).not.toHaveProperty("password");
  expect(sanitize_announce("lobby")).toBeNull();
});

test("one row per game: the lowest id's announce wins whole, this game always listed and first", () => {
  const own = { ...announce, room: "mine", seed: 1, host: "Me", players: 1 };
  const servers = group_servers(
    [
      ["c", { ...announce, host: "Cleo", players: 3 }],
      ["b", { ...announce, host: "Bob", players: 2 }],
      ["z", { ...announce, room: "other", host: "Zed", players: 5 }],
      ["d", { ...announce, locked: true, host: "Dan" }],
    ],
    own,
  );
  expect(servers.map((s) => [s.room, s.host, s.players, s.here, s.locked])).toEqual([
    ["mine", "Me", 1, true, false],
    ["other", "Zed", 5, false, false],
    ["lobby", "Bob", 2, false, false],
    ["lobby", "Dan", 2, false, true],
  ]);
});

test("this game's row comes from its elected announcer when one is heard", () => {
  const servers = group_servers([["a", { ...announce, host: "Leader", players: 3 }]], { ...announce, host: "Me", players: 3 });
  expect(servers.map((s) => [s.host, s.here])).toEqual([["Leader", true]]);
});

test("the world kind travels with the announce and splits an island game from a sky game on the same seed", () => {
  const sky = world_id(WorldKind.SKY);
  const island = world_id(WorldKind.ISLAND);
  expect(sanitize_announce({ ...announce, world: sky })?.world).toBe(sky);
  expect(sanitize_announce(announce)).not.toHaveProperty("world");
  expect(sanitize_announce({ ...announce, world: 1.5 })).toBeNull();
  expect(sanitize_announce({ ...announce, world: "sky" })).toBeNull();
  expect(sanitize_announce({ ...announce, world: 0 })).toBeNull();
  const servers = group_servers(
    [
      ["a", { ...announce, host: "Old" }],
      ["b", { ...announce, host: "Island", world: island }],
      ["c", { ...announce, host: "Sky", world: sky }],
    ],
    null,
  );
  expect(servers.map((s) => [s.host, kind_of_world(s.world)])).toEqual([
    ["Old", WorldKind.ISLAND],
    ["Sky", WorldKind.SKY],
  ]);
});

test("locked names end in a code; an unlocked game under one is a visitor and is not listed", () => {
  const name = locked_name("x".repeat(40));
  expect(name).toMatch(/^x{27}~[0-9a-z]{4}$/);
  expect(clean_room(name)).toBe(name);
  expect(sanitize_announce({ ...announce, room: name, locked: true })?.room).toBe(name);
  expect(sanitize_announce({ ...announce, room: name, locked: false })).toBeNull();
  expect(sanitize_announce({ ...announce, room: "race-2024", locked: false })?.room).toBe("race-2024");
});

test("admission: a handshake burst stops at the cap, refused peers stay refused until the room is left", () => {
  const admission = new Admission(3);
  expect(["a", "b", "c", "d", "e"].map((id) => admission.admit(id))).toEqual([true, true, true, false, false]);
  admission.join("a");
  admission.drop("b");
  expect(admission.admit("d")).toBe(false);
  expect(admission.admit("f")).toBe(true);
  expect(admission.admit("g")).toBe(false);
  admission.reset();
  expect(admission.admit("e")).toBe(true);
  expect(admission.admit("h")).toBe(true);
});

test("announces keep a racing flag and a capped, cleaned roster", () => {
  const roster = [{ name: " Ann ", country: "SI", racing: true }, { name: "Bo", country: "ZZ" }, { name: 5 }, "x"];
  expect(sanitize_announce({ ...announce, racing: true, roster })).toEqual({ ...announce, racing: true, roster: [{ name: "Ann", country: "SI", racing: true }, { name: "Bo" }] });
  expect(sanitize_announce({ ...announce, racing: "yes", roster: "Ann" })).toEqual(announce);
  expect(sanitize_announce({ ...announce, roster: [] })).toEqual(announce);
  expect(sanitize_announce({ ...announce, roster: Array.from({ length: 40 }, (_, i) => ({ name: `P${i}` })) })?.roster).toHaveLength(16);
});

test("admission: past 24 links, watchers make room for browsers and never take more than their share", () => {
  const evicted: string[] = [];
  const admission = new Admission(24, 16, (id) => evicted.push(id));
  const games = Array.from({ length: 30 }, (_, i) => `game-${String(i).padStart(2, "0")}`);
  for (const id of games.slice(0, 20)) {
    expect(admission.admit(id)).toBe(true);
    admission.join(id);
    admission.role(id, true);
  }
  expect(evicted).toEqual(games.slice(16, 20));
  for (const id of games.slice(20, 28)) {
    expect(admission.admit(id)).toBe(true);
    admission.join(id);
  }
  expect(admission.joined.size).toBe(24);
  expect(admission.admit("browser")).toBe(true);
  expect(evicted.at(-1)).toBe(games[0]);
  expect(admission.admit(games[0])).toBe(false);
  admission.join("browser");
  for (const id of games.slice(1, 16)) admission.role(id, false);
  expect(admission.admit("late")).toBe(false);
  expect(admission.joined.size).toBe(24);
});

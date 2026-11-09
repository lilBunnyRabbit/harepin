/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DIRECTORY_ROOM, clean_password, clean_room, group_servers, sanitize_announce, type Announce } from "./directory";

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

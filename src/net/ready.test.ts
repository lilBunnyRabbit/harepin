/// <reference types="bun" />
import { expect, test } from "bun:test";
import { READY_TTL_MS, ReadySet } from "./ready";

const CALL = { laps: 3, route: "circuit" };

test("everyone is ready only when this player and every present peer are", () => {
  const set = new ReadySet();
  expect(set.everyone(null, [], 0)).toBe(false);
  expect(set.everyone(CALL, [], 0)).toBe(true);
  set.hear("a", "Ana", { ready: true, laps: 1, route: "circuit" }, 0);
  expect(set.everyone(CALL, ["a", "b"], 0)).toBe(false);
  set.hear("b", "Bo", { ready: true, laps: 1, route: "circuit" }, 0);
  expect(set.everyone(CALL, ["a", "b"], 0)).toBe(true);
  expect(set.everyone(null, ["a", "b"], 0)).toBe(false);
});

test("un-readying or going quiet past the TTL drops a peer; leaving the map stops it counting", () => {
  const set = new ReadySet();
  set.hear("a", "Ana", { ready: true, ...CALL }, 0);
  set.hear("b", "Bo", { ready: true, ...CALL }, 0);
  set.hear("b", "Bo", { ready: false }, 10);
  expect(set.everyone(CALL, ["a", "b"], 10)).toBe(false);
  expect(set.everyone(CALL, ["a"], 10)).toBe(true);
  expect(set.everyone(CALL, ["a"], READY_TTL_MS + 1)).toBe(false);
  set.hear("a", "Ana", { ready: true, ...CALL }, READY_TTL_MS + 1);
  expect(set.everyone(CALL, ["a"], READY_TTL_MS + 1)).toBe(true);
  set.clear();
  expect(set.everyone(CALL, ["a"], READY_TTL_MS + 1)).toBe(false);
});

test("status counts present players, names the ready ones and shows the leader's call", () => {
  const set = new ReadySet();
  set.hear("a", "Ana", { ready: true, laps: 2, route: "street-1" }, 0);
  set.hear("gone", "Gone", { ready: true, ...CALL }, 0);
  expect(set.status(CALL, ["a", "z"], "a", "m", 0)).toEqual({ names: ["you", "Ana"], total: 3, next: { laps: 2, route: "street-1" } });
  expect(set.status(null, ["a", "z"], "a", "m", READY_TTL_MS + 1)).toEqual({ names: [], total: 3, next: null });
  expect(set.status(CALL, ["z"], "m", "m", 0)).toEqual({ names: ["you"], total: 2, next: CALL });
});

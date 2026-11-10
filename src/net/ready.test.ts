/// <reference types="bun" />
import { expect, test } from "bun:test";
import { READY_BURST, READY_GAP_MS, READY_RESEND_MS, READY_TTL_MS, ReadySet } from "./ready";
import { RateLimit } from "./rate-limit";

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
  const name_of = (id: string) => id.toUpperCase();
  expect(set.status(CALL, ["a", "z"], name_of, "a", "m", 0, false)).toEqual({ names: ["you", "Ana"], waiting: ["Z"], total: 3, next: { laps: 2, route: "street-1" }, electing: false });
  expect(set.status(null, ["a", "z"], name_of, "a", "m", READY_TTL_MS + 1, true)).toEqual({ names: [], waiting: ["you", "A", "Z"], total: 3, next: null, electing: true });
  expect(set.status(CALL, ["z"], name_of, "m", "m", 0, false)).toEqual({ names: ["you"], waiting: ["Z"], total: 2, next: CALL, electing: false });
});

test("the receiver's limit keeps a cancel bunched right behind a beat, and a steady beat with toggles", () => {
  const limit = new RateLimit(READY_GAP_MS, READY_BURST);
  expect(limit.allow(0)).toBe(true);
  expect(limit.allow(READY_RESEND_MS)).toBe(true);
  expect(limit.allow(READY_RESEND_MS + READY_GAP_MS)).toBe(true);
  const sends = [];
  for (let t = 2 * READY_RESEND_MS; t < 10_000; t += READY_RESEND_MS) sends.push(limit.allow(t), limit.allow(t + 300), limit.allow(t + 600));
  expect(sends.filter((ok) => !ok).length).toBe(0);
});

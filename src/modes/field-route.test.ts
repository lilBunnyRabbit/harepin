import { expect, test } from "bun:test";
import { RouteKind, type Route } from "../worldgen/types";
import { field_races, STREAMED_FIELD_REACH } from "./field-route";

const loop = (radius: number, closed = true): Route => ({
  id: "loop",
  kind: RouteKind.CIRCUIT,
  closed,
  points: Array.from({ length: 16 }, (_, i) => ({ x: radius * Math.cos((i / 16) * Math.PI * 2), y: 0, z: radius * Math.sin((i / 16) * Math.PI * 2), tx: 0, tz: 1 })),
  checkpoints: [],
  gate_hw: 6,
  road: [{ from: 0, half: 6 }],
  length: 0,
  par_ms: 0,
  closure: [],
});

test("a field races any closed route off rails; on a streamed world only one that stays within reach of its start", () => {
  const ring = loop(STREAMED_FIELD_REACH);
  expect(field_races(ring, false, false)).toBe(true);
  expect(field_races(ring, false, true)).toBe(false);
  expect(field_races(loop(100, false), false, false)).toBe(false);
  expect(field_races(loop(STREAMED_FIELD_REACH / 2), true, false)).toBe(true);
  expect(field_races(ring, true, false)).toBe(false);
});

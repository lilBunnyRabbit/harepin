/// <reference types="bun" />
import { expect, test } from "bun:test";
import { RateLimit, parse_seed, sanitize_chat, sanitize_event } from "./net";

test("chat text is stripped of control characters, trimmed and capped", () => {
  expect(sanitize_chat({ text: "  hi\u0000​ there\n ", t: 1 })).toEqual({ text: "hi there", t: 1 });
  expect(sanitize_chat({ text: "x".repeat(300), t: 1 })?.text.length).toBe(140);
  expect([...(sanitize_chat({ text: "🐰".repeat(200), t: 1 })?.text ?? "")].length).toBe(140);
});

test("bad chat payloads are dropped", () => {
  expect(sanitize_chat({ text: " \u0007 ", t: 1 })).toBeNull();
  expect(sanitize_chat({ text: 5, t: 1 })).toBeNull();
  expect(sanitize_chat({ text: "hi", t: Number.NaN })).toBeNull();
  expect(sanitize_chat("hi")).toBeNull();
});

test("rate limit: one per 800 ms, five per 10 s", () => {
  const limit = new RateLimit();
  expect(limit.allow(0)).toBe(true);
  expect(limit.allow(500)).toBe(false);
  expect([900, 1800, 2700, 3600].map((t) => limit.allow(t))).toEqual([true, true, true, true]);
  expect(limit.allow(4500)).toBe(false);
  expect(limit.allow(10_000)).toBe(true);
});

test("seed param: uint32 digits only", () => {
  expect(parse_seed("42")).toBe(42);
  expect(parse_seed("4294967295")).toBe(4294967295);
  expect(parse_seed("4294967296")).toBeNull();
  expect(parse_seed("-1")).toBeNull();
  expect(parse_seed("1e3")).toBeNull();
  expect(parse_seed(null)).toBeNull();
});

test("race events are shape-checked", () => {
  expect(sanitize_event({ kind: "start", race: 7, laps: 3, start_at: 1000, extra: "x" })).toEqual({ kind: "start", race: 7, laps: 3, start_at: 1000 });
  expect(sanitize_event({ kind: "request", laps: 0 })).toBeNull();
  expect(sanitize_event({ kind: "request", laps: 11 })).toBeNull();
  expect(sanitize_event({ kind: "finish", race: 7, time: -5 })).toBeNull();
  expect(sanitize_event({ kind: "boom" })).toBeNull();
});

import { expect, test } from "bun:test";
import { RateLimit, sanitize_chat } from "./net";

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

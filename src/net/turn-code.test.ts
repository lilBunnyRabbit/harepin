/// <reference types="bun" />
import { expect, test } from "bun:test";
import { decode_turn, encode_turn } from "./turn-code";

test("relay login survives the round trip and never shows in plain text", () => {
  const code = encode_turn("user-123", "pa/ss+word=");
  expect(code).not.toContain("user-123");
  expect(atob(code)).not.toContain("pa/ss+word=");
  expect(decode_turn(code)).toEqual({ username: "user-123", credential: "pa/ss+word=" });
});

test("missing or broken values mean no relay", () => {
  expect(encode_turn(undefined, "x")).toBe("");
  expect(encode_turn("x", "")).toBe("");
  expect(decode_turn("")).toBeNull();
  expect(decode_turn("not base64!")).toBeNull();
  expect(decode_turn(btoa("[1,2]"))).toBeNull();
});

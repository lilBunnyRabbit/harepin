/// <reference types="bun" />
import { expect, test } from "bun:test";
import { PROTOCOL, RateLimit, WRONG_PASSWORD, make_hello, same_map, clean_name, is_sdp_failure, leader_of, join_error_status, read_car, sanitize_chat, sanitize_event, sanitize_hello, sanitize_online, sanitize_ready, type CarState } from "./net";
import { encode_car } from "./car-packet";
import { parse_seed } from "./seed";

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
  expect(sanitize_event({ kind: "start", race: 7, laps: 3, start_at: 1000, extra: "x" })).toEqual({ kind: "start", race: 7, laps: 3, start_at: 1000, route: "circuit" });
  expect(sanitize_event({ kind: "start", race: 7, laps: 1, start_at: 1000, route: "street-1" })).toEqual({ kind: "start", race: 7, laps: 1, start_at: 1000, route: "street-1" });
  expect(sanitize_event({ kind: "request", laps: 1 })).toEqual({ kind: "request", laps: 1, route: "circuit" });
  expect(sanitize_event({ kind: "request", laps: 1, route: "<b>" })).toBeNull();
  expect(sanitize_event({ kind: "request", laps: 1, route: 3 })).toBeNull();
  expect(sanitize_event({ kind: "request", laps: 0 })).toBeNull();
  expect(sanitize_event({ kind: "request", laps: 11 })).toBeNull();
  expect(sanitize_event({ kind: "finish", race: 7, time: -5 })).toBeNull();
  expect(sanitize_event({ kind: "boom" })).toBeNull();
});

test("names: control/bidi/zero-width stripped, spaces collapsed, no (you), fallback", () => {
  expect(clean_name("  Bad‮​Bunny   two ")).toBe("BadBunny two");
  expect(clean_name("Alice (you) (YOU)")).toBe("Alice");
  expect(clean_name("​ ")).toBe("Player");
  expect(clean_name(42)).toBe("Player");
  expect([...clean_name("🐰".repeat(40))].length).toBe(24);
});

test("own chat limit is stricter than what peers accept", () => {
  const own = new RateLimit(900, 4);
  expect([0, 900, 1800, 2700, 3600].map((t) => own.allow(t))).toEqual([true, true, true, true, false]);
});

test("car packets: binary decoded with a clean name; anything else is unreadable", () => {
  const state = { id: "me", name: "Bad‮Bunny (you)", paint: 3, seed: 1, w: 1, t: 1, p: [0, 0, 0], q: [0, 0, 0, 1], v: [0, 0, 0], steer: 0, brake: false, best: null } satisfies CarState;
  const read = read_car(encode_car(state), "x");
  expect(read?.kind === "car" && read.state.name).toBe("BadBunny");
  expect(read_car(state, "x")).toEqual({ kind: "unreadable" });
  expect(read_car(new Uint8Array(3), "x")).toEqual({ kind: "unreadable" });
  expect(read_car(undefined, "x")).toBeNull();
});

const decrypt = "incorrect room password when decrypting offer";
const timeout = "handshake timed out after 10000ms";

test("wrong password: only your own guess, before you ever got in, on a password error", () => {
  const guess = { password: "x", asked: true };
  const host = { password: "x", asked: false };
  expect(join_error_status(guess, false, 0, decrypt)).toBe(WRONG_PASSWORD);
  expect(join_error_status(guess, false, 0, "incorrect password for overlapping room")).toBe(WRONG_PASSWORD);
  expect(join_error_status(guess, false, 0, timeout)).toBeNull();
  expect(join_error_status(guess, true, 0, decrypt)).toBeNull();
  expect(join_error_status(host, false, 0, decrypt)).not.toBe(WRONG_PASSWORD);
  expect(join_error_status(host, false, 0, timeout)).toBeNull();
  expect(join_error_status(null, false, 0, decrypt)).toBeNull();
});

test("leader: lowest id among this player and its same-map peers", () => {
  expect(leader_of("m", ["n", "z"])).toBe("m");
  expect(leader_of("m", ["b", "z"])).toBe("b");
  expect(leader_of("m", [])).toBe("m");
});

test("hello: whole protocol, semver version, real world and uint32 seed", () => {
  const hello = { protocol: 1, version: "0.11.0", world: 2, seed: 42 };
  expect(sanitize_hello({ ...hello, extra: "x" })).toEqual(hello);
  expect(sanitize_hello({ ...hello, country: "SI" })).toEqual({ ...hello, country: "SI" });
  expect(sanitize_hello({ ...hello, country: "<b>" })).toEqual(hello);
  expect(sanitize_hello({ ...hello, protocol: 1.5 })).toBeNull();
  expect(sanitize_hello({ ...hello, protocol: -1 })).toBeNull();
  expect(sanitize_hello({ ...hello, version: "v0.11" })).toBeNull();
  expect(sanitize_hello({ ...hello, version: "0.11.0<b>" })).toBeNull();
  expect(sanitize_hello({ ...hello, world: 0 })).toBeNull();
  expect(sanitize_hello({ ...hello, seed: 2 ** 32 })).toBeNull();
  expect(sanitize_hello("hi")).toBeNull();
});

test("ready messages are shape-checked", () => {
  expect(sanitize_ready({ ready: true, laps: 3, route: "street-1", extra: 1 })).toEqual({ ready: true, laps: 3, route: "street-1" });
  expect(sanitize_ready({ ready: true, laps: 2 })).toEqual({ ready: true, laps: 2, route: "circuit" });
  expect(sanitize_ready({ ready: false, laps: "x" })).toEqual({ ready: false });
  expect(sanitize_ready({ ready: true, laps: 0 })).toBeNull();
  expect(sanitize_ready({ ready: true, laps: 99 })).toBeNull();
  expect(sanitize_ready({ ready: true, laps: 1, route: "Bad Route" })).toBeNull();
  expect(sanitize_ready({ ready: "yes" })).toBeNull();
  expect(sanitize_ready(null)).toBeNull();
});

test("failed SDP exchanges are told apart, with and without TURN servers, and never read as a password", () => {
  const plain = "could not connect to peer abc after exchanging SDP; configure TURN servers with turnConfig or rtcConfig.iceServers";
  const turn = "could not connect to peer abc after exchanging SDP; check that your TURN server URLs and credentials are reachable by both peers";
  expect([plain, turn].map(is_sdp_failure)).toEqual([true, true]);
  expect(is_sdp_failure("incorrect room password when decrypting offer")).toBe(false);
  expect(join_error_status({ password: "x", asked: true }, false, 0, plain)).toBeNull();
});

test("online count: a positive whole number, capped", () => {
  expect(sanitize_online({ online: 7 })).toEqual({ online: 7 });
  expect(sanitize_online({ online: 1e9 })).toEqual({ online: 9999 });
  for (const raw of [null, 3, {}, { online: 0 }, { online: -2 }, { online: 2.5 }, { online: "7" }, { online: Number.NaN }]) expect(sanitize_online(raw)).toBeNull();
});

test("a plain map's hello is byte-identical to the hello before map codes", () => {
  expect(JSON.stringify(make_hello("0.11.0", 7, 42, null, null))).toBe(`{"protocol":${PROTOCOL},"version":"0.11.0","world":7,"seed":42}`);
  expect(JSON.stringify(make_hello("0.11.0", 7, 42, null, "SI"))).toBe(`{"protocol":${PROTOCOL},"version":"0.11.0","world":7,"seed":42,"country":"SI"}`);
  expect(make_hello("0.11.0", 7 + 0x10000, 42, "1C000001A-E2", null).map).toBe("1C000001A-E2");
});

test("hello: a map code is kept only as a custom map's canonical code", () => {
  const hello = { protocol: 2, version: "0.11.0", world: 7 + 0x10000, seed: 42 };
  expect(sanitize_hello({ ...hello, map: "1C000001A-E2" })).toEqual({ ...hello, map: "1C000001A-E2" });
  for (const map of ["1C000001A", "1c000001a-e2", "1C000001A-E2E0", "1Z000001A-E2", "x".repeat(200), 7]) expect(sanitize_hello({ ...hello, map })).toEqual(hello);
});

test("same map: seed and w, then the codes when both named one", () => {
  const own = { seed: 42, world: 7 + 3 * 0x10000, map: "1C000001A-E2" };
  expect(same_map(own, { seed: 42, w: own.world, map: own.map })).toBe(true);
  expect(same_map(own, { seed: 42, w: own.world })).toBe(true);
  expect(same_map(own, { seed: 42, w: own.world, map: "1C000001A-E0" })).toBe(false);
  expect(same_map(own, { seed: 43, w: own.world, map: own.map })).toBe(false);
  expect(same_map(own, { seed: 42, w: 7 })).toBe(false);
  expect(same_map({ seed: 42, world: 7, map: null }, { seed: 42, w: 7 })).toBe(true);
});

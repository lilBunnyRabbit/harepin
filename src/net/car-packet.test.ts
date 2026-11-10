/// <reference types="bun" />
import { expect, test } from "bun:test";
import { CAR_HEADER, WORLD_LIMIT, decode_car, encode_car } from "./car-packet";
import type { CarState } from "./net";

const state: CarState = {
  id: "me",
  name: "Bunny 🐰",
  paint: 3,
  b: "rally.5.2.2.0.1",
  seed: 0xfffffffe,
  w: 2,
  t: 123456.789,
  p: [-4321.123, 17.25, 999.5],
  q: [0.1, -0.7, 0.2, 0.677],
  v: [-42.3, 0.5, 311.1],
  steer: -0.43,
  brake: true,
  boost: false,
  best: 83456.789,
};

const bytes_of = (s: CarState) => encode_car(s);
const with_byte = (bytes: Uint8Array, set: (view: DataView) => void) => {
  const copy = bytes.slice();
  set(new DataView(copy.buffer));
  return copy;
};

test("round trip: exact where it matters, quantized within what interpolation can show", () => {
  const out = decode_car(bytes_of(state), "peer");
  if (!out) throw new Error("decode failed");
  expect(out.id).toBe("peer");
  expect(out.name).toBe(state.name);
  expect(out.b).toBe(state.b);
  expect([out.paint, out.seed, out.w, out.t, out.best, out.brake, out.boost]).toEqual([3, 0xfffffffe, 2, state.t, state.best, true, false]);
  out.p.forEach((x, i) => expect(Math.abs(x - state.p[i])).toBeLessThan(5e-4));
  const length = Math.hypot(...state.q);
  out.q.forEach((x, i) => expect(Math.abs(x - state.q[i] / length)).toBeLessThan(1e-4));
  expect(Math.hypot(...out.q)).toBeCloseTo(1, 12);
  out.v.forEach((x, i) => expect(Math.abs(x - state.v[i])).toBeLessThanOrEqual(1 / 128));
  expect(Math.abs(out.steer - state.steer)).toBeLessThanOrEqual(1 / 254);
});

test("exact byte length: fixed header plus the name and build as sent", () => {
  const name = new TextEncoder().encode(state.name).length;
  expect(bytes_of(state).length).toBe(CAR_HEADER + 2 + name + state.b!.length);
  expect(bytes_of({ ...state, name: "A", b: undefined }).length).toBe(CAR_HEADER + 3);
  expect(bytes_of({ ...state, name: "Player", b: "coupe.3.1.2.1.0" }).length).toBe(77);
});

test("no build, no best, flags off", () => {
  const out = decode_car(bytes_of({ ...state, b: undefined, best: null, brake: false, boost: true }), "x");
  expect(out?.b).toBeUndefined();
  expect(out?.best).toBeNull();
  expect([out?.brake, out?.boost]).toEqual([false, true]);
});

test("build code: valid kept, unknown left out", () => {
  expect(decode_car(bytes_of({ ...state, b: "tank.1.0.0.0.0" }), "x")?.b).toBeUndefined();
  expect(decode_car(bytes_of({ ...state, b: "coupe.99.0.0.1.0" }), "x")?.b).toBeUndefined();
});

test("rejects anything but bytes, and the wrong length", () => {
  const good = bytes_of(state);
  expect(decode_car({ ...state }, "x")).toBeNull();
  expect(decode_car(good.buffer, "x")).toBeNull();
  expect(decode_car("car", "x")).toBeNull();
  expect(decode_car(good.subarray(0, good.length - 1), "x")).toBeNull();
  const longer = new Uint8Array(good.length + 1);
  longer.set(good);
  expect(decode_car(longer, "x")).toBeNull();
  expect(decode_car(good.subarray(0, CAR_HEADER), "x")).toBeNull();
  expect(decode_car(with_byte(good, (v) => v.setUint8(CAR_HEADER, 200)), "x")).toBeNull();
});

test("rejects non-finite and out-of-range values", () => {
  const good = bytes_of(state);
  const bad = (set: (view: DataView) => void) => decode_car(with_byte(good, set), "x");
  expect(bad((v) => v.setFloat64(0, NaN, true))).toBeNull();
  expect(bad((v) => v.setFloat64(0, Infinity, true))).toBeNull();
  expect(bad((v) => v.setFloat64(0, -1, true))).toBeNull();
  expect(bad((v) => v.setFloat64(8, NaN, true))).toBeNull();
  expect(bad((v) => v.setFloat64(8, 1e8, true))).toBeNull();
  expect(bad((v) => v.setFloat32(16, NaN, true))).toBeNull();
  expect(bad((v) => v.setFloat32(20, -Infinity, true))).toBeNull();
  expect(bad((v) => v.setFloat32(24, WORLD_LIMIT + 1, true))).toBeNull();
  expect(bad((v) => [28, 30, 32, 34].forEach((at) => v.setInt16(at, 0, true)))).toBeNull();
  expect(bad((v) => v.setInt16(28, -32768, true))).toBeNull();
  expect(bad((v) => v.setUint32(46, 0, true))).toBeNull();
  expect(bad((v) => v.setUint16(50, 1001, true))).toBeNull();
  expect(bad((v) => v.setInt8(52, -128))).toBeNull();
  expect(bad((v) => v.setUint8(53, 4))).toBeNull();
});

test("rejects a name or build that isn't UTF-8", () => {
  const bytes = bytes_of({ ...state, name: "AB" });
  bytes[CAR_HEADER + 1] = 0xff;
  expect(decode_car(bytes, "x")).toBeNull();
});

test("encoder clamps instead of wrapping", () => {
  const out = decode_car(bytes_of({ ...state, v: [900, -900, 0], steer: 3 }), "x");
  expect(out?.v[0]).toBeGreaterThan(511);
  expect(out?.v[1]).toBeLessThan(-511);
  expect(out?.steer).toBe(1);
});

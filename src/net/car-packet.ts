import { build_code, parse_build } from "../car/build";
import type { CarState } from "./net";

export const WORLD_LIMIT = 5000;
const MAX_TIME = 1e12;
const MAX_BEST = 1e7;
const MAX_PAINT = 1e3;
// `clean_name` keeps 24 code points, at most 4 UTF-8 bytes each; `parse_build` refuses codes past 40 characters.
const NAME_BYTES = 96;
const BUILD_BYTES = 40;
const QUAT_SCALE = 32767;
const VEL_SCALE = 64;
const STEER_SCALE = 127;
const BRAKE = 1;
const BOOST = 2;
// Set for lamps off, so a peer that predates the switch reads as lit, as its lamps always are.
const DARK = 4;

const T = 0;
const BEST = 8;
const P = 16;
const Q = 28;
const V = 36;
const SEED = 42;
const W = 46;
const PAINT = 50;
const STEER = 52;
const FLAG = 53;
export const CAR_HEADER = 54;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

// Name and build change rarely; the heartbeat reuses their bytes instead of encoding them every tick.
class Utf8Cache {
  private text = "";
  private bytes = new Uint8Array(0);

  constructor(private readonly limit: number) {}

  get(text: string): Uint8Array {
    if (text !== this.text) [this.text, this.bytes] = [text, encoder.encode(text).subarray(0, this.limit)];
    return this.bytes;
  }
}

const names = new Utf8Cache(NAME_BYTES);
const builds = new Utf8Cache(BUILD_BYTES);

const int16 = (x: number) => Math.max(-32767, Math.min(32767, Math.round(x))) || 0;

/**
 * Fixed layout, little-endian: t f64, best f64 (0 = none), p 3×f32, q 4×i16 (unit), v 3×i16 (1/64 m/s), seed u32,
 * w u32, paint u16, steer i8, flags u8 (brake, boost, dark), then name and build as a length byte and UTF-8.
 * Append-only within a protocol: a new field goes after the build and a new flag takes a free bit, and decoders ignore
 * both. Reordering or resizing a field needs a `PROTOCOL` bump.
 */
export function encode_car(state: CarState): Uint8Array<ArrayBuffer> {
  const name = names.get(state.name);
  const build = builds.get(state.b ?? "");
  const bytes = new Uint8Array(CAR_HEADER + 2 + name.length + build.length);
  const view = new DataView(bytes.buffer);
  view.setFloat64(T, state.t, true);
  view.setFloat64(BEST, state.best ?? 0, true);
  for (let i = 0; i < 3; i++) view.setFloat32(P + i * 4, state.p[i], true);
  for (let i = 0; i < 4; i++) view.setInt16(Q + i * 2, int16(state.q[i] * QUAT_SCALE), true);
  for (let i = 0; i < 3; i++) view.setInt16(V + i * 2, int16(state.v[i] * VEL_SCALE), true);
  view.setUint32(SEED, state.seed, true);
  view.setUint32(W, state.w ?? 1, true);
  view.setUint16(PAINT, state.paint, true);
  view.setInt8(STEER, Math.max(-STEER_SCALE, Math.min(STEER_SCALE, Math.round(state.steer * STEER_SCALE))) || 0);
  view.setUint8(FLAG, (state.brake ? BRAKE : 0) | (state.boost ? BOOST : 0) | (state.lights === false ? DARK : 0));
  bytes[CAR_HEADER] = name.length;
  bytes.set(name, CAR_HEADER + 1);
  bytes[CAR_HEADER + 1 + name.length] = build.length;
  bytes.set(build, CAR_HEADER + 2 + name.length);
  return bytes;
}

// Peers are untrusted: anything that reaches the scene is range-checked here, so one bad or hostile client can't put
// NaN into another player's renderer. The name comes back as sent; the caller cleans it.
export function decode_car(raw: unknown, id: string): CarState | null {
  if (!(raw instanceof Uint8Array) || raw.length < CAR_HEADER + 2) return null;
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const name_length = raw[CAR_HEADER];
  if (name_length > NAME_BYTES || raw.length < CAR_HEADER + 2 + name_length) return null;
  const build_length = raw[CAR_HEADER + 1 + name_length];
  const end = CAR_HEADER + 2 + name_length + build_length;
  if (build_length > BUILD_BYTES || raw.length < end) return null;

  const t = view.getFloat64(T, true);
  const best = view.getFloat64(BEST, true);
  if (!(t >= 0 && t <= MAX_TIME)) return null;
  const p: CarState["p"] = [view.getFloat32(P, true), view.getFloat32(P + 4, true), view.getFloat32(P + 8, true)];
  if (!p.every((x) => Math.abs(x) <= WORLD_LIMIT)) return null;
  const q: CarState["q"] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) q[i] = view.getInt16(Q + i * 2, true);
  const length = Math.hypot(...q);
  if (q.includes(-32768) || length < QUAT_SCALE / 2) return null;
  for (let i = 0; i < 4; i++) q[i] /= length;
  const v: CarState["v"] = [0, 0, 0];
  for (let i = 0; i < 3; i++) v[i] = view.getInt16(V + i * 2, true) / VEL_SCALE;
  const w = view.getUint32(W, true);
  const paint = view.getUint16(PAINT, true);
  const steer = view.getInt8(STEER);
  const flags = view.getUint8(FLAG);
  if (w === 0 || paint > MAX_PAINT || steer < -STEER_SCALE) return null;

  let name: string;
  let code: string;
  try {
    name = decoder.decode(raw.subarray(CAR_HEADER + 1, CAR_HEADER + 1 + name_length));
    code = decoder.decode(raw.subarray(CAR_HEADER + 2 + name_length, end));
  } catch {
    return null;
  }
  const build = code ? parse_build(code) : null;
  return {
    id,
    name,
    paint,
    b: build ? build_code(build) : undefined,
    seed: view.getUint32(SEED, true),
    w,
    t,
    p,
    q,
    v,
    steer: steer / STEER_SCALE,
    brake: (flags & BRAKE) !== 0,
    boost: (flags & BOOST) !== 0,
    lights: (flags & DARK) === 0,
    best: best > 0 && best <= MAX_BEST ? best : null,
  };
}

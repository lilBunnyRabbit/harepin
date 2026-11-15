import type { Quaternion, Vector3 } from "three";
import type { Car } from "../car/car";
import type { CarSpec } from "../car/cars";
import type { WorldData } from "../worldgen/types";
import type { FrameKind, FrameOut, FrameRequest, SimCommand } from "./sim-host";

/**
 * The sim worker's reply, one per frame: a header, the player's car, each AI car's pose, then with a field each AI car's
 * road progress and the player's. Float64, not Float32: main
 * times laps and modes and picks reset spots from the car it reads, and those must match the sim on main bit for bit.
 * Append-only inside each block; reordering or resizing a field bumps `SIM_PACKET`, which both sides check.
 */
export const SIM_PACKET = 2;

export type SimRequest =
  | { type: "init"; seed: number; plan: WorldData; levels: readonly number[]; spec: CarSpec }
  | { type: "frame"; epoch: number; commands: readonly SimCommand[]; frame: FrameRequest };

const VERSION = 0;
const EPOCH = 1;
const KIND = 2;
const STEPS = 3;
const STEPPED = 4;
const IMPACT = 5;
const BLEND = 6;
const AI = 7;
const TOUCHES = 8;
const HEADER = 9;

const CAR = 39;
const WHEEL = 12;
const AI_CAR = 8;
const AI_WHEEL = 3;

export function packet_size(car: Car, field: readonly Car[]): number {
  let size = HEADER + CAR + car.wheels.length * WHEEL;
  for (const ai of field) size += AI_CAR + ai.wheels.length * AI_WHEEL;
  return size + (field.length ? field.length + 1 : 0);
}

function put3(out: Float64Array, at: number, v: Vector3): number {
  out[at] = v.x;
  out[at + 1] = v.y;
  out[at + 2] = v.z;
  return at + 3;
}

function put4(out: Float64Array, at: number, q: Quaternion): number {
  out[at] = q.x;
  out[at + 1] = q.y;
  out[at + 2] = q.z;
  out[at + 3] = q.w;
  return at + 4;
}

function get3(from: Float64Array, at: number, v: Vector3): number {
  v.set(from[at], from[at + 1], from[at + 2]);
  return at + 3;
}

function get4(from: Float64Array, at: number, q: Quaternion): number {
  q.set(from[at], from[at + 1], from[at + 2], from[at + 3]);
  return at + 4;
}

export function write_packet(out: Float64Array, epoch: number, frame: FrameOut, car: Car, from: { pos: Vector3; quat: Quaternion }, field: readonly Car[], progress: Float64Array) {
  out[VERSION] = SIM_PACKET;
  out[EPOCH] = epoch;
  out[KIND] = frame.kind;
  out[STEPS] = frame.steps;
  out[STEPPED] = frame.stepped;
  out[IMPACT] = frame.impact;
  out[BLEND] = frame.blend;
  out[AI] = field.length;
  out[TOUCHES] = frame.touches;
  let at = put3(out, HEADER, car.pos);
  at = put4(out, at, car.quat);
  at = put3(out, at, car.vel);
  at = put3(out, at, car.ang);
  at = put3(out, at, from.pos);
  at = put4(out, at, from.quat);
  out[at++] = car.gear;
  out[at++] = car.rpm;
  out[at++] = car.steer;
  out[at++] = car.braking;
  out[at++] = car.throttle;
  out[at++] = car.shifting;
  out[at++] = car.tcs_factor;
  out[at++] = car.key_steer;
  out[at++] = car.parked ? 1 : 0;
  out[at++] = car.nitro.fill;
  out[at++] = car.nitro.boosting ? 1 : 0;
  const { scrape } = car;
  out[at++] = scrape.hits;
  out[at++] = scrape.x;
  out[at++] = scrape.y;
  out[at++] = scrape.z;
  out[at++] = scrape.nx;
  out[at++] = scrape.nz;
  out[at++] = scrape.slide;
  out[at++] = scrape.into;
  for (const w of car.wheels) {
    out[at++] = w.contact ? 1 : 0;
    at = put3(out, at, w.point);
    out[at++] = w.lateral;
    out[at++] = w.slip;
    out[at++] = w.angle;
    out[at++] = w.spin;
    out[at++] = w.reach;
    out[at++] = w.compression;
    out[at++] = w.omega;
    out[at++] = w.load;
  }
  for (const ai of field) {
    at = put3(out, at, ai.pos);
    at = put4(out, at, ai.quat);
    out[at++] = ai.braking;
    for (const w of ai.wheels) {
      out[at++] = w.angle;
      out[at++] = w.spin;
      out[at++] = w.reach;
    }
  }
  if (field.length) out.set(progress, at);
}

export function packet_epoch(from: Float64Array): number {
  if (from[VERSION] !== SIM_PACKET) throw new Error(`sim packet ${from[VERSION]}, this build reads ${SIM_PACKET}`);
  return from[EPOCH];
}

export function read_packet(from: Float64Array, frame: FrameOut, car: Car, pose: { pos: Vector3; quat: Quaternion }, field: readonly Car[], progress: Float64Array) {
  packet_epoch(from);
  frame.kind = from[KIND] as FrameKind;
  frame.steps = from[STEPS];
  frame.stepped = from[STEPPED];
  frame.impact = from[IMPACT];
  frame.blend = from[BLEND];
  frame.touches = from[TOUCHES];
  if (from[AI] !== field.length) throw new Error(`sim packet has ${from[AI]} AI cars, main draws ${field.length}`);
  let at = get3(from, HEADER, car.pos);
  at = get4(from, at, car.quat);
  at = get3(from, at, car.vel);
  at = get3(from, at, car.ang);
  at = get3(from, at, pose.pos);
  at = get4(from, at, pose.quat);
  car.gear = from[at++];
  car.rpm = from[at++];
  car.steer = from[at++];
  car.braking = from[at++];
  car.throttle = from[at++];
  car.shifting = from[at++];
  car.tcs_factor = from[at++];
  car.key_steer = from[at++];
  car.parked = from[at++] === 1;
  car.nitro.fill = from[at++];
  car.nitro.boosting = from[at++] === 1;
  const { scrape } = car;
  scrape.hits = from[at++];
  scrape.x = from[at++];
  scrape.y = from[at++];
  scrape.z = from[at++];
  scrape.nx = from[at++];
  scrape.nz = from[at++];
  scrape.slide = from[at++];
  scrape.into = from[at++];
  for (const w of car.wheels) {
    w.contact = from[at++] === 1;
    at = get3(from, at, w.point);
    w.lateral = from[at++];
    w.slip = from[at++];
    w.angle = from[at++];
    w.spin = from[at++];
    w.reach = from[at++];
    w.compression = from[at++];
    w.omega = from[at++];
    w.load = from[at++];
  }
  for (const ai of field) {
    at = get3(from, at, ai.pos);
    at = get4(from, at, ai.quat);
    ai.braking = from[at++];
    for (const w of ai.wheels) {
      w.angle = from[at++];
      w.spin = from[at++];
      w.reach = from[at++];
    }
  }
  if (field.length) progress.set(from.subarray(at, at + field.length + 1));
}

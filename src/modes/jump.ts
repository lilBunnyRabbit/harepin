import { flight, face_end, ramp_world, RIDE, RUNUP } from "../worldgen/jumps";
import type { Ramp } from "../worldgen/types";
import type { Ground } from "./marks";
import type { Level } from "./mode";
import type { RoutePoint } from "./route";
import { MAX_STARS, type Thresholds } from "./track";

export const JumpKind = { KICKER: "kicker", BIG: "big", ROAD: "road" } as const;
export type JumpKind = (typeof JumpKind)[keyof typeof JumpKind];

export interface JumpLevel extends Level {
  kind: JumpKind;
}

export const JUMP_LEVELS: readonly JumpLevel[] = [
  { id: "j1", name: "Kicker", brings: "The off-road kicker nearest the start: find the speed for a long flight.", kind: JumpKind.KICKER },
  { id: "j2", name: "Big air", brings: "The big ramp: back up past the start for the speed it wants.", kind: JumpKind.BIG },
  { id: "j3", name: "Road kicker", brings: "The circuit's own kicker, taken at racing pace.", kind: JumpKind.ROAD },
];

export const TRIES = 3;
export const WINDOW_MS = 90_000;
export const SETTLE_MS = 1800;
// All four wheels leave the ramp as the car's centre passes the lip: a takeoff counts only around it, and only at speed.
const LIP_BEHIND = 4;
const LIP_AHEAD = 6;
const LIP_SIDE = 2;
const MIN_TAKEOFF = 6;
// More than this in one frame is no flight but a reset: the try is void.
const MAX_STEP = 10;
// A car beached on the lip has every wheel off the ground but goes nowhere: past this long at a crawl it counts as down.
const BEACHED_SPEED = 1;
const BEACHED_MS = 1500;
const MARK_STEP = 0.25;
const MARK_SLACK = 40;
// Toe speeds the marks are flown at (m/s). Two stars: what a road car carries from the start's 30 m run-up onto a kicker.
// Three: a run-up longer than the start gives, backed up for, and never past the ramp's own design speed.
const SILVER_TOE = 15;
const GOLD_TOE = 22;

const kind_of = (r: Ramp): JumpKind | null => (r.deck ? null : r.road ? JumpKind.ROAD : r.kind === "big" ? JumpKind.BIG : r.kind === "kicker" ? JumpKind.KICKER : null);

export function jump_levels(ramps: readonly Ramp[]): JumpLevel[] {
  return JUMP_LEVELS.filter((level) => ramps.some((r) => kind_of(r) === level.kind));
}

export function nearest_ramp(ramps: readonly Ramp[], at: { x: number; z: number }, level: JumpLevel): Ramp | null {
  let best: Ramp | null = null;
  let best_d = Infinity;
  for (const r of ramps) {
    if (kind_of(r) !== level.kind) continue;
    const d = Math.hypot(r.x - at.x, r.z - at.z);
    if (d < best_d) {
      best = r;
      best_d = d;
    }
  }
  return best;
}

const point = (r: Ramp, v: number): RoutePoint => {
  const [x, z] = ramp_world(r, 0, v);
  return { x, z, tx: r.fx, tz: r.fz };
};

/** Metres past the lip where a car leaving the toe at `speed` comes down, by the worldgen's own flight line. */
export function reach(r: Ramp, speed: number, ground: Ground): number {
  const from = face_end(r) - r.length;
  for (let d = from; d < from + r.landing + MARK_SLACK; d += MARK_STEP) {
    const [x, z] = ramp_world(r, 0, r.length + d);
    if (flight(r, speed, d) - RIDE <= ground.height(x, z)) return d;
  }
  return from + r.landing + MARK_SLACK;
}

export interface Jump {
  level: JumpLevel;
  ramp: Ramp;
  start: RoutePoint;
  lip: RoutePoint;
  marks: Thresholds;
}

export function build_jump(ramps: readonly Ramp[], at: { x: number; z: number }, ground: Ground, level: JumpLevel): Jump | null {
  const ramp = nearest_ramp(ramps, at, level);
  if (!ramp) return null;
  const three = Math.round(reach(ramp, Math.min(ramp.speed, GOLD_TOE), ground));
  const two = Math.min(three - 1, Math.round(reach(ramp, Math.min(ramp.speed, SILVER_TOE), ground)));
  return { level, ramp, start: point(ramp, -RUNUP), lip: point(ramp, ramp.length), marks: { two, three } };
}

export function past_lip(r: Ramp, x: number, z: number): number {
  return (x - r.x) * r.fx + (z - r.z) * r.fz - r.length;
}

const across = (r: Ramp, x: number, z: number) => (x - r.x) * r.fz - (z - r.z) * r.fx;

export function jump_stars(metres: number, { two, three }: Thresholds): number {
  if (metres >= three) return MAX_STARS;
  if (metres >= two) return 2;
  return metres > 0 ? 1 : 0;
}

export const metres = (d: number) => `${d.toFixed(1)} m`;

export const JumpEvent = { NONE: "none", TAKEOFF: "takeoff", LANDED: "landed", VOID: "void", RESET: "reset", DONE: "done" } as const;
export type JumpEvent = (typeof JumpEvent)[keyof typeof JumpEvent];

export interface JumpPose {
  x: number;
  z: number;
  vx: number;
  vz: number;
  airborne: boolean;
}

export interface Landing {
  x: number;
  z: number;
  metres: number;
}

/** Tries off one ramp: each runs from takeoff at the lip to the first wheel back down, the best counts. */
export class JumpRun {
  clock = 0;
  done = false;
  timed_out = false;
  readonly tries: Landing[] = [];
  best: Landing | null = null;
  flying: number | null = null;
  private landed_at: number | null = null;
  private crawl_ms = 0;
  private seen = false;
  private last_x = 0;
  private last_z = 0;
  private last_airborne = false;

  constructor(readonly jump: Jump) {}

  get left_ms(): number {
    return Math.max(0, WINDOW_MS - this.clock);
  }

  get settling(): Landing | null {
    return this.landed_at === null ? null : (this.tries[this.tries.length - 1] ?? null);
  }

  update(dt_ms: number, pose: JumpPose): JumpEvent {
    if (this.done) return JumpEvent.NONE;
    this.clock += dt_ms;
    const seen = this.seen;
    const { last_x, last_z, last_airborne } = this;
    this.seen = true;
    this.last_x = pose.x;
    this.last_z = pose.z;
    this.last_airborne = pose.airborne;
    if (this.landed_at !== null) {
      if (this.clock - this.landed_at < SETTLE_MS) return JumpEvent.NONE;
      this.landed_at = null;
      if (this.tries.length >= TRIES || this.clock >= WINDOW_MS) return this.end(this.clock >= WINDOW_MS && this.tries.length < TRIES);
      return JumpEvent.RESET;
    }
    const { ramp } = this.jump;
    if (this.flying !== null) {
      if (seen && Math.hypot(pose.x - last_x, pose.z - last_z) > MAX_STEP) {
        this.flying = null;
        return JumpEvent.VOID;
      }
      const d = Math.max(0, past_lip(ramp, pose.x, pose.z));
      this.crawl_ms = Math.hypot(pose.vx, pose.vz) < BEACHED_SPEED ? this.crawl_ms + dt_ms : 0;
      if (pose.airborne && this.crawl_ms < BEACHED_MS) {
        this.flying = d;
        return JumpEvent.NONE;
      }
      this.flying = null;
      const landing = { x: pose.x, z: pose.z, metres: Math.round(d * 10) / 10 };
      this.tries.push(landing);
      if (!this.best || landing.metres > this.best.metres) this.best = landing;
      this.landed_at = this.clock;
      return JumpEvent.LANDED;
    }
    if (this.clock >= WINDOW_MS) return this.end(true);
    if (!pose.airborne || !seen || last_airborne) return JumpEvent.NONE;
    const u = across(ramp, pose.x, pose.z);
    const v = past_lip(ramp, pose.x, pose.z) + ramp.length;
    const forward = pose.vx * ramp.fx + pose.vz * ramp.fz;
    if (Math.abs(u) > ramp.hw + LIP_SIDE || v < ramp.length - LIP_BEHIND || v > ramp.length + LIP_AHEAD || forward < MIN_TAKEOFF) return JumpEvent.NONE;
    this.flying = Math.max(0, v - ramp.length);
    this.crawl_ms = 0;
    return JumpEvent.TAKEOFF;
  }

  private end(timed_out: boolean): JumpEvent {
    this.done = true;
    this.timed_out = timed_out;
    return JumpEvent.DONE;
  }
}

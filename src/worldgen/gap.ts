import { flight, RIDE, ROAD_KICKER } from "./jumps";
import type { Ramp } from "./types";

/** Slowest and fastest toe speeds a gap is built for, m/s: under V_MIN a car falls in, V_MAX still lands on the deck. */
export const GAP_V_MIN = 22;
// Past this the kaze yaws over 0.35 rad/s off the landing whatever its slope, as on the sky track's gaps.
export const GAP_V_MAX = 40;
// A run-up reaches the toe up to 2 m/s under its aim, so the gap is sized for a car that much slower than V_MIN.
const SIZE_V = 20;
/** Deck a SIZE_V car lands on past the gap, so it touches down on the plane, not the rim edge. */
const GAP_SHORT = 8;
// Measured on every car (jumps.test.ts): a deck steep enough to match the descent angle, as first planned, lets a fast
// car fly far down it and land hard enough to bottom out; a near-flat deck at rim height keeps every flight short.
export const DECK_GRADE = -0.04;
const DECK_TAIL = 20;
const DECK_HW = 6;
const STEP = 0.25;

export interface GapJump {
  takeoff: Ramp;
  gap: number;
  deck: Ramp;
}

/** Metres past the lip where a car leaving the toe at `speed` comes down on `ground(d)`, the surface height there. */
export function touchdown(takeoff: Ramp, speed: number, ground: (d: number) => number): number {
  for (let d = STEP; d < 400; d += STEP) if (flight(takeoff, speed, d) - RIDE <= ground(d)) return d;
  return Infinity;
}

/**
 * The road kicker's lip on the near rim at (x, y, z) facing (fx, fz), then a gap, then a planar landing deck starting
 * `drop` below the rim. The gap ends GAP_SHORT before a SIZE_V car comes down; the deck runs past a V_MAX one's touchdown.
 */
export function gap_jump(id: number, x: number, y: number, z: number, fx: number, fz: number, drop = 0): GapJump {
  const takeoff: Ramp = { id, x, y, z, fx, fz, grade: 0, ...ROAD_KICKER };
  const deck_y = (gap: number) => (d: number) => (d < gap ? -Infinity : y - drop + DECK_GRADE * (d - gap));
  let gap = touchdown(takeoff, SIZE_V, () => y - drop) - GAP_SHORT;
  for (let i = 0; i < 8; i++) gap = touchdown(takeoff, SIZE_V, deck_y(gap)) - GAP_SHORT;
  const run = touchdown(takeoff, GAP_V_MAX, deck_y(gap)) - gap + DECK_TAIL;
  const at = takeoff.length + gap;
  const deck: Ramp = { id: id + 1, kind: "landing", x: x + fx * at, y: y - drop, z: z + fz * at, fx, fz, hw: DECK_HW, length: run, rise: 0, grade: DECK_GRADE, landing: 0, speed: 0 };
  return { takeoff, gap, deck };
}

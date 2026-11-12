import { flight, RIDE, ROAD_KICKER } from "./jumps";
import type { Ramp, RoadPoint } from "./types";

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
/** A dune jump's shaped ground is level this far either side of its axis: the deck's half width and a metre. */
export const DUNE_HALF = DECK_HW + 1;
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
  const takeoff: Ramp = { id, x, y, z, fx, fz, grade: 0, ...ROAD_KICKER, road: true };
  const deck_y = (gap: number) => (d: number) => (d < gap ? -Infinity : y - drop + DECK_GRADE * (d - gap));
  let gap = touchdown(takeoff, SIZE_V, () => y - drop) - GAP_SHORT;
  for (let i = 0; i < 8; i++) gap = touchdown(takeoff, SIZE_V, deck_y(gap)) - GAP_SHORT;
  const run = touchdown(takeoff, GAP_V_MAX, deck_y(gap)) - gap + DECK_TAIL;
  const at = takeoff.length + gap;
  const deck: Ramp = { id: id + 1, kind: "landing", x: x + fx * at, y: y - drop, z: z + fz * at, fx, fz, hw: DECK_HW, length: run, rise: 0, grade: DECK_GRADE, landing: 0, speed: 0 };
  takeoff.landing = gap + run;
  return { takeoff, gap, deck };
}

/** Slowest and fastest lip speeds a dune crest jump is built for, m/s: what cars carry up a packed windward face. */
export const DUNE_V_MIN = 15;
export const DUNE_V_MAX = 25;
/**
 * Landing on a deck falling at k from the lip's height, a car hits it at about speed * k / sqrt(1 + k²) plus what the
 * lip threw it up by: at 25 m/s a -0.3 deck and a 0.3 m lip keep every car under 9 m/s into it (jumps.test.ts), where a
 * -0.5 deck or a road kicker's 2 m lip land the fast ones at 10-11.
 */
export const DUNE_DECK_GRADE = -0.3;
const DUNE_LIP = 0.3;
export const DUNE_LIP_RUN = 8;
const DUNE_TAIL = 15;

/**
 * A table-top over a dune's brink: a low lip at (x, y, z) facing (fx, fz), then straight on, with no gap, a deck at the
 * lip's base falling at DUNE_DECK_GRADE past a DUNE_V_MAX car's touchdown. Past the deck the slip face is the run-out.
 * The lip is a slab, not a kicker: a kicker this low buries its toe 80 m back along its own shallow slope, and on a
 * windward face steeper than that the buried wedge would stand proud of the sand.
 */
export function dune_jump(id: number, x: number, y: number, z: number, fx: number, fz: number): GapJump {
  const takeoff: Ramp = { id, kind: "landing", x, y, z, fx, fz, hw: DECK_HW, length: DUNE_LIP_RUN, rise: 0, grade: DUNE_LIP / DUNE_LIP_RUN, landing: 0, speed: 0 };
  const run = touchdown(takeoff, DUNE_V_MAX, (d) => y + DUNE_DECK_GRADE * d) + DUNE_TAIL;
  const at = takeoff.length;
  const deck: Ramp = { id: id + 1, kind: "landing", x: x + fx * at, y, z: z + fz * at, fx, fz, hw: DECK_HW, length: run, rise: 0, grade: DUNE_DECK_GRADE, landing: 0, speed: 0 };
  takeoff.landing = run;
  return { takeoff, gap: 0, deck };
}

/** The run-out past a dune jump's deck steepens over this far to RUNOUT_GRADE, then holds it down to the slip face. */
const RUNOUT_TAPER = 40;
const RUNOUT_GRADE = 0.55;
const RUNOUT_EASE = 0.25;
const SHAPE_STEP = 4;
const RUNOUT_MAX = 300;

/**
 * The ground a dune jump is shaped on, along its axis from the toe: level under the lip, the deck's plane under the
 * deck, then a run-out until it crosses `ground` on the slip face. Over a face falling away faster than the deck it
 * steepens to come down onto it; through ground that falls slower, a rounded brink or a lane crossing the face at a
 * slant, it eases to RUNOUT_EASE until the face drops to meet it.
 */
export function dune_jump_shape(g: GapJump, ground: (x: number, z: number) => number): RoadPoint[] {
  const { takeoff, deck } = g;
  const out: RoadPoint[] = [];
  const at = (d: number, y: number) => out.push({ x: takeoff.x + takeoff.fx * d, y, z: takeoff.z + takeoff.fz * d, tx: takeoff.fx, tz: takeoff.fz });
  for (let d = 0; d < takeoff.length; d += SHAPE_STEP) at(d, takeoff.y);
  const end = takeoff.length + deck.length;
  for (let d = takeoff.length; d <= end; d += SHAPE_STEP) at(d, deck.y + deck.grade * (d - takeoff.length));
  let y = deck.y + deck.grade * deck.length;
  const below = (d: number, h: number) => h < ground(takeoff.x + takeoff.fx * d, takeoff.z + takeoff.fz * d);
  const filling = !below(end, y);
  for (let d = end + SHAPE_STEP, k = 1; d < end + RUNOUT_MAX; d += SHAPE_STEP, k++) {
    const ramp = Math.min(1, (k * SHAPE_STEP) / RUNOUT_TAPER);
    y -= SHAPE_STEP * (-deck.grade + ((filling ? RUNOUT_GRADE : RUNOUT_EASE) + deck.grade) * ramp);
    if (below(d, y) === filling) {
      at(d, ground(takeoff.x + takeoff.fx * d, takeoff.z + takeoff.fz * d));
      break;
    }
    at(d, y);
  }
  return out;
}

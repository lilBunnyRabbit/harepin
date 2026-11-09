import { PieceKind, RampKind, type WorldData } from "./types";

// Turning faster than this (rad/m, about a 85 m radius) is a corner; slower is a sweep taken flat out.
const CORNER_RATE = 0.012;
const WINDOW_M = 16;
// A straight shorter than this between two turns the same way doesn't end the corner.
const MERGE_M = 18;
const MIN_TURN = (30 * Math.PI) / 180;

export interface WorldFacts {
  /** Lap length of the circuit or sky track, metres. */
  length: number;
  corners: number;
  jumps: number;
  gaps: number;
  towns: number;
  pads: number;
}

type FactsInput = Pick<WorldData, "road" | "ramps" | "deck" | "towns">;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function count_corners(points: readonly { x: number; z: number }[]): number {
  const n = points.length;
  if (n < 4) return 0;
  const heading: number[] = [];
  const ds: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    heading.push(Math.atan2(b.x - a.x, b.z - a.z));
    ds.push(Math.hypot(b.x - a.x, b.z - a.z));
  }
  const turn = heading.map((h, i) => wrap(heading[(i + 1) % n] - h));
  const rate = turn.map((_, i) => {
    let sum = 0;
    let span = 0;
    for (let k = 0; k < n && span < WINDOW_M; k++) {
      sum += turn[(i + k) % n];
      span += ds[(i + k) % n];
    }
    return sum / Math.max(1, span);
  });
  // Start on a straight so the loop's seam never cuts a corner in two.
  const start = Math.max(0, rate.findIndex((r) => Math.abs(r) < CORNER_RATE));
  let corners = 0;
  let side = 0;
  let turned = 0;
  let quiet = 0;
  const close = () => {
    if (turned >= MIN_TURN) corners++;
    side = 0;
    turned = 0;
  };
  for (let step = 0; step < n; step++) {
    const i = (start + step) % n;
    if (Math.abs(rate[i]) < CORNER_RATE) {
      quiet += ds[i];
      if (side !== 0 && quiet > MERGE_M) close();
      continue;
    }
    if (side !== 0 && Math.sign(rate[i]) !== side) close();
    side = Math.sign(rate[i]);
    turned += Math.abs(turn[i]);
    quiet = 0;
  }
  if (side !== 0) close();
  return corners;
}

export function world_facts({ road, ramps, deck, towns }: FactsInput): WorldFacts {
  let length = 0;
  for (let i = 0; i < road.length; i++) {
    const a = road[i];
    const b = road[(i + 1) % road.length];
    length += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return {
    length,
    corners: count_corners(road),
    jumps: ramps.filter((ramp) => ramp.kind !== RampKind.LANDING).length,
    gaps: deck ? deck.pieces.filter((piece) => piece.kind === PieceKind.GAP).length : 0,
    towns: towns.length,
    pads: deck ? deck.pads.length : 0,
  };
}

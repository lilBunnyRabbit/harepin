import { atan2, cos, hypot, sin } from "../sim-math";
export interface RoutePoint {
  x: number;
  z: number;
  tx: number;
  tz: number;
}

const wrap = (a: number) => atan2(sin(a), cos(a));
const at = <T>(road: readonly T[], i: number) => road[((i % road.length) + road.length) % road.length];

export function slice(road: readonly RoutePoint[], start: number, count: number): RoutePoint[] {
  return Array.from({ length: count }, (_, i) => at(road, start + i));
}

export function length_of(points: readonly RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  return total;
}

export function bend(road: readonly RoutePoint[], start: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count - 1; i++) {
    const a = at(road, start + i);
    const b = at(road, start + i + 1);
    total += Math.abs(wrap(atan2(b.tx, b.tz) - atan2(a.tx, a.tz)));
  }
  return total;
}

export function bendiest(road: readonly RoutePoint[], count: number, keep: number, stride = 8): number[] {
  const scored: [number, number][] = [];
  for (let start = 0; start < road.length; start += stride) scored.push([start, bend(road, start, count)]);
  scored.sort((a, b) => b[1] - a[1]);
  const picked: number[] = [];
  const apart = (a: number, b: number) => {
    const d = Math.abs(a - b) % road.length;
    return Math.min(d, road.length - d) >= count;
  };
  for (const [start] of scored) {
    if (picked.every((p) => apart(p, start))) picked.push(start);
    if (picked.length >= keep) break;
  }
  return picked;
}

/** Turn per metre past which a straight ends: a bend tighter than about 70 m of radius. */
const STRAIGHT_TURN = 0.015;

export interface Straight {
  from: number;
  to: number;
  /** Metres. */
  length: number;
}

/** The inverse of `bendiest`: every straight of an open run of points, the longest first, measured in metres. */
export function straights(line: readonly RoutePoint[]): Straight[] {
  const found: Straight[] = [];
  let from = 0;
  let length = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const step = hypot(b.x - a.x, b.z - a.z);
    const turn = Math.abs(wrap(atan2(b.tx, b.tz) - atan2(a.tx, a.tz)));
    if (step > 0 && turn / step > STRAIGHT_TURN) {
      if (i - 1 > from) found.push({ from, to: i - 1, length });
      from = i;
      length = 0;
    } else length += step;
  }
  if (line.length - 1 > from) found.push({ from, to: line.length - 1, length });
  return found.sort((a, b) => b.length - a.length);
}

/** Total turn past which a run of curve is a bend worth a sign: about 35 degrees. */
const BEND_TURN = 0.6;
/** Metres of straight inside a bend that do not end it: the run between two arcs of one corner. */
const BEND_GAP = 40;

export interface Bend {
  from: number;
  to: number;
  /** 1 turns left, -1 right. */
  side: 1 | -1;
}

/** Every real bend of an open run of points, in driving order: a stretch tighter than `STRAIGHT_TURN` one way that turns `BEND_TURN` or more. */
export function bends(line: readonly RoutePoint[]): Bend[] {
  const found: Bend[] = [];
  let from = -1;
  let to = -1;
  let total = 0;
  let gap = 0;
  const close = () => {
    if (from >= 0 && Math.abs(total) >= BEND_TURN) found.push({ from, to, side: total > 0 ? 1 : -1 });
    from = -1;
    total = 0;
  };
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const step = hypot(b.x - a.x, b.z - a.z);
    const turn = wrap(atan2(b.tx, b.tz) - atan2(a.tx, a.tz));
    const curved = step > 0 && Math.abs(turn) / step > STRAIGHT_TURN;
    if (from >= 0 && curved && turn * total < 0) close();
    if (curved) {
      if (from < 0) from = i - 1;
      to = i;
      total += turn;
      gap = 0;
    } else if (from >= 0) {
      gap += step;
      if (gap > BEND_GAP) close();
    }
  }
  close();
  return found;
}

// Searches only near the last point, so a stretch of road that doubles back past the car never steals the match.
export class RouteTracker {
  index = -1;
  offset = Infinity;

  constructor(
    readonly points: readonly RoutePoint[],
    private readonly window = 30,
  ) {}

  update(x: number, z: number): number {
    const last = this.points.length - 1;
    const from = this.index < 0 ? 0 : Math.max(0, this.index - this.window);
    const to = this.index < 0 ? last : Math.min(last, this.index + this.window);
    let best = from;
    let best_d = Infinity;
    for (let i = from; i <= to; i++) {
      const p = this.points[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < best_d) {
        best_d = d;
        best = i;
      }
    }
    this.index = best;
    this.offset = Math.sqrt(best_d);
    return best;
  }
}

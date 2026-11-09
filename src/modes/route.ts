export interface RoutePoint {
  x: number;
  z: number;
  tx: number;
  tz: number;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const at = <T>(road: readonly T[], i: number) => road[((i % road.length) + road.length) % road.length];

export function slice(road: readonly RoutePoint[], start: number, count: number): RoutePoint[] {
  return Array.from({ length: count }, (_, i) => at(road, start + i));
}

export function length_of(points: readonly RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  return total;
}

export function bend(road: readonly RoutePoint[], start: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count - 1; i++) {
    const a = at(road, start + i);
    const b = at(road, start + i + 1);
    total += Math.abs(wrap(Math.atan2(b.tx, b.tz) - Math.atan2(a.tx, a.tz)));
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

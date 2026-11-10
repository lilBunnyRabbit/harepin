export interface PacePoint {
  x: number;
  z: number;
  tx: number;
  tz: number;
}

export const Side = { LEFT: "left", RIGHT: "right" } as const;
export type Side = (typeof Side)[keyof typeof Side];

export interface Corner {
  side: Side;
  /** 1 tightest to 6 fastest. */
  grade: number;
  hairpin: boolean;
  start: number;
  apex: number;
  end: number;
  turn: number;
  radius: number;
}

export interface PaceRoute {
  closed: boolean;
  length: number;
  /** Metres along the route at each point; a closed route's origin sits mid-way along its longest straight, so no corner spans the seam. */
  at: Float64Array;
  corners: Corner[];
}

export interface Ahead {
  /** Index into `corners`, -1 past the last corner of a point-to-point route. */
  next: number;
  /** Metres to the next corner's start, 0 once inside it. */
  distance: number;
  then: number;
  /** `then` starts within INTO_GAP of the next corner's exit. */
  into: boolean;
}

/** Upper radius in metres of grades 1 to 6; anything wider is a straight. */
export const GRADE_RADIUS = [22, 38, 60, 95, 150, 240] as const;
/** Heading change is measured over this many metres each side, so the 2 m polyline's wobble reads as straight. */
const CURVE_SPAN = 8;
const MERGE_GAP = 14;
const MIN_TURN = (14 * Math.PI) / 180;
const HAIRPIN_TURN = (140 * Math.PI) / 180;
export const INTO_GAP = 40;

const wrap_angle = (a: number) => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));

export function grade_of(radius: number): number {
  const at = GRADE_RADIUS.findIndex((limit) => radius <= limit);
  return at < 0 ? 0 : at + 1;
}

interface Run {
  side: Side;
  from: number;
  to: number;
  peak: number;
  apex: number;
}

/** Middle of the longest straight, so the seam never falls in a short gap that would merge two bends into one corner anywhere else. */
function longest_straight(n: number, bend: (i: number) => number, gap: (i: number, j: number) => number): number {
  let first = 0;
  while (first < n && bend(first) === 0) first++;
  if (first === n) return 0;
  let best = 0;
  let best_length = -1;
  let from = -1;
  for (let k = 1; k <= n; k++) {
    const i = (first + k) % n;
    if (bend(i) === 0) {
      if (from < 0) from = i;
      continue;
    }
    if (from < 0) continue;
    const last = (i - 1 + n) % n;
    const length = gap(from, last);
    if (length > best_length) {
      best_length = length;
      best = (from + Math.floor(((last - from + n) % n) / 2)) % n;
    }
    from = -1;
  }
  return best;
}

/** Corners in the order `points` runs; left and right as the driver sees them going that way. */
export function read_route(points: readonly PacePoint[], closed: boolean): PaceRoute {
  const n = points.length;
  const index = (i: number) => (closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)));
  const step = (i: number) => Math.hypot(points[index(i + 1)].x - points[i].x, points[index(i + 1)].z - points[i].z);
  const heading = points.map((p) => Math.atan2(p.tx, p.tz));

  const raw = new Float64Array(n);
  for (let i = 1; i < n; i++) raw[i] = raw[i - 1] + step(i - 1);
  const length = closed && n > 1 ? raw[n - 1] + step(n - 1) : (raw[n - 1] ?? 0);
  const gap = (i: number, j: number) => {
    const d = raw[j] - raw[i];
    return closed && d < 0 ? d + length : d;
  };

  // Heading is atan2(x, z) and the chase camera has +x on its left at heading 0, so a right-hander lowers the heading.
  const curve = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let a = i;
    let b = i;
    for (let k = 0; k < n && (closed || a > 0) && gap(index(a - 1), i) <= CURVE_SPAN; k++) a = index(a - 1);
    for (let k = 0; k < n && (closed || b < n - 1) && gap(i, index(b + 1)) <= CURVE_SPAN; k++) b = index(b + 1);
    const span = gap(a, b);
    curve[i] = span > 0 ? -wrap_angle(heading[b] - heading[a]) / span : 0;
  }
  const bend = (i: number) => (Math.abs(curve[i]) * GRADE_RADIUS[5] >= 1 ? Math.sign(curve[i]) : 0);

  const origin = closed ? longest_straight(n, bend, gap) : 0;
  const at = new Float64Array(n);
  for (let i = 0; i < n; i++) at[i] = gap(origin, i);

  const runs: Run[] = [];
  for (let k = 0; k < n; k++) {
    const i = index(origin + k);
    const sign = bend(i);
    if (sign === 0) continue;
    const side = sign > 0 ? Side.RIGHT : Side.LEFT;
    const last = runs.at(-1);
    if (last && last.side === side && at[i] - at[last.to] <= MERGE_GAP) {
      last.to = i;
      if (Math.abs(curve[i]) > last.peak) {
        last.peak = Math.abs(curve[i]);
        last.apex = i;
      }
    } else runs.push({ side, from: i, to: i, peak: Math.abs(curve[i]), apex: i });
  }

  const corners: Corner[] = [];
  for (const run of runs) {
    let turn = 0;
    for (let i = run.from; i !== run.to; i = index(i + 1)) turn += Math.abs(wrap_angle(heading[index(i + 1)] - heading[i]));
    if (turn < MIN_TURN) continue;
    const radius = 1 / run.peak;
    const hairpin = turn >= HAIRPIN_TURN && radius <= GRADE_RADIUS[1];
    corners.push({ side: run.side, grade: hairpin ? 1 : grade_of(radius), hairpin, start: at[run.from], apex: at[run.apex], end: at[run.to], turn, radius });
  }
  return { closed, length, at, corners };
}

export function reverse_route(route: PaceRoute): PaceRoute {
  const { length, closed } = route;
  const flip = (s: number) => (closed ? (length - s) % length : length - s);
  const corners = route.corners
    .map((c): Corner => ({ ...c, side: c.side === Side.LEFT ? Side.RIGHT : Side.LEFT, start: flip(c.end), apex: flip(c.apex), end: flip(c.start) }))
    .sort((a, b) => a.start - b.start);
  return { closed, length, at: route.at.map(flip), corners };
}

const ahead = (closed: boolean, length: number, from: number, to: number) => (closed && to < from ? to + length - from : to - from);

export function corners_ahead(route: PaceRoute, s: number, out: Ahead): Ahead {
  const { corners, closed, length } = route;
  const count = corners.length;
  out.next = -1;
  out.then = -1;
  out.distance = 0;
  out.into = false;
  let next = -1;
  for (let i = 0; i < count; i++)
    if (corners[i].apex >= s) {
      next = i;
      break;
    }
  if (next < 0 && closed && count > 0) next = 0;
  if (next < 0) return out;
  const corner = corners[next];
  out.next = next;
  out.distance = corner.start <= s && corner.apex >= s ? 0 : ahead(closed, length, s, corner.start);
  out.then = next + 1 < count ? next + 1 : closed && count > 1 ? 0 : -1;
  if (out.then >= 0) out.into = ahead(closed, length, corner.end, corners[out.then].start) <= INTO_GAP;
  return out;
}

/** Searches `window` points either side of `hint` first; the whole route only when that lands farther than `reach`. */
export function nearest_point(points: readonly PacePoint[], closed: boolean, x: number, z: number, hint: number, window: number, reach: number): number {
  const n = points.length;
  let best = -1;
  let best_d = Infinity;
  if (hint >= 0 && hint < n)
    for (let k = -window; k <= window; k++) {
      const i = closed ? (((hint + k) % n) + n) % n : hint + k;
      if (i < 0 || i >= n) continue;
      const d = (points[i].x - x) ** 2 + (points[i].z - z) ** 2;
      if (d < best_d) {
        best_d = d;
        best = i;
      }
    }
  if (best >= 0 && best_d <= reach * reach) return best;
  for (let i = 0; i < n; i++) {
    const d = (points[i].x - x) ** 2 + (points[i].z - z) ** 2;
    if (d < best_d) {
      best_d = d;
      best = i;
    }
  }
  return best;
}

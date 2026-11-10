import { sample } from "./field";
import { length } from "./noise";
import type { Trail } from "./trails";
import { ROAD_HALF, RouteKind, SIDEWALK, STREET_HALF, type Checkpoint, type Item, type Ramp, type RoadEdge, type RoadGraph, type RoadPoint, type Route, type Town } from "./types";

const STREET_COST = 0.6;
const SPUR_COST = 1;
const RING_COST = 1.4;
/** Metres a square street corner takes off a route's cost, so the search zigzags through town instead of cutting an L. */
const TURN_BONUS = 20;
/** |sin| of the angle between two street legs above which their joint counts as a corner. */
const CORNER_SIN = 0.7;
/** Strict window first; a seed whose towns fit none of it races the best of the loose one rather than not at all. */
const WINDOWS = [
  { turns: 6, min: 1200, max: 2500 },
  { turns: 3, min: 800, max: 3200 },
];
const AIM_LENGTH = 1800;
const STREET_ROUTES = 2;
const GATE_SPACING = 150;
/** Gates closer than this to the one before are dropped: a corner right after a spur gate would be two posts at once. */
const GATE_GAP = 25;
/**
 * The autopilot's driving, fitted to scripts/races.ts: corner speed sqrt(grip × radius), acceleration fading to nothing
 * at TOP, braking BRAKE. Within 5% of the median car on every fitted route.
 */
const BOT = { grip: 6, accel: 6, top: 36, brake: 6, span: 5 } as const;
/** Par over the estimated autopilot time: wide enough that the slowest car's autopilot still makes it. */
const PAR_SHARE = 1.15;
const CONE_GAP = 2;
const CONE_SET = 3;
const TRAIL_GATES = 150;
/** A gate this many points before the take-off toe, then none until the run-out end, where the ramp-out joins. */
const TOE_GATE = 20;
const TRAIL_GATE_HW = 8;
// Fitted to scripts/races.ts: dirt grip, bumps and the run-up to the gap cost every car time drive_time does not see.
const OFFROAD_SHARE = 1.5;

type LegKind = "street" | "spur" | "local" | "ring";

interface Leg {
  from: number;
  to: number;
  kind: LegKind;
  piece: number;
  points: RoadPoint[];
  length: number;
}

const WEIGHT: Record<LegKind, number> = { street: STREET_COST, spur: SPUR_COST, local: SPUR_COST, ring: RING_COST };

function run(points: readonly { x: number; z: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += length(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  return total;
}

function flip(points: readonly RoadPoint[]): RoadPoint[] {
  return [...points].reverse().map((p) => ({ ...p, tx: -p.tx, tz: -p.tz }));
}

/** Seconds the autopilot takes over `points` from a standing start: corner caps, then an accelerate and a brake pass. */
export function drive_time(points: readonly RoadPoint[], closed: boolean): number {
  const n = points.length;
  const at = (i: number) => (closed ? points[((i % n) + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  const cap: number[] = [];
  const step: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = at(i - BOT.span);
    const b = at(i);
    const c = at(i + BOT.span);
    const cross = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
    const radius = cross === 0 ? Infinity : (length(b.x - a.x, b.z - a.z) * length(c.x - b.x, c.z - b.z) * length(c.x - a.x, c.z - a.z)) / (2 * cross);
    cap.push(Math.min(BOT.top, Math.sqrt(BOT.grip * radius)));
    const next = at(i + 1);
    step.push(length(next.x - b.x, next.z - b.z));
  }
  const m = closed ? n + 1 : n;
  const v = new Array<number>(m).fill(0);
  for (let i = 1; i < m; i++) v[i] = Math.min(cap[i % n], Math.sqrt(v[i - 1] ** 2 + 2 * BOT.accel * (1 - v[i - 1] / BOT.top) * step[i - 1]));
  for (let i = m - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * BOT.brake * step[i]));
  let t = 0;
  for (let i = 0; i < m - 1; i++) t += step[i] / Math.max(0.5, (v[i] + v[i + 1]) / 2);
  return t;
}

function par(points: readonly RoadPoint[], closed: boolean, share = PAR_SHARE): number {
  return Math.ceil(drive_time(points, closed) * share * 2) * 500;
}

const heading = (p: { tx: number; tz: number }) => Math.atan2(p.tx, p.tz);

/** The race loop as a route: the circuit's own gates, the start line moved to the end as the finish. */
export function circuit_route(road: readonly RoadPoint[], checkpoints: readonly Checkpoint[]): Route {
  const lap = run(road) + length(road[0].x - road[road.length - 1].x, road[0].z - road[road.length - 1].z);
  const gates = [...checkpoints.slice(1), checkpoints[0]].map((c, index) => ({ ...c, index }));
  return { id: "circuit", kind: RouteKind.CIRCUIT, closed: true, points: [...road], checkpoints: gates, gate_hw: ROAD_HALF, length: lap, par_ms: par(road, true) };
}

/** The circuit driven the other way from the same start line; a road kicker would face backwards, so only a loop with none gets one. */
export function reverse_circuit(circuit: Route, ramps: readonly Ramp[]): Route | null {
  if (ramps.some((r) => r.road && circuit.points.some((p) => length(p.x - r.x, p.z - r.z) < ROAD_HALF))) return null;
  const [start, ...rest] = circuit.points;
  const points = [start, ...rest.reverse()].map((p) => ({ ...p, tx: -p.tx, tz: -p.tz }));
  const gates = circuit.checkpoints.slice(0, -1).reverse();
  const finish = circuit.checkpoints[circuit.checkpoints.length - 1];
  const checkpoints = [...gates, finish].map((c, index) => ({ ...c, heading: c.heading + Math.PI, index }));
  return { ...circuit, id: "circuit-rev", points, checkpoints, par_ms: par(points, true) };
}

class Atlas {
  readonly legs: Leg[] = [];
  readonly out = new Map<number, number[]>();
  readonly town_nodes = new Map<number, number[]>();
  readonly gates = new Map<number, number>();
  private pieces = 0;

  constructor(
    readonly graph: RoadGraph,
    circuit: readonly number[],
    towns: readonly Town[],
    private readonly ramps: readonly Ramp[] = [],
  ) {
    const town_of = (x: number, z: number) => towns.find((t) => length(t.x - x, t.z - z) <= t.radius + 1);
    for (const edge of graph.edges) {
      if (circuit.includes(edge.id)) continue;
      if (edge.kind === "street") {
        this.add(edge.a, edge.b, "street", edge.points);
        const town = town_of(edge.points[0].x, edge.points[0].z);
        if (!town) continue;
        const list = this.town_nodes.get(town.id) ?? [];
        for (const node of [edge.a, edge.b]) if (!list.includes(node)) list.push(node);
        this.town_nodes.set(town.id, list);
        continue;
      }
      this.add(edge.a, edge.b, edge.kind === "local" ? "local" : "spur", edge.points);
      if (edge.kind !== "highway") continue;
      const gate = graph.nodes[edge.a];
      const town = town_of(gate.x, gate.z);
      if (town && !this.gates.has(town.id)) this.gates.set(town.id, edge.a);
    }
    // A circuit with one join stays a closed loop on it: no leg leads anywhere new.
    for (const id of circuit) {
      const leg = graph.edges[id];
      if (!leg.closed && leg.a !== leg.b) this.add(leg.a, leg.b, "ring", leg.points, this.kicked(leg.points));
    }
  }

  // A road kicker is a wall from behind: the circuit past one is one way.
  private kicked(points: readonly RoadPoint[]): boolean {
    return this.ramps.some((r) => r.road && points.some((p) => length(p.x - r.x, p.z - r.z) < r.length + ROAD_HALF));
  }

  private add(a: number, b: number, kind: LegKind, points: RoadPoint[], one_way = false) {
    const piece = this.pieces++;
    const metres = run(points);
    const ways = [{ from: a, to: b, kind, piece, points, length: metres }];
    if (!one_way) ways.push({ from: b, to: a, kind, piece, points: flip(points), length: metres });
    for (const leg of ways) {
      const list = this.out.get(leg.from) ?? [];
      list.push(this.legs.length);
      this.out.set(leg.from, list);
      this.legs.push(leg);
    }
  }

  corner(a: Leg, b: Leg): boolean {
    const p = a.points[a.points.length - 1];
    const q = b.points[0];
    return Math.abs(p.tx * q.tz - p.tz * q.tx) > CORNER_SIN;
  }

  /** Cheapest legs from `start` to `end` with corners rewarded, off legs of the `banned` kind; never doubles straight back along a piece. */
  search(start: number, end: number, banned: LegKind | null): number[] | null {
    const cost = new Float64Array(this.legs.length).fill(Infinity);
    const prev = new Int32Array(this.legs.length).fill(-1);
    const done = new Uint8Array(this.legs.length);
    for (const l of this.out.get(start) ?? []) if (this.legs[l].kind !== banned) cost[l] = this.legs[l].length * WEIGHT[this.legs[l].kind];
    for (;;) {
      let best = -1;
      for (let l = 0; l < this.legs.length; l++) if (!done[l] && cost[l] < Infinity && (best < 0 || cost[l] < cost[best])) best = l;
      if (best < 0) return null;
      done[best] = 1;
      const leg = this.legs[best];
      if (leg.to === end) {
        const path: number[] = [];
        for (let l = best; l >= 0; l = prev[l]) path.push(l);
        return path.reverse();
      }
      for (const l of this.out.get(leg.to) ?? []) {
        const next = this.legs[l];
        if (done[l] || next.piece === leg.piece || next.kind === banned) continue;
        const c = cost[best] + next.length * WEIGHT[next.kind] - (this.corner(leg, next) ? TURN_BONUS : 0);
        if (c < cost[l]) {
          cost[l] = c;
          prev[l] = best;
        }
      }
    }
  }
}

interface Candidate {
  legs: number[];
  points: RoadPoint[];
  checkpoints: Checkpoint[];
  turns: number;
  length: number;
  pair: [number, number];
}

function trace(atlas: Atlas, legs: number[], pair: [number, number]): Candidate | null {
  const nodes = [atlas.legs[legs[0]].from, ...legs.map((l) => atlas.legs[l].to)];
  if (new Set(nodes).size !== nodes.length) return null;
  const points: RoadPoint[] = [];
  const gates: Omit<Checkpoint, "index">[] = [];
  let turns = 0;
  let metres = 0;
  const gate = (p: RoadPoint) => {
    const last = gates[gates.length - 1];
    if (last && length(last.x - p.x, last.z - p.z) < GATE_GAP) gates.pop();
    gates.push({ x: p.x, y: p.y, z: p.z, heading: heading(p) });
  };
  legs.forEach((l, k) => {
    const leg = atlas.legs[l];
    if (k > 0 && atlas.corner(atlas.legs[legs[k - 1]], leg)) {
      turns++;
      gate(leg.points[0]);
    }
    if (leg.kind !== "street")
      for (let s = GATE_SPACING, walked = 0, i = 1; i < leg.points.length; i++) {
        walked += length(leg.points[i].x - leg.points[i - 1].x, leg.points[i].z - leg.points[i - 1].z);
        if (walked >= s && leg.length - walked > GATE_GAP) {
          gate(leg.points[i]);
          s += GATE_SPACING;
        }
      }
    points.push(...(k === 0 ? leg.points : leg.points.slice(1)));
    metres += leg.length;
  });
  gate(points[points.length - 1]);
  return { legs, points, checkpoints: gates.map((g, index) => ({ ...g, index })), turns, length: metres, pair };
}

const fits = (c: Candidate, w: (typeof WINDOWS)[number]) => c.turns >= w.turns && c.length >= w.min && c.length <= w.max;

function farthest(graph: RoadGraph, nodes: readonly number[], from: number): number {
  const a = graph.nodes[from];
  let best = nodes[0];
  for (const id of nodes) {
    const n = graph.nodes[id];
    const b = graph.nodes[best];
    if (length(n.x - a.x, n.z - a.z) > length(b.x - a.x, b.z - a.z)) best = id;
  }
  return best;
}

function cone(heights: Float32Array, x: number, z: number, fx: number, fz: number): Item {
  return { kind: "cone", x, y: sample(heights, x, z), z, fx, fz, scale: 1, light: true };
}

/**
 * Point to point through two towns: from the far side of town A out along its spur, round the circuit, and in to the far
 * side of town B. Side streets the routes pass get a cone row and every corner an apex cone.
 */
export function street_routes(graph: RoadGraph, circuit: readonly number[], towns: readonly Town[], heights: Float32Array, ramps: readonly Ramp[] = []): { routes: Route[]; items: Item[] } {
  const atlas = new Atlas(graph, circuit, towns, ramps);
  const candidates: Candidate[] = [];
  const linked = towns.filter((t) => atlas.gates.has(t.id) && (atlas.town_nodes.get(t.id)?.length ?? 0) > 1);
  for (const a of linked)
    for (const b of linked) {
      if (a === b) continue;
      const start = farthest(graph, atlas.town_nodes.get(a.id) ?? [], atlas.gates.get(a.id) ?? 0);
      const end = farthest(graph, atlas.town_nodes.get(b.id) ?? [], atlas.gates.get(b.id) ?? 0);
      // The way round the circuit stays a candidate beside the one the roads between towns open up.
      for (const banned of [null, "local"] as const) {
        const legs = atlas.search(start, end, banned);
        const found = legs && trace(atlas, legs, [a.id, b.id]);
        if (found && !candidates.some((c) => c.legs.join() === found.legs.join())) candidates.push(found);
      }
    }
  const window = WINDOWS.find((w) => candidates.some((c) => fits(c, w))) ?? WINDOWS[0];
  const fitting = candidates.filter((c) => fits(c, window));
  fitting.sort((p, q) => q.turns - p.turns || Math.abs(p.length - AIM_LENGTH) - Math.abs(q.length - AIM_LENGTH) || p.pair[0] - q.pair[0] || p.pair[1] - q.pair[1]);
  const picked: Candidate[] = [];
  const same = (p: Candidate, q: Candidate) => Math.min(...p.pair) === Math.min(...q.pair) && Math.max(...p.pair) === Math.max(...q.pair);
  for (const c of fitting) if (picked.length < STREET_ROUTES && !picked.some((p) => same(p, c))) picked.push(c);
  for (const c of fitting) if (picked.length < STREET_ROUTES && !picked.includes(c)) picked.push(c);

  const used = new Set(picked.flatMap((c) => c.legs.map((l) => atlas.legs[l].piece)));
  const items: Item[] = [];
  // A spur can leave its gate a few degrees off a side street, close enough that the row would stand on the spur.
  const near_route = (x: number, z: number) => picked.some((c) => c.points.some((q) => length(q.x - x, q.z - z) < STREET_HALF + SIDEWALK));
  const blocked = new Set<number>();
  for (const c of picked)
    c.legs.forEach((l, k) => {
      const leg = atlas.legs[l];
      const before = k > 0 ? atlas.legs[c.legs[k - 1]] : null;
      if (before?.kind === "street" && leg.kind === "street" && atlas.corner(before, leg)) {
        const a = atlas.legs[c.legs[k - 1]].points.at(-1) ?? leg.points[0];
        const b = leg.points[0];
        const inset = STREET_HALF - 0.8;
        items.push(cone(heights, b.x + (b.tx - a.tx) * inset, b.z + (b.tz - a.tz) * inset, b.tx, b.tz));
      }
      for (const s of atlas.out.get(leg.from) ?? []) {
        const side = atlas.legs[s];
        if (side.kind !== "street" || used.has(side.piece) || blocked.has(side.piece)) continue;
        blocked.add(side.piece);
        const p = side.points[0];
        const set = STREET_HALF + SIDEWALK + CONE_SET;
        const x = p.x + p.tx * set;
        const z = p.z + p.tz * set;
        for (let u = -STREET_HALF + CONE_GAP / 2; u < STREET_HALF; u += CONE_GAP) {
          const cx = x + p.tz * u;
          const cz = z - p.tx * u;
          if (!near_route(cx, cz)) items.push(cone(heights, cx, cz, p.tx, p.tz));
        }
      }
    });

  const routes = picked.map((c, i): Route => ({
    id: `street-${i + 1}`,
    kind: RouteKind.STREET,
    closed: false,
    points: c.points,
    checkpoints: c.checkpoints,
    gate_hw: STREET_HALF + SIDEWALK,
    length: c.length,
    par_ms: par(c.points, false),
  }));
  return { routes, items };
}

/** Each trail as a point-to-point race: a gate every TRAIL_GATES metres, one before the gap and one where the ramp-out joins. */
export function offroad_routes(trails: readonly Trail[]): Route[] {
  return trails.map((trail): Route => {
    const { points, toe, rejoin } = trail;
    const features = toe >= 0 ? [Math.max(1, toe - TOE_GATE), rejoin] : [];
    const picked: number[] = [];
    let walked = 0;
    let since = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const step = length(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
      walked += step;
      since += step;
      if (features.includes(i)) {
        picked.push(i);
        since = 0;
        continue;
      }
      if (toe >= 0 && i > features[0] && i < rejoin) continue;
      const ahead = features.find((f) => f > i);
      const room = (j: number) => run(points.slice(i, j + 1));
      if (since >= TRAIL_GATES && (ahead === undefined || room(ahead) > GATE_GAP) && room(points.length - 1) > GATE_GAP) {
        picked.push(i);
        since = 0;
      }
    }
    picked.push(points.length - 1);
    const checkpoints = picked.map((i, index) => ({ x: points[i].x, y: points[i].y, z: points[i].z, heading: heading(points[i]), index }));
    return { id: trail.id, kind: RouteKind.OFFROAD, closed: false, points, checkpoints, gate_hw: TRAIL_GATE_HW, length: run(points), par_ms: par(points, false, OFFROAD_SHARE) };
  });
}

import { sample } from "./field";
import { CONE_HEIGHT, CONE_RADIUS } from "./jumps";
import { length } from "./noise";
import type { Junction } from "./road-layers";
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
/** Metres out of a patched junction to a corner's gate: past the fillets and the arm's setback. */
const GATE_MOUTH = 25;
/**
 * The autopilot's driving, fitted to scripts/races.ts: corner speed sqrt(grip × radius), acceleration fading to nothing
 * at TOP, braking BRAKE. Within 5% of the median car on every fitted route.
 */
const BOT = { grip: 6, accel: 6, top: 36, brake: 6, span: 5 } as const;
/** Par over the estimated autopilot time: wide enough that the slowest car's autopilot still makes it. */
const PAR_SHARE = 1.15;
const FILLET_STEP = 2;
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
  half: number;
  /** Half width of the paving across the leg: the asphalt plus any sidewalk. */
  paved: number;
}

const WEIGHT: Record<LegKind, number> = { street: STREET_COST, spur: SPUR_COST, local: SPUR_COST, ring: RING_COST };
// Fitted to scripts/races.ts: roads between towns climb and wind more than drive_time sees, which costs the slowest car most.
const LEG_PAR: Record<LegKind, number> = { street: PAR_SHARE, spur: PAR_SHARE, local: 1.25, ring: PAR_SHARE };

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

export const heading = (p: { tx: number; tz: number }) => Math.atan2(p.tx, p.tz);

/** The race loop as a route: the circuit's own gates, the start line moved to the end as the finish. */
export function circuit_route(road: readonly RoadPoint[], checkpoints: readonly Checkpoint[], share = PAR_SHARE): Route {
  const lap = run(road) + length(road[0].x - road[road.length - 1].x, road[0].z - road[road.length - 1].z);
  const gates = [...checkpoints.slice(1), checkpoints[0]].map((c, index) => ({ ...c, index }));
  return { id: "circuit", kind: RouteKind.CIRCUIT, closed: true, points: [...road], checkpoints: gates, gate_hw: ROAD_HALF, length: lap, par_ms: par(road, true, share), closure: [] };
}

/** The circuit driven the other way from the same start line; a road kicker would face backwards, so only a loop with none gets one. */
export function reverse_circuit(circuit: Route, ramps: readonly Ramp[], share = PAR_SHARE): Route | null {
  if (ramps.some((r) => r.road && circuit.points.some((p) => length(p.x - r.x, p.z - r.z) < ROAD_HALF))) return null;
  const [start, ...rest] = circuit.points;
  const points = [start, ...rest.reverse()].map((p) => ({ ...p, tx: -p.tx, tz: -p.tz }));
  const gates = circuit.checkpoints.slice(0, -1).reverse();
  const finish = circuit.checkpoints[circuit.checkpoints.length - 1];
  const checkpoints = [...gates, finish].map((c, index) => ({ ...c, heading: c.heading + Math.PI, index }));
  return { ...circuit, id: "circuit-rev", points, checkpoints, par_ms: par(points, true, share) };
}

class Atlas {
  readonly legs: Leg[] = [];
  readonly out = new Map<number, number[]>();
  private readonly patches = new Map<string, Junction>();
  /** Every leg's way out of each node, one-way legs included, for closing the side roads a route passes. */
  readonly arms = new Map<number, Leg[]>();
  readonly town_nodes = new Map<number, number[]>();
  readonly gates = new Map<number, number>();
  private pieces = 0;

  constructor(
    readonly graph: RoadGraph,
    circuit: readonly number[],
    towns: readonly Town[],
    junctions: readonly Junction[],
    private readonly ramps: readonly Ramp[] = [],
  ) {
    for (const j of junctions) this.patches.set(`${j.x},${j.z}`, j);
    const town_of = (x: number, z: number) => towns.find((t) => length(t.x - x, t.z - z) <= t.radius + 1);
    for (const edge of graph.edges) {
      if (circuit.includes(edge.id)) continue;
      if (edge.kind === "street") {
        this.add(edge.a, edge.b, "street", edge.points, edge.half, edge.half + SIDEWALK);
        const town = town_of(edge.points[0].x, edge.points[0].z);
        if (!town) continue;
        const list = this.town_nodes.get(town.id) ?? [];
        for (const node of [edge.a, edge.b]) if (!list.includes(node)) list.push(node);
        this.town_nodes.set(town.id, list);
        continue;
      }
      this.add(edge.a, edge.b, edge.kind === "local" ? "local" : "spur", edge.points, edge.half, edge.half);
      if (edge.kind !== "highway") continue;
      const gate = graph.nodes[edge.a];
      const town = town_of(gate.x, gate.z);
      if (town && !this.gates.has(town.id)) this.gates.set(town.id, edge.a);
    }
    // A circuit with one join stays a closed loop on it: no leg leads anywhere new.
    for (const id of circuit) {
      const leg = graph.edges[id];
      if (!leg.closed && leg.a !== leg.b) this.add(leg.a, leg.b, "ring", leg.points, leg.half, leg.half, this.kicked(leg.points));
    }
  }

  /** Points of `points` (outward from `node`) the junction patch there covers; 0 at a node with none. */
  mouth(node: number, points: readonly RoadPoint[]): number {
    const at = this.graph.nodes[node];
    const junction = this.patches.get(`${at.x},${at.z}`);
    if (!junction || points.length < 2) return 0;
    const arm = junction.arms.findIndex((a) => a.points.length > 1 && a.points[1].x === points[1].x && a.points[1].z === points[1].z);
    return arm < 0 ? 0 : junction.patch.mouths[arm];
  }

  // A road kicker is a wall from behind: the circuit past one is one way.
  private kicked(points: readonly RoadPoint[]): boolean {
    return this.ramps.some((r) => r.road && points.some((p) => length(p.x - r.x, p.z - r.z) < r.length + ROAD_HALF));
  }

  private add(a: number, b: number, kind: LegKind, points: RoadPoint[], half: number, paved: number, one_way = false) {
    const piece = this.pieces++;
    const metres = run(points);
    const ways = [{ from: a, to: b, kind, piece, points, length: metres, half, paved }];
    const back = { from: b, to: a, kind, piece, points: flip(points), length: metres, half, paved };
    for (const arm of [ways[0], back]) this.arms.set(arm.from, [...(this.arms.get(arm.from) ?? []), arm]);
    if (!one_way) ways.push(back);
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
  const gate = (p: RoadPoint) => {
    const last = gates[gates.length - 1];
    if (last && length(last.x - p.x, last.z - p.z) < GATE_GAP) gates.pop();
    gates.push({ x: p.x, y: p.y, z: p.z, heading: heading(p) });
  };
  legs.forEach((l, k) => {
    const leg = atlas.legs[l];
    const before = k > 0 ? atlas.legs[legs[k - 1]] : null;
    if (before && atlas.corner(before, leg)) {
      turns++;
      // A gate on a patched junction would stand in its mouth.
      gate(atlas.mouth(leg.from, leg.points) > 0 ? at_distance(leg.points, Math.min(GATE_MOUTH, leg.length / 2)) : leg.points[0]);
    }
    if (leg.kind !== "street")
      for (let s = GATE_SPACING, walked = 0, i = 1; i < leg.points.length; i++) {
        walked += length(leg.points[i].x - leg.points[i - 1].x, leg.points[i].z - leg.points[i - 1].z);
        if (walked >= s && leg.length - walked > GATE_GAP) {
          gate(leg.points[i]);
          s += GATE_SPACING;
        }
      }
    const into = before && atlas.mouth(leg.from, flip(before.points.slice(-2)));
    const out = before && atlas.mouth(leg.from, leg.points);
    if (!into || !out || into >= points.length || out >= leg.points.length - 1) {
      points.push(...(k === 0 ? leg.points : leg.points.slice(1)));
      return;
    }
    points.length -= into;
    points.push(...fillet(points[points.length - 1], atlas.graph.nodes[leg.from], leg.points[out]), ...leg.points.slice(out));
  });
  gate(points[points.length - 1]);
  return { legs, points, checkpoints: gates.map((g, index) => ({ ...g, index })), turns, length: run(points), pair };
}

/** The way through a patched junction, from one arm's mouth to the next's, bent round the node like the curbs either side. */
function fillet(from: RoadPoint, node: { x: number; y: number; z: number }, to: RoadPoint): RoadPoint[] {
  const steps = Math.ceil((length(node.x - from.x, node.z - from.z) + length(to.x - node.x, to.z - node.z)) / FILLET_STEP);
  const out: RoadPoint[] = [];
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const u = 1 - t;
    const tx = u * (node.x - from.x) + t * (to.x - node.x);
    const tz = u * (node.z - from.z) + t * (to.z - node.z);
    const len = length(tx, tz) || 1;
    out.push({
      x: u * u * from.x + 2 * t * u * node.x + t * t * to.x,
      y: u * u * from.y + 2 * t * u * node.y + t * t * to.y,
      z: u * u * from.z + 2 * t * u * node.z + t * t * to.z,
      tx: tx / len,
      tz: tz / len,
    });
  }
  return out;
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
 * A cone row across the paving of every road the route passes but does not take, out past the junction's curbs: just
 * past the sidewalk where the roads overlap, past the patch's mouth where the junction has one.
 */
function closure(atlas: Atlas, c: Candidate, heights: Float32Array): Route["closure"] {
  const pieces = new Set(c.legs.map((l) => atlas.legs[l].piece));
  const solids: Route["closure"] = [];
  const closed = new Set<number>();
  for (const l of c.legs) {
    const node = atlas.legs[l].from;
    const through = Math.max(...c.legs.filter((m) => atlas.legs[m].from === node || atlas.legs[m].to === node).map((m) => atlas.legs[m].half));
    // A spur can leave its gate a few degrees off a side street, close enough that the row would stand on the spur.
    const near_route = (x: number, z: number) => c.points.some((q) => length(q.x - x, q.z - z) < through + SIDEWALK);
    for (const side of atlas.arms.get(node) ?? []) {
      if (pieces.has(side.piece) || closed.has(side.piece)) continue;
      closed.add(side.piece);
      const mouth = atlas.mouth(node, side.points);
      const set = Math.max(through + SIDEWALK, mouth > 0 ? run(side.points.slice(0, mouth + 1)) : 0) + CONE_SET;
      const p = at_distance(side.points, set);
      for (let u = -side.paved + CONE_GAP / 2; u < side.paved; u += CONE_GAP) {
        const x = p.x + p.tz * u;
        const z = p.z - p.tx * u;
        if (!near_route(x, z)) solids.push({ kind: "circle", x, y: sample(heights, x, z), z, radius: CONE_RADIUS, height: CONE_HEIGHT });
      }
    }
  }
  return solids;
}

/** The point `metres` along `points`, or its last point. */
function at_distance(points: readonly RoadPoint[], metres: number): RoadPoint {
  for (let walked = 0, i = 1; i < points.length; i++) {
    walked += length(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    if (walked >= metres) return points[i];
  }
  return points[points.length - 1];
}

/**
 * Point to point through two towns: from the far side of town A out along its spur, round the circuit, and in to the far
 * side of town B. Every street corner gets an apex cone; each route closes the roads it passes while it is raced.
 */
export function street_routes(graph: RoadGraph, circuit: readonly number[], towns: readonly Town[], heights: Float32Array, junctions: readonly Junction[], ramps: readonly Ramp[] = []): { routes: Route[]; items: Item[] } {
  const atlas = new Atlas(graph, circuit, towns, junctions, ramps);
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

  const items: Item[] = [];
  for (const c of picked)
    c.legs.forEach((l, k) => {
      const leg = atlas.legs[l];
      const before = k > 0 ? atlas.legs[c.legs[k - 1]] : null;
      if (before?.kind !== "street" || leg.kind !== "street" || !atlas.corner(before, leg) || atlas.mouth(leg.from, leg.points) > 0) return;
      const a = before.points.at(-1) ?? leg.points[0];
      const b = leg.points[0];
      const inset = STREET_HALF - 0.8;
      items.push(cone(heights, b.x + (b.tx - a.tx) * inset, b.z + (b.tz - a.tz) * inset, b.tx, b.tz));
    });

  const routes = picked.map((c, i): Route => ({
    id: `street-${i + 1}`,
    kind: RouteKind.STREET,
    closed: false,
    points: c.points,
    checkpoints: c.checkpoints,
    gate_hw: STREET_HALF + SIDEWALK,
    length: c.length,
    par_ms: par(c.points, false, Math.max(...c.legs.map((l) => LEG_PAR[atlas.legs[l].kind]))),
    closure: closure(atlas, c, heights),
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
    return { id: trail.id, kind: RouteKind.OFFROAD, closed: false, points, checkpoints, gate_hw: TRAIL_GATE_HW, length: run(points), par_ms: par(points, false, OFFROAD_SHARE), closure: [] };
  });
}

/** One way down a road edge from its first point: a gate every GATE_SPACING metres, the finish on its last point. */
export function descent_route(points: RoadPoint[], share = PAR_SHARE): Route {
  const picked: number[] = [];
  let walked = 0;
  let since = 0;
  const total = run(points);
  for (let i = 1; i < points.length - 1; i++) {
    const step = length(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    walked += step;
    since += step;
    if (since >= GATE_SPACING && total - walked > GATE_GAP) {
      picked.push(i);
      since = 0;
    }
  }
  picked.push(points.length - 1);
  const checkpoints = picked.map((i, index) => ({ x: points[i].x, y: points[i].y, z: points[i].z, heading: heading(points[i]), index }));
  return { id: "descent", kind: RouteKind.SPRINT, closed: false, points, checkpoints, gate_hw: ROAD_HALF, length: total, par_ms: par(points, false, share), closure: [] };
}

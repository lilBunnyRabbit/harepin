import { spur_edges } from "./graph";
import { junction_patch, type Arm, type Patch, type Reach } from "./junction";
import type { Rgb } from "./mesh";
import { offset_reach, type Roads } from "./roads";
import { ROAD_HALF, SIDEWALK, type RoadEdge, type RoadPoint, type WorldData } from "./types";

const SURFACE_LIFT = 0.025;
// Spurs sit a hair above streets and sidewalks so their mouth covers the street's sidewalk at the town gate.
const SPUR_LIFT = 0.035;
const RING_LIFT = 0.03;
const MARK_LIFT = 0.045;
const MARK_HALF = 0.15;
const EDGE_INSET = 0.3;
const EDGE_WIDTH = 0.25;
const DASH = 6;
const DASH_ON = 3;
const SPUR_MARK_CLEAR = 8;
const SPUR_MOUTH = 30;
const CURB = 8;
// A town corner's curb radius: 4-6 m in real grids, tight enough that the sidewalk still fits round it.
const STREET_CURB = 5;
const MOUTH_CLEAR = 5;
const GIVE_WAY_OUT = 0.3;
const GIVE_WAY_WIDTH = 0.4;
/** |sin| between two streets at a node below which they run straight on. */
const STRAIGHT_ON = 0.1;

export interface RoadTones {
  asphalt: Rgb;
  sidewalk: Rgb;
  line: Rgb;
  edge_line: Rgb;
}

// Streets run node to node; stretching each end by its half width fills the crossing square.
function extended(points: RoadPoint[], by: number): RoadPoint[] {
  const a = points[0];
  const b = points[points.length - 1];
  return [{ ...a, x: a.x - a.tx * by, z: a.z - a.tz * by }, ...points, { ...b, x: b.x + b.tx * by, z: b.z + b.tz * by }];
}

function nearest_index(road: RoadPoint[], x: number, z: number): number {
  let best = 0;
  let dist = Infinity;
  road.forEach((p, i) => {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}

interface ArmStyle {
  radius: number;
  rank: number;
  lift: number;
  lined: boolean;
  sidewalk: number;
}

const RING_ARM: ArmStyle = { radius: CURB, rank: 2, lift: RING_LIFT, lined: true, sidewalk: 0 };
const SPUR_ARM: ArmStyle = { radius: CURB, rank: 1, lift: SPUR_LIFT, lined: true, sidewalk: 0 };
// Below a spur, so a road between towns gives way where it branches off one.
const LOCAL_ARM: ArmStyle = { ...SPUR_ARM, rank: 0.5 };
const STREET_ARM: ArmStyle = { radius: STREET_CURB, rank: 0, lift: SURFACE_LIFT, lined: false, sidewalk: SIDEWALK };

interface ArmEnd {
  edge: RoadEdge;
  start: boolean;
}

/** Points trimmed off each end of an edge, and per end the first point each side of its arm runs its own rim from. */
export interface Trim {
  mouths: [number, number];
  sides: [[number, number], [number, number]];
}

// An arm reads its edge from the node outward, at most halfway along so the patch at the far end keeps its half.
function arm_of({ edge, start }: ArmEnd, reach: readonly Reach[], style: ArmStyle): Arm {
  const n = edge.points.length;
  const most = Math.floor((n - 1) / 2);
  const points: RoadPoint[] = [];
  const out_reach: Reach[] = [];
  for (let k = 0; k <= most; k++) {
    const i = start ? k : edge.closed ? (n - k) % n : n - 1 - k;
    const p = edge.points[i];
    points.push(start ? p : { ...p, tx: -p.tx, tz: -p.tz });
    out_reach.push(start ? reach[i] : [-reach[i][1], -reach[i][0]]);
  }
  return { points, reach: out_reach, half: edge.half, clear: edge.half + style.sidewalk, radius: style.radius, rank: style.rank, lift: style.lift, lined: style.lined };
}

export interface Junction {
  x: number;
  z: number;
  arms: Arm[];
  patch: Patch;
}

export interface Junctions {
  patched: Junction[];
  /** Road indices of circuit junctions too sharp or cramped for a patch: the side road still overlaps the ring there. */
  loose: number[];
  trims: Map<number, Trim>;
  /** Circuit edge id to where the circuit runs along it. */
  ring_at: Map<number, RingSpan>;
}

/** The road index of a circuit edge's first point, and whether the circuit drives the edge from a to b or back. */
export interface RingSpan {
  at: number;
  forward: boolean;
}

/** Road index of edge point `i` on a circuit edge. */
function ring_point({ at, forward }: RingSpan, i: number, n: number): number {
  return (forward ? at + i : at - i + n) % n;
}

/** Road segment that edge segment `k` (points k to k + 1) of a circuit edge is driven as. */
function ring_segment({ at, forward }: RingSpan, k: number, n: number): number {
  return (forward ? at + k : at - k - 1 + n) % n;
}

// The mainland circuit drives some edges from b to a; its road then runs the edge's points backwards.
function ring_span(road: RoadPoint[], edge: RoadEdge): RingSpan {
  const n = road.length;
  const at = nearest_index(road, edge.points[0].x, edge.points[0].z);
  const q = edge.points[1];
  const ahead = road[(at + 1) % n];
  const behind = road[(at - 1 + n) % n];
  return { at, forward: (ahead.x - q.x) ** 2 + (ahead.z - q.z) ** 2 <= (behind.x - q.x) ** 2 + (behind.z - q.z) ** 2 };
}

export type RoadData = Pick<WorldData, "road" | "graph" | "circuit">;

export function road_junctions(data: RoadData): Junctions {
  const { road, graph, circuit } = data;
  const n = road.length;
  const spurs = spur_edges(graph, circuit);
  const ring_reach = offset_reach(road, true);
  const ring_at = new Map(circuit.map((id) => [id, ring_span(road, graph.edges[id])]));
  const style = (edge: RoadEdge) => (ring_at.has(edge.id) ? RING_ARM : edge.kind === "highway" ? SPUR_ARM : edge.kind === "local" ? LOCAL_ARM : STREET_ARM);
  const reach_of = (edge: RoadEdge): readonly Reach[] => {
    const span = ring_at.get(edge.id);
    if (span === undefined) return offset_reach(edge.points, false);
    return edge.points.map((_, i): Reach => {
      const r = ring_reach[ring_point(span, i, n)];
      return span.forward ? r : [-r[1], -r[0]];
    });
  };

  const trims = new Map<number, Trim>();
  const patched: Junction[] = [];
  const loose: number[] = [];
  const on_ring = new Set(circuit.flatMap((id) => [graph.edges[id].a, graph.edges[id].b]));
  for (const node of graph.nodes) {
    const ends: ArmEnd[] = graph.edges.flatMap((edge) => [...(edge.a === node.id ? [{ edge, start: true }] : []), ...(edge.b === node.id ? [{ edge, start: false }] : [])]);
    if (!ends.some(({ edge }) => spurs.includes(edge)) && !street_corner(ends)) continue;
    const arms = ends.map((end) => arm_of(end, reach_of(end.edge), style(end.edge)));
    const patch = junction_patch(node.x, node.z, arms);
    if (!patch) {
      // A gate in town is no circuit mouth, however near the circuit's nearest point lies.
      if (on_ring.has(node.id)) loose.push(nearest_index(road, node.x, node.z));
      continue;
    }
    ends.forEach(({ edge, start }, i) => {
      const t = trims.get(edge.id) ?? untrimmed();
      t.mouths[start ? 0 : 1] = patch.mouths[i];
      t.sides[start ? 0 : 1] = patch.sides[i];
      trims.set(edge.id, t);
    });
    patched.push({ x: node.x, z: node.z, arms, patch });
  }
  return { patched, loose, trims, ring_at };
}

// Town streets meeting at a crossroads, a T or an L; a street running straight on through a node needs no patch.
function street_corner(ends: readonly ArmEnd[]): boolean {
  if (ends.length < 2 || ends.some(({ edge }) => edge.kind !== "street")) return false;
  if (ends.length > 2) return true;
  const [a, b] = ends.map(({ edge, start }) => (start ? edge.points[0] : edge.points[edge.points.length - 1]));
  return Math.abs(a.tx * b.tz - a.tz * b.tx) > STRAIGHT_ON;
}

function untrimmed(): Trim {
  return { mouths: [0, 0], sides: [[0, 0], [0, 0]] };
}

/** 1 for each circuit segment a junction patch covers: the circuit's own strip, curbs and posts stop there. */
export function ring_mouths(data: RoadData, junctions: Junctions): Uint8Array {
  const { road, graph } = data;
  const n = road.length;
  const inside = new Uint8Array(n);
  for (const [id, span] of junctions.ring_at) {
    const { mouths } = junctions.trims.get(id) ?? untrimmed();
    const { points, closed } = graph.edges[id];
    const end = closed ? points.length : points.length - 1;
    for (let k = 0; k < mouths[0]; k++) inside[ring_segment(span, k, n)] = 1;
    for (let k = 1; k <= mouths[1]; k++) inside[ring_segment(span, end - k, n)] = 1;
  }
  return inside;
}

/** Circuit samples past a patch's mouth still kept clear: a post there would stand on the curb's last bend. */
const MOUTH_MARGIN = 2;
/** Outer edge of a circuit kerb, metres off the centre line. */
export const KERB_OUT = ROAD_HALF + 0.9;
/** Circuit samples either side of a kink tighter than a kerb's offset, where the road between towns meets a street. */
const FOLD_CLEAR = 4;
/** Circuit samples either side of a junction too sharp for a patch, where the side road just overlaps the circuit. */
const LOOSE_CLEAR = 7;

/** Circuit samples a road leaves the loop across; curbs and posts there would wall off the side road. */
export function roadside_clear(data: RoadData, junctions: Junctions = road_junctions(data)): Set<number> {
  const n = data.road.length;
  const clear = new Set<number>();
  const around = (s: number, reach: number) => {
    for (let k = -reach; k <= reach; k++) clear.add((s + k + n) % n);
  };
  ring_mouths(data, junctions).forEach((v, s) => v && around(s, MOUTH_MARGIN));
  for (const s of junctions.loose) around(s, LOOSE_CLEAR);
  data.road.forEach((p, s) => folds(p, data.road[(s + 1) % n]) && around(s, FOLD_CLEAR));
  return clear;
}

// The kerb's edge from p to q runs backwards: the circuit turns tighter there than the kerb sits off its centre line.
function folds(p: RoadPoint, q: RoadPoint): boolean {
  const along = (q.x - p.x) * p.tx + (q.z - p.z) * p.tz;
  const turn = (q.tx - p.tx) * p.tz - (q.tz - p.tz) * p.tx;
  return along - KERB_OUT * Math.abs(turn) <= 0;
}

export function road_layers(data: RoadData, out: Roads, tones: RoadTones, junctions: Junctions = road_junctions(data)): Roads {
  const { road, graph, circuit } = data;
  const n = road.length;
  const spurs = spur_edges(graph, circuit);
  const { patched, loose, trims } = junctions;
  const trim = (id: number): Trim => trims.get(id) ?? untrimmed();
  for (const { x, z, arms, patch } of patched) {
    const chunk = out.chunk(x, z);
    if (chunk < 0) continue;
    out.patch(out.surface[chunk], patch, tones.asphalt);
    for (const line of patch.lines) out.rim_line(out.marks[chunk], line, EDGE_INSET, EDGE_INSET + EDGE_WIDTH, MARK_LIFT, tones.edge_line);
    for (const curb of patch.curbs) out.rim_line(out.surface[chunk], curb, -SIDEWALK, 0, SURFACE_LIFT, tones.sidewalk);
    for (const i of patch.minor) {
      const arm = arms[i];
      out.give_way(out.marks[chunk], arm.points[patch.mouths[i]], arm.half - EDGE_INSET, GIVE_WAY_OUT, GIVE_WAY_WIDTH, MARK_LIFT, tones.line);
    }
  }

  const inside = ring_mouths(data, junctions);
  const open = (s: number) => !inside[s];
  const clear_of_mouths = (s: number) => open(s) && loose.every((m) => Math.abs(((s - m + n * 1.5) % n) - n / 2) > MOUTH_CLEAR);
  out.strip(out.surface, road, true, -ROAD_HALF, ROAD_HALF, RING_LIFT, open, tones.asphalt);
  out.strip(out.marks, road, true, -MARK_HALF, MARK_HALF, MARK_LIFT, (s) => s % DASH < DASH_ON, tones.line);
  out.strip(out.marks, road, true, ROAD_HALF - 0.55, ROAD_HALF - 0.3, MARK_LIFT, clear_of_mouths, tones.edge_line);
  out.strip(out.marks, road, true, -ROAD_HALF + 0.3, -ROAD_HALF + 0.55, MARK_LIFT, clear_of_mouths, tones.edge_line);

  // Spurs only come near streets where they leave their town's gate.
  const gates = spurs.flatMap((e) => e.points.slice(0, SPUR_MOUTH));
  const under_spur = (p: RoadPoint, reach: number) => gates.some((q) => (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < reach * reach);
  const edge_lines = (points: RoadPoint[], half: number, keep: (s: number) => boolean) => {
    for (const side of [-1, 1]) {
      const at = side * (half - EDGE_INSET - EDGE_WIDTH / 2);
      out.strip(out.marks, points, false, at - EDGE_WIDTH / 2, at + EDGE_WIDTH / 2, MARK_LIFT, keep, tones.edge_line);
    }
  };
  for (const edge of graph.edges) {
    if (junctions.ring_at.has(edge.id)) continue;
    const { points, half } = edge;
    const last = points.length - 1;
    const { mouths, sides } = trim(edge.id);
    if (edge.kind !== "street") {
      const from = mouths[0] || SPUR_MARK_CLEAR + 1;
      const to = last - (mouths[1] || SPUR_MARK_CLEAR);
      const marked = (s: number) => s >= from && s < to;
      out.strip(out.surface, points, false, -half, half, SPUR_LIFT, (s) => s >= mouths[0] && s < last - mouths[1], tones.asphalt);
      out.strip(out.marks, points, false, -MARK_HALF, MARK_HALF, MARK_LIFT, (s) => marked(s) && s % DASH < DASH_ON, tones.line);
      edge_lines(points, half, marked);
      continue;
    }
    // Sidewalks start at the crossing street's edge, so two sidewalks only ever overlap in the same colour at a block corner.
    const from = mouths[0] ? mouths[0] : -1;
    const to = mouths[1] ? last - mouths[1] : last + 1;
    out.strip(out.surface, extended(points, half), false, -half, half, SURFACE_LIFT, (e) => e - 1 >= from && e - 1 < to, tones.asphalt);
    const step = Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z) || 1;
    const ends = Math.ceil(half / step);
    const clear = Math.ceil((half + SIDEWALK) / step);
    const near_spur = points.map((p) => under_spur(p, half + SIDEWALK + 6));
    const marked = (s: number) => s >= Math.max(clear, mouths[0]) && s < last - Math.max(clear, mouths[1]) && !near_spur[s] && !near_spur[s + 1];
    // A patched far end reads the street backwards, so its arm's -1 side is the strip's +1 side.
    const walkway = (side: 0 | 1) => {
      const lo = mouths[0] ? sides[0][side] : ends;
      const hi = last - (mouths[1] ? sides[1][1 - side] : ends);
      return (s: number) => s >= lo && s < hi;
    };
    out.strip(out.surface, points, false, -half - SIDEWALK, -half, SURFACE_LIFT, walkway(0), tones.sidewalk);
    out.strip(out.surface, points, false, half, half + SIDEWALK, SURFACE_LIFT, walkway(1), tones.sidewalk);
    edge_lines(points, half, marked);
    out.strip(out.marks, points, false, -MARK_HALF, MARK_HALF, MARK_LIFT, (s) => marked(s) && s % DASH < DASH_ON, tones.line);
  }
  return out;
}

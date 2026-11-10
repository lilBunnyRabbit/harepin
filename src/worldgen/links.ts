import { split_edge, type Join } from "./graph";
import { length } from "./noise";
import type { Path } from "./path";
import { APPROACH, CROSS_COST, Router, SHAPE_GRADE, spur_need, spur_points, unkink, type Crossing, type Exit, type LinkPath, type Port, type Way } from "./route";
import { LOCAL_HALF, type RoadEdge, type RoadGraph, type RoadNode, type RoadPoint, type Town } from "./types";

/** What a metre of road already built costs against a new one, so later links ride the trunks earlier ones laid. */
const DISCOUNT = 0.35;
/** Links off the towns' spanning tree are built only under this cost over straight distance. */
const DETOUR = 1.6;
const BRANCH_STEP = 10;
const NODE_CLEAR = 40;
const CROSS_GRADE = 0.06;
const CROSS_STEP = 20;
const GRADE_SPAN = 5;
/** Road points either side of a new junction the road must run straight over, within STRAIGHT (cos 20°). */
const STRAIGHT_SPAN = 15;
const STRAIGHT = 0.94;
// cos 50°: a road leaves a node at least this far from every road already there, so its junction gets a patch.
const SQUARE = 0.6427876096865394;
const TRIES = 4;
const PIN = 0.01;
// A* cells this close to an approach point would bend the straight run into the junction.
const CELL_CLEAR = 24;
const END_CLEAR = 56;

interface Anchor {
  x: number;
  y: number;
  z: number;
  into: Way;
  out: Way;
  node: (graph: RoadGraph) => number;
}

interface Piece {
  path: Path;
  points: RoadPoint[];
  from: Anchor;
  to: Anchor;
}

type TownExit = Exit & { node: RoadNode };

/** The town grid's four axes at `node` that leave it at least 50° from every road already there. */
export function ways(graph: RoadGraph, node: RoadNode, town: Town): Way[] {
  const used: Way[] = [];
  for (const e of graph.edges) {
    const p = e.points;
    if (e.a === node.id) used.push(unit(p[1].x - p[0].x, p[1].z - p[0].z));
    if (e.b === node.id) used.push(unit(p[p.length - 2].x - p[p.length - 1].x, p[p.length - 2].z - p[p.length - 1].z));
  }
  const axes: Way[] = [
    { x: town.ux, z: town.uz },
    { x: -town.ux, z: -town.uz },
    { x: -town.uz, z: town.ux },
    { x: town.uz, z: -town.ux },
  ];
  return axes.filter((a) => used.every((u) => a.x * u.x + a.z * u.z < SQUARE));
}

/** The free way at `node` that points most toward (x, z); null when every free way points away. */
export function way_toward(graph: RoadGraph, node: RoadNode, town: Town, x: number, z: number): Way | null {
  const to = unit(x - node.x, z - node.z);
  let best: Way | null = null;
  for (const w of ways(graph, node, town)) if (w.x * to.x + w.z * to.z > (best ? best.x * to.x + best.z * to.z : 0)) best = w;
  return best;
}

function unit(x: number, z: number): Way {
  const len = length(x, z) || 1;
  return { x: x / len, z: z / len };
}

function run(points: readonly RoadPoint[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + length(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  return out;
}

// Branching or crossing on a bend would aim the approach back at the same road further round it.
function square_at(points: readonly RoadPoint[], at: number, closed: boolean): boolean {
  const n = points.length;
  const lo = closed ? points[(at - STRAIGHT_SPAN + n) % n] : points[at - STRAIGHT_SPAN];
  const hi = closed ? points[(at + STRAIGHT_SPAN) % n] : points[at + STRAIGHT_SPAN];
  if (!lo || !hi || lo.tx * hi.tx + lo.tz * hi.tz < STRAIGHT) return false;
  const p = points[at];
  for (const side of [-1, 1]) {
    const x = p.x - p.tz * side * APPROACH;
    const z = p.z + p.tx * side * APPROACH;
    if (points.some((q) => length(q.x - x, q.z - z) < APPROACH - 1)) return false;
  }
  return true;
}

function in_town(town: Town, x: number, z: number): boolean {
  return length(town.x - x, town.z - z) <= town.radius + 1;
}

/** Relative-neighbourhood pairs of towns, the spanning tree's first, each group shortest first. */
export function town_pairs(towns: readonly Town[]): { a: Town; b: Town; tree: boolean }[] {
  const d = (a: Town, b: Town) => length(a.x - b.x, a.z - b.z);
  const pairs: { a: Town; b: Town; tree: boolean }[] = [];
  for (let i = 0; i < towns.length; i++)
    for (let j = i + 1; j < towns.length; j++) {
      const [a, b] = [towns[i], towns[j]];
      const ab = d(a, b);
      if (!towns.some((c) => c !== a && c !== b && Math.max(d(a, c), d(b, c)) < ab)) pairs.push({ a, b, tree: false });
    }
  pairs.sort((p, q) => d(p.a, p.b) - d(q.a, q.b) || p.a.id - q.a.id || p.b.id - q.b.id);
  const group = towns.map((t) => t.id);
  const root = (id: number): number => (group[id] === id ? id : (group[id] = root(group[id])));
  for (const p of pairs) {
    const [ra, rb] = [root(p.a.id), root(p.b.id)];
    if (ra === rb) continue;
    group[ra] = rb;
    p.tree = true;
  }
  return [...pairs.filter((p) => p.tree), ...pairs.filter((p) => !p.tree)];
}

/** Road metres from `town` to every node over roads off the circuit; the town's own nodes are 0. */
function network(graph: RoadGraph, ring: RoadEdge, town: Town): number[] {
  const dist = graph.nodes.map((n) => (in_town(town, n.x, n.z) ? 0 : Infinity));
  const roads = graph.edges.filter((e) => e.kind !== "street" && e !== ring).map((e) => ({ e, len: run(e.points).at(-1) ?? 0 }));
  for (let changed = true; changed; ) {
    changed = false;
    for (const { e, len } of roads) {
      if (dist[e.a] + len < dist[e.b]) {
        dist[e.b] = dist[e.a] + len;
        changed = true;
      }
      if (dist[e.b] + len < dist[e.a]) {
        dist[e.a] = dist[e.b] + len;
        changed = true;
      }
    }
  }
  return dist;
}

export interface LinkContext {
  graph: RoadGraph;
  /** The circuit as one closed edge, before it is split at its joins. */
  ring: RoadEdge;
  road: RoadPoint[];
  towns: readonly Town[];
  heights: Float32Array;
  router: Router;
  joins: Join[];
  /** Circuit indices a link may not cross at: the start grid, gates, the switchback. */
  keep: (at: number) => boolean;
}

/** Local roads between towns: a relative-neighbourhood graph routed over open ground, crossing the circuit square. */
export function link_towns(ctx: LinkContext) {
  for (const pair of town_pairs(ctx.towns)) link(ctx, pair.a, pair.b, pair.tree);
}

function link(ctx: LinkContext, a: Town, b: Town, tree: boolean): boolean {
  const { graph, ring, router } = ctx;
  const exits = [exit(graph, a, b), exit(graph, b, a)];
  const net_a = network(graph, ring, a);
  const ridden = Math.min(...graph.nodes.filter((n) => in_town(b, n.x, n.z)).map((n) => net_a[n.id])) * DISCOUNT;
  const branch_a = branches(ctx, net_a);
  const branch_b = branches(ctx, network(graph, ring, b));
  const crossings = crossing_points(ctx);
  const banned = new Set<string>();
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const sources = ports(exits[0], branch_a, banned, "a");
    const goals = ports(exits[1], branch_b, banned, "b");
    const open = crossings.filter((c) => !banned.has(`x${c.at}`));
    const found = router.link(
      sources.map((s) => s.port),
      goals.map((g) => g.port),
      open.map((c) => c.crossing),
      exits.filter((e): e is TownExit => e !== null),
    );
    if (!found || found.cost >= ridden) return false;
    if (!tree && found.cost - found.crossings.length * CROSS_COST > DETOUR * length(a.x - b.x, a.z - b.z)) return false;
    const start = sources[found.source];
    const end = goals[found.goal];
    const chain = [start.anchor, ...found.crossings.map((c, k) => cross_anchor(ctx, open[c].at, found.forward[k])), end.anchor];
    const shaped = pieces(ctx, chain, found);
    if (typeof shaped === "number") {
      if (shaped > 0) banned.add(`x${open[found.crossings[shaped - 1]].at}`);
      if (shaped < found.crossings.length) banned.add(`x${open[found.crossings[shaped]].at}`);
      if (shaped === 0) banned.add(start.key);
      if (shaped === found.crossings.length) banned.add(end.key);
      continue;
    }
    for (const { path, points, from, to } of shaped) {
      const ia = from.node(graph);
      const ib = to.node(graph);
      graph.edges.push({ id: graph.edges.length, a: ia, b: ib, kind: "local", half: LOCAL_HALF, closed: false, points });
      router.claim(path);
    }
    return true;
  }
  return false;
}

/** Each run between anchors, shaped and graded; the index of the first that cannot hold the grade instead. */
function pieces(ctx: LinkContext, chain: Anchor[], found: LinkPath): Piece[] | number {
  const out: Piece[] = [];
  for (let k = 0; k + 1 < chain.length; k++) {
    const from = chain[k];
    const to = chain[k + 1];
    const clear = ([x, z]: [number, number]) => length(x - from.out.x, z - from.out.z) > CELL_CLEAR && length(x - to.into.x, z - to.into.z) > CELL_CLEAR;
    const cells: Path = [[from.x, from.z], [from.out.x, from.out.z], ...found.legs[k].filter(clear), [to.into.x, to.into.z], [to.x, to.z]];
    const path = unkink(cells, from.y, to.y, 2, true);
    if (spur_need(path, from.y, to.y) > SHAPE_GRADE) return k;
    const points = spur_points(path, ctx.heights, from.y, to.y);
    if (Math.abs(points[0].y - from.y) > PIN || Math.abs(points[points.length - 1].y - to.y) > PIN) return k;
    // Smoothing can still pull a bend across a band the cells went round; the runs into the anchors cross bands on purpose.
    const ends = Math.ceil(END_CLEAR / 2);
    if (!ctx.router.clear(points, ends, points.length - ends)) return k;
    out.push({ path, points, from, to });
  }
  return out;
}

/** The street node and grid way a town leaves by toward `to`: the free way whose first APPROACH metres end nearest it. */
function exit(graph: RoadGraph, town: Town, to: Town): TownExit | null {
  let best: TownExit | null = null;
  let best_d = Infinity;
  const streets = new Set(graph.edges.filter((e) => e.kind === "street").flatMap((e) => [e.a, e.b]));
  for (const node of graph.nodes) {
    if (!streets.has(node.id) || !in_town(town, node.x, node.z)) continue;
    for (const way of ways(graph, node, town)) {
      const x = node.x + way.x * APPROACH;
      const z = node.z + way.z * APPROACH;
      if (length(x - town.x, z - town.z) <= length(node.x - town.x, node.z - town.z)) continue;
      const d = length(x - to.x, z - to.z);
      if (d < best_d) {
        best_d = d;
        best = { town, x: node.x, z: node.z, way, node };
      }
    }
  }
  return best;
}

interface Branch {
  edge: RoadEdge;
  point: RoadPoint;
  side: number;
  cost: number;
}

/** Points along the roads a town already reaches where a link may branch off square. */
function branches(ctx: LinkContext, net: number[]): Branch[] {
  const { graph, ring, towns } = ctx;
  const out: Branch[] = [];
  for (const edge of graph.edges) {
    if (edge.kind === "street" || edge === ring) continue;
    const arc = run(edge.points);
    const total = arc[arc.length - 1];
    for (let i = BRANCH_STEP; i < edge.points.length - 1; i += BRANCH_STEP) {
      if (arc[i] < NODE_CLEAR || total - arc[i] < NODE_CLEAR) continue;
      const p = edge.points[i];
      const cost = Math.min(net[edge.a] + arc[i], net[edge.b] + total - arc[i]);
      if (cost === Infinity || !square_at(edge.points, i, false)) continue;
      if (graph.nodes.some((n) => length(n.x - p.x, n.z - p.z) < NODE_CLEAR)) continue;
      if (towns.some((t) => length(t.x - p.x, t.z - p.z) < t.radius + NODE_CLEAR)) continue;
      for (const side of [-1, 1]) out.push({ edge, point: p, side, cost });
    }
  }
  return out;
}

function ports(exit: TownExit | null, branched: readonly Branch[], banned: Set<string>, tag: string): { port: Port; anchor: Anchor; key: string }[] {
  const list: { port: Port; anchor: Anchor; key: string }[] = [];
  if (exit && !banned.has(`${tag}exit`)) {
    const { node, way } = exit;
    const at = { x: node.x + way.x * APPROACH, z: node.z + way.z * APPROACH };
    list.push({ port: { ...at, cost: APPROACH }, anchor: { x: node.x, y: node.y, z: node.z, into: at, out: at, node: () => node.id }, key: `${tag}exit` });
  }
  for (const { edge, point: p, side, cost } of branched) {
    const key = `${tag}${edge.id}:${p.x},${p.z}:${side}`;
    if (banned.has(key)) continue;
    const at = { x: p.x - p.tz * side * APPROACH, z: p.z + p.tx * side * APPROACH };
    let made = -1;
    const node = (graph: RoadGraph) => {
      if (made >= 0) return made;
      const host = graph.edges.find((e) => e.kind !== "street" && !e.closed && e.points.includes(p));
      if (!host) throw new Error("branch point lost its road");
      made = split_edge(graph, host, p);
      return made;
    };
    list.push({ port: { ...at, cost: cost * DISCOUNT + APPROACH }, anchor: { x: p.x, y: p.y, z: p.z, into: at, out: at, node }, key });
  }
  return list;
}

/** Circuit points a link may cross square: off the kept stretches, gentle, and clear of every node. */
function crossing_points(ctx: LinkContext): { at: number; crossing: Crossing }[] {
  const { road, graph, keep } = ctx;
  const n = road.length;
  const out: { at: number; crossing: Crossing }[] = [];
  for (let at = 0; at < n; at += CROSS_STEP) {
    if (keep(at)) continue;
    const p = road[at];
    const lo = road[(at - GRADE_SPAN + n) % n];
    const hi = road[(at + GRADE_SPAN) % n];
    if (Math.abs(hi.y - lo.y) > CROSS_GRADE * length(hi.x - lo.x, hi.z - lo.z) || !square_at(road, at, true)) continue;
    if (graph.nodes.some((node) => length(node.x - p.x, node.z - p.z) < NODE_CLEAR)) continue;
    const side = (s: number): Way => ({ x: p.x - p.tz * s * APPROACH, z: p.z + p.tx * s * APPROACH });
    out.push({ at, crossing: { a: side(1), b: side(-1) } });
  }
  return out;
}

function cross_anchor(ctx: LinkContext, at: number, forward: boolean): Anchor {
  const p = ctx.road[at];
  const a = { x: p.x - p.tz * APPROACH, z: p.z + p.tx * APPROACH };
  const b = { x: p.x + p.tz * APPROACH, z: p.z - p.tx * APPROACH };
  let made = -1;
  const node = (graph: RoadGraph) => {
    if (made >= 0) return made;
    made = graph.nodes.length;
    graph.nodes.push({ id: made, x: p.x, z: p.z, y: p.y, kind: "junction" });
    ctx.joins.push({ node: made, at });
    return made;
  };
  return { x: p.x, y: p.y, z: p.z, into: forward ? a : b, out: forward ? b : a, node };
}

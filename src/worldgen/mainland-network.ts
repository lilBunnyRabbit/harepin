import { mulberry32, sub } from "../rng";
import { town_pairs } from "./links";
import { length } from "./noise";
import { plan_sample, type PlanGrid } from "./plan-grid";
import type { TownRecipe } from "./recipe";
import { APPROACH, Router, spur_points, unkink, type Exit, type Sampler, type Way } from "./route";
import { heading } from "./routes";
import { CORE, town_name, town_streets } from "./towns";
import { LOCAL_HALF, type RoadEdge, type RoadGraph, type RoadNode, type RoadPoint, type Town } from "./types";

const TOWN_TRIES = 4000;
/** Towns stay inside this reach of the centre, clear of the coast the terrain mask starts near 2300 m. */
const TOWN_REACH = 2150;
const TOWN_GAP = 650;
const TOWN_RELIEF = 18;
const TOWN_LOW = 6;
const TOWN_HIGH = 90;
/** The circuit is the graph cycle whose length lands nearest this, metres. */
const LAP_TARGET = 11000;
const NO_RING: Sampler = () => Infinity;
// cos 45°
const SQUARE = Math.SQRT1_2;
/** Router cells this close to a link's straight departure would bend it back toward the port. */
const CELL_CLEAR = 24;

export interface Network {
  graph: RoadGraph;
  towns: Town[];
  /** Edge ids of the circuit in driving order; empty when the links close no cycle. */
  circuit: number[];
  road: RoadPoint[];
}

interface Link {
  edge: RoadEdge;
  a: Town;
  b: Town;
  tree: boolean;
}

interface Step {
  id: number;
  forward: boolean;
}

function place_towns(seed: number, grid: PlanGrid, shape: TownRecipe): Town[] {
  const next = mulberry32(sub(seed, "towns"));
  const target = shape.min + Math.floor(next() * (shape.max - shape.min + 1));
  const towns: Town[] = [];
  for (let attempt = 0; attempt < TOWN_TRIES && towns.length < target; attempt++) {
    const x = (next() * 2 - 1) * TOWN_REACH;
    const z = (next() * 2 - 1) * TOWN_REACH;
    const radius = 90 + next() * 60;
    let ux = next() - 0.5;
    let uz = next() - 0.5;
    if (x * x + z * z > TOWN_REACH * TOWN_REACH || ux * ux + uz * uz < 0.01) continue;
    const h = plan_sample(grid, x, z);
    if (h < TOWN_LOW || h > TOWN_HIGH) continue;
    let low = h;
    let high = h;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        const y = plan_sample(grid, x + a * radius * 0.7, z + b * radius * 0.7);
        low = Math.min(low, y);
        high = Math.max(high, y);
      }
    if (high - low > TOWN_RELIEF || low < TOWN_LOW / 2) continue;
    if (towns.some((t) => length(t.x - x, t.z - z) < t.radius + radius + TOWN_GAP)) continue;
    const len = Math.sqrt(ux * ux + uz * uz);
    ux /= len;
    uz /= len;
    towns.push({ id: towns.length, x, z, radius, ux, uz, angle: heading({ tx: ux, tz: uz }), name: town_name(next), y: h, gx: 0, gz: 0, core: radius * CORE, block: shape.block.min });
  }
  return towns;
}

interface Door {
  node: RoadNode;
  way: Way;
}

function arm_ways(graph: RoadGraph, node: RoadNode): Way[] {
  const out: Way[] = [];
  for (const e of graph.edges) {
    const n = e.points.length;
    if (e.a === node.id) out.push(unit(e.points[0], e.points[1]));
    if (e.b === node.id) out.push(unit(e.points[n - 1], e.points[n - 2]));
  }
  return out;
}

function unit(p: RoadPoint, q: RoadPoint): Way {
  const d = length(q.x - p.x, q.z - p.z) || 1;
  return { x: (q.x - p.x) / d, z: (q.z - p.z) / d };
}

// A link leaves along a free axis of the town's grid, square to its streets, so its port gets a clean T or L patch
// instead of a shallow wedge no patch fits.
function door(graph: RoadGraph, town: Town, toward: Town): Door {
  const axes: Way[] = [
    { x: town.ux, z: town.uz },
    { x: -town.ux, z: -town.uz },
    { x: -town.uz, z: town.ux },
    { x: town.uz, z: -town.ux },
  ];
  let best: Door | null = null;
  let best_d = Infinity;
  for (const node of graph.nodes) {
    if (length(node.x - town.x, node.z - town.z) > town.radius + 1) continue;
    const arms = arm_ways(graph, node);
    for (const way of axes) {
      if (arms.some((a) => a.x * way.x + a.z * way.z > SQUARE)) continue;
      const d = length(node.x + way.x * APPROACH - toward.x, node.z + way.z * APPROACH - toward.z);
      if (d < best_d) {
        best_d = d;
        best = { node, way };
      }
    }
  }
  if (!best) throw new Error(`town ${town.id} has no free street end`);
  return best;
}

function exit_of({ node, way }: Door, town: Town): Exit {
  return { town, x: node.x, z: node.z, way };
}

function out_of({ node, way }: Door): [number, number] {
  return [node.x + way.x * APPROACH, node.z + way.z * APPROACH];
}

// Towns first, then a relative-neighbourhood graph between them routed over the plan grid. The router keeps off every
// road it built, so roads never cross between towns: every junction is a town's street grid.
export function mainland_network(seed: number, grid: PlanGrid, shape: TownRecipe): Network {
  const height: Sampler = (x, z) => plan_sample(grid, x, z);
  const graph: RoadGraph = { nodes: [], edges: [] };
  const towns: Town[] = [];
  for (const town of place_towns(seed, grid, shape)) {
    town.id = towns.length;
    const streets = town_streets(seed, town, height, [], graph.nodes.length, graph.edges.length, shape);
    if (!streets) continue;
    graph.nodes.push(...streets.nodes);
    graph.edges.push(...streets.edges);
    towns.push(town);
  }
  const router = new Router(height, NO_RING, towns, grid.ext);
  const links: Link[] = [];
  for (const { a, b, tree } of town_pairs(towns)) {
    const start = door(graph, a, b);
    const end = door(graph, b, a);
    const from = start.node;
    const to = end.node;
    const [sx, sz] = out_of(start);
    const [ex, ez] = out_of(end);
    const found = router.link([{ x: sx, z: sz, cost: 0 }], [{ x: ex, z: ez, cost: 0 }], [], [exit_of(start, a), exit_of(end, b)]);
    if (!found) continue;
    const clear = ([x, z]: [number, number]) => length(x - sx, z - sz) > CELL_CLEAR && length(x - ex, z - ez) > CELL_CLEAR;
    const cells = unkink([[from.x, from.z], [sx, sz], ...found.legs[0].filter(clear), [ex, ez], [to.x, to.z]], from.y, to.y, 2, true);
    router.claim(found.legs[0]);
    const edge: RoadEdge = { id: graph.edges.length, a: from.id, b: to.id, kind: "local", half: LOCAL_HALF, closed: false, points: spur_points(cells, height, from.y, to.y) };
    graph.edges.push(edge);
    links.push({ edge, a, b, tree });
  }
  return { graph, towns, ...cycle_circuit(graph, links) };
}

function edge_length(edge: RoadEdge): number {
  let total = 0;
  for (let i = 1; i < edge.points.length; i++) total += length(edge.points[i].x - edge.points[i - 1].x, edge.points[i].z - edge.points[i - 1].z);
  return total;
}

/** Street edges from node `from` to node `to` inside one town, shortest by length; empty when they are the same node. */
function through_town(graph: RoadGraph, from: number, to: number): number[] {
  const dist = new Map<number, number>([[from, 0]]);
  const via = new Map<number, number>();
  const streets = graph.edges.filter((e) => e.kind === "street");
  for (let changed = true; changed; ) {
    changed = false;
    for (const e of streets)
      for (const [p, q] of [
        [e.a, e.b],
        [e.b, e.a],
      ]) {
        const d = (dist.get(p) ?? Infinity) + edge_length(e);
        if (d < (dist.get(q) ?? Infinity)) {
          dist.set(q, d);
          via.set(q, e.id);
          changed = true;
        }
      }
  }
  const out: number[] = [];
  for (let at = to; at !== from; ) {
    const id = via.get(at);
    if (id === undefined) return [];
    out.unshift(id);
    const e = graph.edges[id];
    at = e.a === at ? e.b : e.a;
  }
  return out;
}

function tree_path(links: readonly Link[], a: Town, b: Town): Link[] | null {
  const tree = links.filter((l) => l.tree);
  const came = new Map<Town, Link | null>([[a, null]]);
  const queue = [a];
  while (queue.length && !came.has(b)) {
    const t = queue.shift() as Town;
    for (const l of tree) {
      const other = l.a === t ? l.b : l.b === t ? l.a : null;
      if (!other || came.has(other)) continue;
      came.set(other, l);
      queue.push(other);
    }
  }
  if (!came.has(b)) return null;
  const out: Link[] = [];
  for (let t = b; t !== a; ) {
    const l = came.get(t) as Link;
    out.unshift(l);
    t = l.a === t ? l.b : l.a;
  }
  return out;
}

// Each link off the spanning tree closes exactly one cycle with it; the circuit is the one nearest LAP_TARGET, driven
// through each town it passes along that town's shortest streets.
function cycle_circuit(graph: RoadGraph, links: readonly Link[]): { circuit: number[]; road: RoadPoint[] } {
  let best: Link[] | null = null;
  let best_miss = Infinity;
  for (const closing of links.filter((l) => !l.tree)) {
    const path = tree_path(links, closing.b, closing.a);
    if (!path || path.length < 2) continue;
    const cycle = [closing, ...path];
    const miss = Math.abs(cycle.reduce((sum, l) => sum + edge_length(l.edge), 0) - LAP_TARGET);
    if (miss < best_miss) {
      best_miss = miss;
      best = cycle;
    }
  }
  if (!best) return { circuit: [], road: [] };
  const steps: Step[] = [];
  const start = best[0].edge.a;
  let at = start;
  const walk = (id: number) => {
    const e = graph.edges[id];
    const forward = e.a === at;
    steps.push({ id, forward });
    at = forward ? e.b : e.a;
  };
  let town = best[0].a;
  for (const link of best) {
    const forward = link.a === town;
    for (const id of through_town(graph, at, forward ? link.edge.a : link.edge.b)) walk(id);
    walk(link.edge.id);
    town = forward ? link.b : link.a;
  }
  for (const id of through_town(graph, at, start)) walk(id);
  const road: RoadPoint[] = [];
  for (const { id, forward } of steps) {
    const points = forward ? graph.edges[id].points : [...graph.edges[id].points].reverse().map((p) => ({ ...p, tx: -p.tx, tz: -p.tz }));
    road.push(...(road.length ? points.slice(1) : points));
  }
  road.pop();
  // The lap starts halfway along its first link, so the start gate stands on open road, not at a town's gate.
  const half = Math.floor((best[0].edge.points.length - 1) / 2);
  return { circuit: steps.map((s) => s.id), road: [...road.slice(half), ...road.slice(0, half)] };
}

import type { RoadEdge, RoadGraph, RoadNode, RoadPoint } from "./types";

export interface Join {
  node: number;
  /** Index in the road. */
  at: number;
}

// The first leg keeps id 0 and the rest are appended: street lots hash their edge id.
export function split_circuit(graph: RoadGraph, road: readonly RoadPoint[], joins: readonly Join[]): number[] {
  const { nodes, edges } = graph;
  if (!joins.length) return [0];
  nodes.shift();
  for (const node of nodes) node.id--;
  for (const edge of edges) {
    edge.a--;
    edge.b--;
  }
  const n = road.length;
  const order = joins.map((j) => ({ node: j.node - 1, at: j.at })).sort((p, q) => p.at - q.at || p.node - q.node);
  const ring = edges[0];
  if (order.length === 1) {
    const [only] = order;
    edges[0] = { ...ring, a: only.node, b: only.node, points: Array.from({ length: n }, (_, i) => road[(only.at + i) % n]) };
    return [0];
  }
  return order.map((j, k) => {
    const next = order[(k + 1) % order.length];
    const span = (next.at - j.at + n) % n;
    const id = k === 0 ? 0 : edges.length;
    const leg: RoadEdge = { ...ring, id, a: j.node, b: next.node, closed: false, points: Array.from({ length: span + 1 }, (_, i) => road[(j.at + i) % n]) };
    edges[id] = leg;
    return id;
  });
}

/** Every road off the circuit that is not a town street: spurs and the roads between towns. */
export function spur_edges(graph: RoadGraph, circuit: readonly number[]): RoadEdge[] {
  return graph.edges.filter((e) => e.kind !== "street" && !circuit.includes(e.id));
}

/** Splits an off-circuit edge at `point` (one of its own points, by identity) with a new junction node there. */
export function split_edge(graph: RoadGraph, edge: RoadEdge, point: RoadPoint): number {
  const at = edge.points.indexOf(point);
  if (at <= 0 || at >= edge.points.length - 1) throw new Error(`edge ${edge.id} has no inner point to split at`);
  const node: RoadNode = { id: graph.nodes.length, x: point.x, z: point.z, y: point.y, kind: "junction" };
  graph.nodes.push(node);
  graph.edges.push({ ...edge, id: graph.edges.length, a: node.id, points: edge.points.slice(at) });
  edge.b = node.id;
  edge.points = edge.points.slice(0, at + 1);
  return node.id;
}

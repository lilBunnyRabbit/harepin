import { length } from "./noise";
import type { RoadGraph, Town } from "./types";

const REACH = 1;

export interface TownLoop {
  town: number;
  nodes: number[];
  edges: number[];
}

// Null when no town has the whole ladder: a site can cut a lane short.
export function town_loop(graph: RoadGraph, towns: readonly Town[]): TownLoop | null {
  const by_size = [...towns].sort((a, b) => b.radius - a.radius || a.id - b.id);
  for (const town of by_size) {
    const loop = loop_in(graph, town);
    if (loop) return loop;
  }
  return null;
}

function loop_in(graph: RoadGraph, town: Town): TownLoop | null {
  const cross = town.cross ?? town.block;
  const at = new Map<string, number>();
  for (const node of graph.nodes) {
    const dx = node.x - town.x;
    const dz = node.z - town.z;
    if (length(dx, dz) > town.radius + 1) continue;
    const u = (dx * town.ux + dz * town.uz) / town.block;
    const v = (dz * town.ux - dx * town.uz) / cross;
    const i = Math.round(u);
    const j = Math.round(v);
    if (Math.abs(u - i) < 0.05 && Math.abs(v - j) < 0.05) at.set(`${i},${j}`, node.id);
  }
  const edge_of = new Map<string, number>();
  for (const edge of graph.edges) if (edge.kind === "street") edge_of.set(`${Math.min(edge.a, edge.b)},${Math.max(edge.a, edge.b)}`, edge.id);
  for (const side of [1, -1]) {
    const steps: [number, number][] = [];
    for (let i = 0; i <= REACH; i++) steps.push([i, 0]);
    for (let i = REACH; i >= -REACH; i--) steps.push([i, side]);
    for (let i = -REACH; i < 0; i++) steps.push([i, 0]);
    const nodes = steps.map(([i, j]) => at.get(`${i},${j}`));
    if (nodes.some((n) => n === undefined)) continue;
    const ids = nodes as number[];
    const edges = ids.map((a, k) => edge_of.get(`${Math.min(a, ids[(k + 1) % ids.length])},${Math.max(a, ids[(k + 1) % ids.length])}`));
    if (edges.some((e) => e === undefined)) continue;
    return { town: town.id, nodes: ids, edges: edges as number[] };
  }
  return null;
}

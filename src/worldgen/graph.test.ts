/// <reference types="bun" />
import { expect, test } from "bun:test";
import { split_circuit, spur_edges } from "./graph";
import { generate } from "./index";
import { ROAD_HALF, SPUR_HALF, type RoadEdge, type RoadGraph, type RoadPoint, type WorldData } from "./types";

const SEEDS = [0, 1, 2, 3, 4];
const N = 120;

const ROAD: RoadPoint[] = Array.from({ length: N }, (_, i) => {
  const a = (i / N) * Math.PI * 2;
  return { x: Math.sin(a) * 200, y: 0, z: Math.cos(a) * 200, tx: Math.cos(a), tz: -Math.sin(a) };
});

function loop(joins: number[]): RoadGraph {
  const nodes: RoadGraph["nodes"] = [{ id: 0, x: ROAD[0].x, z: ROAD[0].z, y: 0, kind: "junction" }];
  const edges: RoadEdge[] = [{ id: 0, a: 0, b: 0, kind: "highway", half: ROAD_HALF, closed: true, points: ROAD }];
  for (const at of joins) {
    const gate = nodes.length;
    nodes.push({ id: gate, x: ROAD[at].x * 2, z: ROAD[at].z * 2, y: 0, kind: "town" });
    nodes.push({ id: gate + 1, x: ROAD[at].x, z: ROAD[at].z, y: 0, kind: "junction" });
    edges.push({ id: edges.length, a: gate, b: gate + 1, kind: "highway", half: SPUR_HALF, closed: false, points: [ROAD[at], ROAD[at]] });
  }
  return { nodes, edges };
}

function degrees(graph: RoadGraph): number[] {
  const degree = graph.nodes.map(() => 0);
  for (const e of graph.edges) {
    degree[e.a]++;
    degree[e.b]++;
  }
  return degree;
}

function expect_whole(graph: RoadGraph) {
  graph.nodes.forEach((node, i) => expect(node.id).toBe(i));
  graph.edges.forEach((edge, i) => {
    expect(edge.id).toBe(i);
    expect(graph.nodes[edge.a]).toBeDefined();
    expect(graph.nodes[edge.b]).toBeDefined();
    expect(edge.points.length).toBeGreaterThan(1);
  });
  expect(degrees(graph).every((d) => d > 0)).toBe(true);
}

function expect_cycle(graph: RoadGraph, circuit: number[], road: readonly RoadPoint[]) {
  const legs = circuit.map((id) => graph.edges[id]);
  legs.forEach((leg, k) => expect(legs[(k + 1) % legs.length].a).toBe(leg.b));
  const walked = legs.flatMap((leg) => leg.points.slice(1));
  if (legs.length === 1 && legs[0].closed) walked.unshift(legs[0].points[0]);
  expect(walked.length).toBe(road.length);
  const start = road.indexOf(walked[0]);
  walked.forEach((p, i) => expect(p).toBe(road[(start + i) % road.length]));
}

test("a circuit no spur joins stays one closed edge on node 0", () => {
  const graph = loop([]);
  expect(split_circuit(graph, ROAD, [])).toEqual([0]);
  expect(graph.edges[0]).toMatchObject({ a: 0, b: 0, closed: true });
  expect(graph.nodes).toHaveLength(1);
});

test("one join makes the circuit a closed loop on that junction", () => {
  const graph = loop([30]);
  const circuit = split_circuit(graph, ROAD, [{ node: 2, at: 30 }]);
  expect(circuit).toEqual([0]);
  expect(graph.nodes.map((n) => n.kind)).toEqual(["town", "junction"]);
  expect(graph.edges[0]).toMatchObject({ a: 1, b: 1, closed: true });
  expect(graph.edges[0].points[0]).toBe(ROAD[30]);
  expect_cycle(graph, circuit, ROAD);
});

test("joins cut the circuit into legs in driving order, the first keeping id 0", () => {
  const graph = loop([90, 10, 50]);
  const circuit = split_circuit(graph, ROAD, [
    { node: 2, at: 90 },
    { node: 4, at: 10 },
    { node: 6, at: 50 },
  ]);
  expect(circuit).toEqual([0, 4, 5]);
  expect(circuit.map((id) => graph.edges[id].points.length)).toEqual([41, 41, 41]);
  expect(graph.edges[0]).toMatchObject({ a: 3, b: 5, closed: false });
  expect(graph.edges.slice(1, 4).map((e) => [e.a, e.b])).toEqual([
    [0, 1],
    [2, 3],
    [4, 5],
  ]);
  expect_whole(graph);
  expect_cycle(graph, circuit, ROAD);
  expect(degrees(graph)).toEqual([1, 3, 1, 3, 1, 3]);
});

const worlds = new Map<number, WorldData>();
const world = (seed: number) => worlds.get(seed) ?? (worlds.set(seed, generate(seed)).get(seed) as WorldData);

test.each(SEEDS)("seed %i: every edge ends on a node and the circuit is a cycle through its joins", (seed) => {
  const { graph, circuit, road } = world(seed);
  expect_whole(graph);
  expect_cycle(graph, circuit, road);
  const degree = degrees(graph);
  const off = spur_edges(graph, circuit);
  for (const id of circuit) {
    const join = graph.edges[id].a;
    expect(circuit.filter((c) => graph.edges[c].a === join || graph.edges[c].b === join)).toHaveLength(circuit.length > 1 ? 2 : 1);
    const crossing = off.filter((e) => e.a === join || e.b === join).length;
    expect(crossing === 1 || crossing === 2).toBe(true);
  }
  for (const spur of off.filter((e) => e.kind === "highway")) expect(degree[spur.a]).toBeGreaterThan(1);
});

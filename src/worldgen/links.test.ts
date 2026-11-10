import { expect, test } from "bun:test";
import { generate } from "./index";
import { town_pairs } from "./links";
import type { Town } from "./types";

const town = (id: number, x: number, z: number): Town => ({ id, x, z, radius: 100, ux: 1, uz: 0, angle: 0, name: "", y: 10, gx: 0, gz: 0, core: 115, block: 50 });

test("towns in a row pair only with their neighbours, all on the spanning tree", () => {
  const pairs = town_pairs([town(0, 0, 0), town(1, 400, 0), town(2, 800, 0), town(3, 1200, 0)]);
  expect(pairs.map((p) => [p.a.id, p.b.id, p.tree])).toEqual([
    [0, 1, true],
    [1, 2, true],
    [2, 3, true],
  ]);
});

test("a square of towns keeps its four sides, one of them off the tree", () => {
  const pairs = town_pairs([town(0, 0, 0), town(1, 500, 0), town(2, 0, 500), town(3, 500, 500)]);
  expect(pairs).toHaveLength(4);
  expect(pairs.filter((p) => p.tree)).toHaveLength(3);
  expect(pairs[3].tree).toBe(false);
});

test.each([0, 1, 4])("seed %i: a road crossing the circuit crosses it square and straight on", (seed) => {
  const { graph, circuit } = generate(seed);
  const legs = circuit.map((id) => graph.edges[id]);
  for (const node of graph.nodes) {
    const ring = legs.filter((e) => e.a === node.id || e.b === node.id);
    const off = graph.edges.filter((e) => !circuit.includes(e.id) && (e.a === node.id || e.b === node.id));
    if (!ring.length || off.length < 2) continue;
    expect(off).toHaveLength(2);
    expect(off.every((e) => e.kind === "local")).toBe(true);
    const out = off.map((e) => (e.a === node.id ? e.points[0] : { ...e.points[e.points.length - 1], tx: -e.points[e.points.length - 1].tx, tz: -e.points[e.points.length - 1].tz }));
    const along = ring[0].a === node.id ? ring[0].points[0] : ring[0].points[ring[0].points.length - 1];
    expect(out[0].tx * out[1].tx + out[0].tz * out[1].tz).toBeCloseTo(-1, 2);
    expect(Math.abs(out[0].tx * along.tx + out[0].tz * along.tz)).toBeLessThan(0.05);
  }
}, 30_000);

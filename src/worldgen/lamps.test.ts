import { expect, test } from "bun:test";
import { generate_world } from "./kinds/kinds";
import { is_lamp, lamp_pools, LAMPS, near_stops, road_lamps } from "./lamps";
import { PropKind, ROAD_HALF, STREET_HALF, WorldKind, type RoadEdge, type RoadNode, type RoadPoint } from "./types";

const line = (x0: number, z0: number, tx: number, tz: number, n: number): RoadPoint[] => Array.from({ length: n }, (_, i) => ({ x: x0 + tx * i * 2, y: 5, z: z0 + tz * i * 2, tx, tz }) as RoadPoint);
const edge = (id: number, kind: RoadEdge["kind"], half: number, points: RoadPoint[]): RoadEdge => ({ id, a: 0, b: 1, kind, half, closed: false, points });
const node = (id: number, x: number, z: number, kind: RoadNode["kind"]): RoadNode => ({ id, x, z, y: 5, kind });
const everywhere = () => true;
const nowhere = () => false;
const flat = () => 5;

test("masts alternate sides beside the road, each with its post as a solid", () => {
  const road = edge(0, "highway", ROAD_HALF, line(0, 0, 0, 1, 200));
  const { props, solids } = road_lamps({ nodes: [], edges: [road] }, everywhere, flat, nowhere);
  expect(props.length).toBe(8);
  expect(solids.length).toBe(props.length);
  props.forEach((prop, i) => {
    expect(prop.kind).toBe(PropKind.ROAD_LAMP);
    expect(Math.abs(prop.x)).toBeCloseTo(ROAD_HALF + 2.2, 6);
    expect(Math.sign(prop.x)).toBe(i % 2 ? -1 : 1);
    expect(Math.sign(Math.sin(prop.angle))).toBe(-Math.sign(prop.x));
    expect(solids[i]).toMatchObject({ kind: "circle", x: prop.x, z: prop.z, height: LAMPS.road_lamp.height });
  });
  expect(props[1].z - props[0].z).toBeCloseTo(48, 6);
});

test("no mast on a street, on another road, at a junction, in the dark or where blocked", () => {
  const road = edge(0, "highway", ROAD_HALF, line(0, 0, 0, 1, 200));
  const street = edge(1, "street", STREET_HALF, line(-100, 120, 1, 0, 100));
  const graph = { nodes: [node(0, 0, 216, "junction"), node(1, 0, 0, "end")], edges: [road, street] };
  const { props } = road_lamps(graph, everywhere, flat, nowhere);
  expect(props.length).toBeGreaterThan(0);
  for (const prop of props) {
    expect(Math.abs(prop.z - 120)).toBeGreaterThan(STREET_HALF + 3 - 1e-6);
    expect(Math.hypot(prop.x, prop.z - 216)).toBeGreaterThan(18);
  }
  expect(props.some((prop) => Math.abs(prop.z - 120) < 10)).toBe(false);
  expect(road_lamps(graph, nowhere, flat, nowhere).props).toEqual([]);
  expect(road_lamps(graph, everywhere, flat, everywhere).props).toEqual([]);
  const lit = near_stops([], graph.nodes);
  const near = road_lamps(graph, lit, flat, nowhere).props;
  expect(near.length).toBeGreaterThan(0);
  for (const prop of near) expect(Math.abs(prop.z - 216)).toBeLessThan(111);
});

test("a pool drapes over the ground and fades to nothing at its rim", () => {
  const tones = { street_light: [1, 1, 1], road_lamp: [1, 0.5, 0] } as const;
  const props = [
    { x: 0, y: 0, z: 0, angle: 0, kind: PropKind.STREET_LIGHT, scale: 1 },
    { x: 50, y: 0, z: 0, angle: 1, kind: PropKind.ROAD_LAMP, scale: 1 },
    { x: 9, y: 0, z: 9, angle: 0, kind: PropKind.BOULDER, scale: 1 },
  ];
  const pools = lamp_pools(props, { street_light: [...tones.street_light], road_lamp: [...tones.road_lamp] }, (x, z) => x * 0.1 + z * 0.2);
  if (!pools) throw new Error("no pools");
  expect(pools.positions.length).toBe(2 * 81 * 3);
  expect(pools.index.length).toBe(2 * 64 * 6);
  expect(Math.max(...pools.index)).toBe(2 * 81 - 1);
  for (let v = 0; v < 162; v++) expect(pools.positions[v * 3 + 1]).toBeCloseTo(pools.positions[v * 3] * 0.1 + pools.positions[v * 3 + 2] * 0.2 + 0.16, 4);
  expect(pools.colors[0]).toBe(0);
  expect(pools.colors[40 * 3]).toBeCloseTo(LAMPS.street_light.pool.strength, 6);
  expect(pools.colors[(81 + 40) * 3 + 2]).toBe(0);
  expect(lamp_pools([props[2]], { street_light: [1, 1, 1], road_lamp: [1, 1, 1] }, flat)).toBeUndefined();
});

test("an island lights its towns on both sides of a street and its roads only near towns and junctions", () => {
  const data = generate_world(0, WorldKind.ISLAND);
  const lamps = data.props.filter(is_lamp);
  const lit = near_stops(data.towns, data.graph.nodes);
  const masts = lamps.filter((p) => p.kind === PropKind.ROAD_LAMP);
  expect(masts.length).toBeGreaterThan(10);
  for (const mast of masts) expect(lit(mast.x + Math.sin(mast.angle) * (ROAD_HALF + 2.2), mast.z + Math.cos(mast.angle) * (ROAD_HALF + 2.2))).toBe(true);
  expect(data.road.some((p) => !lit(p.x, p.z))).toBe(true);
  const street = data.graph.edges.find((e) => e.kind === "street" && e.points.length > 30);
  if (!street) throw new Error("no long street");
  const [a] = street.points;
  const sides = new Set(lamps.filter((p) => p.kind === PropKind.STREET_LIGHT).map((p) => ({ u: (p.x - a.x) * a.tx + (p.z - a.z) * a.tz, v: (p.z - a.z) * a.tx - (p.x - a.x) * a.tz })).filter(({ u, v }) => u > 0 && Math.abs(Math.abs(v) - street.half - 1) < 0.01).map(({ v }) => Math.sign(v)));
  expect(sides.size).toBe(2);
  for (const lamp of lamps) expect(data.solids.some((s) => s.kind === "circle" && s.x === lamp.x && s.z === lamp.z && s.radius === LAMPS[lamp.kind].radius)).toBe(true);
});

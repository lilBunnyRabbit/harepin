/// <reference types="bun" />
import { expect, test } from "bun:test";
import { sample } from "./field";
import { generate } from "./index";
import { length } from "./noise";
import { drive_time, street_routes } from "./routes";
import { CELL, DIRT, N, ORIGIN, ROAD_HALF, RouteKind, STREET_HALF, type Route, type WorldData } from "./types";

const SEEDS = Array.from({ length: 20 }, (_, i) => i);
const GAP = 3;
const ON_ROAD = 0.5;
const CONE_CLEAR = 3;
const TRAIL_GATE_HW = 8;
// Gates every 150 m, and none from the run-up to the run-out end, past a 110 m gap jump.
const TRAIL_GATE_GAP = 320;

const dirt = (world: WorldData, p: { x: number; z: number }) => world.terrain.surface[Math.round((p.z - ORIGIN) / CELL) * (N + 1) + Math.round((p.x - ORIGIN) / CELL)] === DIRT;

const town_at = (world: WorldData, p: { x: number; z: number }) => world.towns.find((t) => length(t.x - p.x, t.z - p.z) <= t.radius + STREET_HALF);

function contiguous(route: Route) {
  for (let i = 1; i < route.points.length; i++) expect(length(route.points[i].x - route.points[i - 1].x, route.points[i].z - route.points[i - 1].z)).toBeLessThan(GAP);
}

let streets = 0;
let offroads = 0;
let gaps = 0;
test.each(SEEDS)("seed %i: every route is whole, on the road, and gated to its finish", (seed) => {
  const world = generate(seed);
  const ids = world.routes.map((r) => r.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids[0]).toBe("circuit");
  for (const route of world.routes) {
    contiguous(route);
    expect(route.par_ms).toBeGreaterThan(0);
    expect(route.par_ms % 500).toBe(0);
    const end = route.closed ? route.points[0] : route.points[route.points.length - 1];
    const finish = route.checkpoints[route.checkpoints.length - 1];
    expect(length(finish.x - end.x, finish.z - end.z)).toBeLessThan(GAP);
    route.checkpoints.forEach((c, i) => expect(c.index).toBe(i));
    for (const p of route.points) if (route.kind !== RouteKind.OFFROAD || !dirt(world, p)) expect(sample(world.terrain.road_dist, p.x, p.z)).toBeLessThan(ROAD_HALF + ON_ROAD);
  }
  const circuit = world.routes[0];
  expect(circuit.closed).toBe(true);
  expect(circuit.points).toEqual(world.road);
  expect(circuit.checkpoints.length).toBe(world.checkpoints.length);
  const offroad = world.routes.filter((r) => r.kind === RouteKind.OFFROAD);
  if (offroad.length) offroads++;
  const takeoff = world.ramps.find((r) => r.road && world.ramps.some((d) => d.kind === "landing" && d.id === r.id + 1));
  if (takeoff) gaps++;
  for (const route of offroad) {
    expect(route.closed).toBe(false);
    expect(route.gate_hw).toBe(TRAIL_GATE_HW);
    expect(route.length).toBeGreaterThan(1000);
    if (takeoff) expect(route.points.some((p) => length(p.x - takeoff.x, p.z - takeoff.z) < 1)).toBe(true);
    for (let i = 1; i < route.checkpoints.length; i++) {
      const a = route.checkpoints[i - 1];
      const b = route.checkpoints[i];
      expect(length(b.x - a.x, b.z - a.z)).toBeLessThan(TRAIL_GATE_GAP);
    }
  }
  const street = world.routes.filter((r) => r.kind === RouteKind.STREET);
  if (street.length) streets++;
  const { items } = street_routes(world.graph, world.towns, world.terrain.heights, world.ramps);
  for (const route of street) {
    expect(route.closed).toBe(false);
    const from = town_at(world, route.points[0]);
    const to = town_at(world, route.points[route.points.length - 1]);
    expect(from).toBeDefined();
    expect(to).toBeDefined();
    expect(from?.id).not.toBe(to?.id);
    expect(route.length).toBeGreaterThan(800);
    expect(route.length).toBeLessThan(3200);
    for (const item of items) for (const p of route.points) expect(length(item.x - p.x, item.z - p.z)).toBeGreaterThan(CONE_CLEAR);
  }
}, 30_000);

test("most seeds get a street race", () => {
  expect(streets).toBeGreaterThanOrEqual(18);
});

test("most seeds get an offroad race, and most of those a canyon gap", () => {
  expect(offroads).toBeGreaterThanOrEqual(18);
  expect(gaps).toBeGreaterThanOrEqual(16);
});

test("routes are deterministic", () => {
  expect(generate(4).routes).toEqual(generate(4).routes);
}, 30_000);

test("drive time: longer for a corner than a straight of the same length, par above it", () => {
  const line = (bend: boolean) =>
    Array.from({ length: 500 }, (_, i) => {
      const s = i * 2;
      const turned = bend && s > 500;
      return { x: turned ? s - 500 : 0, y: 0, z: turned ? 500 : s, tx: turned ? 1 : 0, tz: turned ? 0 : 1 };
    });
  const straight = drive_time(line(false), false);
  expect(straight).toBeGreaterThan(1000 / 36);
  expect(drive_time(line(true), false)).toBeGreaterThan(straight + 3);
  for (const route of generate(1).routes) expect(route.par_ms / 1000).toBeGreaterThan(drive_time(route.points, route.closed));
}, 30_000);

/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Solid } from "../world/world";
import { GATE_RADIUS, HUNT_LEVELS, HuntRun, HuntStatus, build_hunt, hunt_par, tour, type HuntGround, type Point } from "./hunt";

function island(solids: Solid[] = []): HuntGround {
  const points = Array.from({ length: 600 }, (_, i) => ({ x: (i - 300) * 2, z: 0 }));
  const cross = Array.from({ length: 600 }, (_, i) => ({ x: 0, z: (i - 300) * 2 }));
  return {
    height: (x, z) => (Math.hypot(x, z) > 700 ? -2 : 5),
    distance_to_road: (x, z) => Math.min(Math.abs(z), Math.abs(x)),
    road: points,
    circuit: [0],
    graph: { edges: [{ id: 0, points }, { id: 1, points: cross }] },
    solids,
  };
}

const START: Point = { x: 0, z: 0 };

test("gates are seeded, spaced, inside the spread and on dry land", () => {
  const ground = island();
  for (const level of HUNT_LEVELS) {
    const hunt = build_hunt(3, ground, START, level);
    expect(hunt.gates.length).toBe(level.gates);
    expect(build_hunt(3, ground, START, level)).toEqual(hunt);
    for (const g of hunt.gates) {
      expect(Math.hypot(g.x, g.z)).toBeLessThanOrEqual(level.spread);
      expect(ground.height(g.x, g.z)).toBeGreaterThan(0);
    }
    for (let i = 0; i < hunt.gates.length; i++)
      for (let j = i + 1; j < hunt.gates.length; j++) expect(Math.hypot(hunt.gates[i].x - hunt.gates[j].x, hunt.gates[i].z - hunt.gates[j].z)).toBeGreaterThan(GATE_RADIUS * 2);
  }
  expect(build_hunt(4, ground, START, HUNT_LEVELS[2]).gates).not.toEqual(build_hunt(3, ground, START, HUNT_LEVELS[2]).gates);
});

test("wild gates sit off the road and clear of solids", () => {
  const rock: Solid = { kind: "circle", x: 120, y: 5, z: 120, radius: 30, height: 5 };
  const ground = island([rock]);
  const level = HUNT_LEVELS[4];
  const hunt = build_hunt(9, ground, START, level);
  const off = hunt.gates.filter((g) => ground.distance_to_road(g.x, g.z) > 10);
  expect(off.length).toBe(Math.round(level.gates * level.wild));
  for (const g of off) expect(Math.hypot(g.x - rock.x, g.z - rock.z)).toBeGreaterThan(rock.radius);
});

test("par follows the nearest-first tour and grows with the ladder", () => {
  expect(tour(START, [{ x: 0, z: 100 }, { x: 0, z: 10 }])).toBeCloseTo(100);
  expect(hunt_par(START, [{ x: 0, z: 160 }]) % 500).toBe(0);
  const ground = island();
  const pars = HUNT_LEVELS.map((level) => build_hunt(1, ground, START, level).par_ms);
  expect(pars[pars.length - 1]).toBeGreaterThan(pars[0]);
});

test("run: clock starts on moving, gates count once, any order, done at the last", () => {
  const hunt = { level: HUNT_LEVELS[0], start: START, gates: [{ x: 100, z: 0 }, { x: -100, z: 0 }], par_ms: 30_000 };
  const run = new HuntRun(hunt);
  expect(run.update(100, 0, 0, 0)).toBe(-1);
  expect(run.status).toBe(HuntStatus.READY);
  run.update(100, 0, 0, 5);
  expect(run.status).toBe(HuntStatus.RUNNING);
  expect(run.nearest(-50, 0)).toBe(1);
  expect(run.update(1000, -100 + GATE_RADIUS - 0.5, 0, 20)).toBe(1);
  expect(run.update(1000, -100, 0, 20)).toBe(-1);
  expect(run.nearest(-100, 0)).toBe(0);
  expect(run.update(1000, 100, 1, 20)).toBe(0);
  expect(run.status).toBe(HuntStatus.DONE);
  expect(run.elapsed()).toBe(3000);
  expect(run.stars()).toBe(3);
  expect(run.nearest(0, 0)).toBe(-1);
});

test("stars against par", () => {
  const hunt = { level: HUNT_LEVELS[0], start: START, gates: [{ x: 100, z: 0 }], par_ms: 10_000 };
  const slow = new HuntRun(hunt);
  slow.update(100, 0, 0, 5);
  slow.update(13_000, 100, 0, 5);
  expect(slow.stars()).toBe(1);
});

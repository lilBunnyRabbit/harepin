/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Route } from "../worldgen/types";
import { GATE_REACH, RaceRun, RaceStatus, race_course, race_levels } from "./races";

const N = 1000;
const POINTS = Array.from({ length: N }, (_, i) => {
  const a = (i / N) * Math.PI * 2;
  const r = (N * 2) / (Math.PI * 2);
  return { x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r, tx: Math.cos(a), tz: -Math.sin(a) };
});
const gate = (i: number, index: number) => ({ x: POINTS[i % N].x, y: 0, z: POINTS[i % N].z, heading: 0, index });

function route(closed: boolean): Route {
  const points = closed ? POINTS : POINTS.slice(0, 600);
  const checkpoints = closed ? [gate(250, 0), gate(500, 1), gate(750, 2), gate(0, 3)] : [gate(200, 0), gate(400, 1), gate(599, 2)];
  return { id: closed ? "circuit" : "street-1", kind: closed ? "circuit" : "street", closed, points, checkpoints, gate_hw: 6, length: points.length * 2, par_ms: 60_000 };
}

test("course: gates in order along the line, the finish on its last point", () => {
  const closed = race_course(route(true));
  expect(closed.line.length).toBe(N + 1);
  expect(closed.gates).toEqual([250, 500, 750, N]);
  const open = race_course(route(false));
  expect(open.gates).toEqual([200, 400, 599]);
});

test("run: the clock starts off the line and stops at the finish, every gate taken in order", () => {
  const course = race_course(route(true));
  const run = new RaceRun(course);
  run.update(100, course.line[0].x, course.line[0].z);
  expect(run.status).toBe(RaceStatus.READY);
  const taken: number[] = [];
  for (let i = 1; i < course.line.length; i++) {
    const g = run.update(100, course.line[i].x, course.line[i].z);
    if (g >= 0) taken.push(g);
  }
  expect(taken).toEqual([0, 1, 2, 3]);
  expect(run.status).toBe(RaceStatus.DONE);
  expect(run.elapsed()).toBe((course.line.length - 2) * 100);
  expect(run.stars()).toBe(1);
});

test("run: a gate passed wide or skipped stays next until the car comes back for it", () => {
  const course = race_course(route(false));
  const run = new RaceRun(course);
  for (let i = 0; i < 190; i++) run.update(100, course.line[i].x, course.line[i].z);
  for (let i = 190; i < 200 + GATE_REACH + 15; i++) {
    const p = course.line[i];
    run.update(100, p.x + p.tz * 12, p.z - p.tx * 12);
  }
  expect(run.next).toBe(0);
  expect(run.missed).toBe(true);
  for (let i = 200 + GATE_REACH + 15; i >= 195; i--) run.update(100, course.line[i].x, course.line[i].z);
  for (let i = 195; i < 210; i++) run.update(100, course.line[i].x, course.line[i].z);
  expect(run.next).toBe(1);
  expect(run.missed).toBe(false);
});

test("levels follow the progression order and list only routes the seed made", () => {
  expect(race_levels([{ id: "street-2" }, { id: "street-1" }, { id: "circuit" }]).map((l) => l.id)).toEqual(["circuit", "street-1", "street-2"]);
  expect(race_levels([{ id: "street-9" }])).toEqual([]);
});

/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Route } from "../worldgen/types";
import { GATE_REACH, RaceRun, RaceStatus, gate_shown, race_choices, race_course, race_levels } from "./races";

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
  return { id: closed ? "circuit" : "street-1", kind: closed ? "circuit" : "street", closed, points, checkpoints, gate_hw: 6, length: points.length * 2, par_ms: 60_000, closure: [] };
}

test("course: gates in order along the line, the finish on its last point", () => {
  const closed = race_course(route(true));
  expect(closed.line.length).toBe(N + 1);
  expect(closed.gates).toEqual([250, 500, 750, N]);
  const open = race_course(route(false));
  expect(open.gates).toEqual([200, 400, 599]);
});

test("run: held through the countdown, then every gate in order to the finish", () => {
  const course = race_course(route(true));
  const run = new RaceRun(course, 3000);
  for (let i = 0; i < 29; i++) run.update(100, course.line[0].x, course.line[0].z);
  expect(run.status).toBe(RaceStatus.READY);
  expect(run.countdown).toBe(100);
  run.update(100, course.line[0].x, course.line[0].z);
  expect(run.status).toBe(RaceStatus.RUNNING);
  expect(run.countdown).toBe(0);
  const taken: number[] = [];
  for (let i = 1; i < course.line.length; i++) {
    const g = run.update(100, course.line[i].x, course.line[i].z);
    if (g >= 0) taken.push(g);
  }
  expect(taken).toEqual([0, 1, 2, 3]);
  expect(run.status).toBe(RaceStatus.DONE);
  expect(run.elapsed()).toBe((course.line.length - 1) * 100);
  expect(run.stars()).toBe(1);
});

test("run: past the finish there is no gate, frame after frame", () => {
  const course = race_course(route(false));
  const run = new RaceRun(course, 0);
  expect(run.gate).toEqual(course.line[course.gates[0]]);
  for (const p of course.line) run.update(100, p.x, p.z);
  expect(run.status).toBe(RaceStatus.DONE);
  const end = course.line[course.line.length - 1];
  for (let i = 0; i < 3; i++) {
    expect(run.update(100, end.x, end.z)).toBe(-1);
    expect(run.gate).toBeNull();
  }
});

test("run: a gate passed wide or skipped stays next until the car comes back for it", () => {
  const course = race_course(route(false));
  const run = new RaceRun(course, 0);
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

test("view: a circuit's finish, on the start line under the car, shows only once it is the next gate", () => {
  const shown = (next: number, closed: boolean) => [0, 1, 2, 3].filter((i) => gate_shown(i, next, 4, closed));
  expect(shown(0, true)).toEqual([0, 1, 2]);
  expect(shown(2, true)).toEqual([2]);
  expect(shown(3, true)).toEqual([3]);
  expect(shown(4, true)).toEqual([]);
  expect(shown(0, false)).toEqual([0, 1, 2, 3]);
  expect(shown(3, false)).toEqual([3]);
});

test("levels follow the progression order and list only routes the seed made", () => {
  expect(race_levels([{ id: "street-2" }, { id: "street-1" }, { id: "circuit" }], "island").map((l) => l.id)).toEqual(["circuit", "street-1", "street-2"]);
  expect(race_levels([{ id: "street-9" }], "island")).toEqual([]);
  expect(race_levels([{ id: "circuit" }], "mainland")[0].brings).toBe("One lap of the mainland circuit from a standing start.");
});

test("lobby choices carry name, length and whether laps apply", () => {
  expect(race_choices([{ id: "street-1", length: 1800, closed: false }, { id: "circuit", length: 4500, closed: true }])).toEqual([
    { id: "circuit", name: "Circuit", length: 4500, closed: true },
    { id: "street-1", name: "Town to town", length: 1800, closed: false },
  ]);
});

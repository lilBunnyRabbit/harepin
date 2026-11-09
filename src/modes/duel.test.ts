/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DUEL_LEAD, DUEL_LEVELS, DuelRun, DuelStatus, build_route } from "./duel";

const ROAD = Array.from({ length: 2000 }, (_, i) => {
  const a = (i / 2000) * Math.PI * 2;
  const r = 2000 / Math.PI;
  return { x: Math.sin(a) * r, z: Math.cos(a) * r, tx: Math.cos(a), tz: -Math.sin(a) };
});

test("routes are seeded, start at zero metres and grow up the ladder", () => {
  const route = build_route(5, ROAD, DUEL_LEVELS[0]);
  expect(build_route(5, ROAD, DUEL_LEVELS[0])).toEqual(route);
  expect(build_route(6, ROAD, DUEL_LEVELS[0]).points[0]).not.toEqual(route.points[0]);
  expect(route.at[DUEL_LEAD]).toBe(0);
  expect(route.at[0]).toBeLessThan(0);
  expect(route.length).toBeCloseTo((DUEL_LEVELS[0].points - 1) * 2, -1);
  const lengths = DUEL_LEVELS.map((level) => build_route(5, ROAD, level).length);
  lengths.slice(1).forEach((length, i) => expect(length).toBeGreaterThan(lengths[i]));
  expect(route.par_ms % 500).toBe(0);
});

test("run: clock starts at the line, finishes at the far end", () => {
  const route = build_route(5, ROAD, DUEL_LEVELS[0]);
  const run = new DuelRun(route);
  run.update(100, route.points[0].x, route.points[0].z);
  expect(run.status).toBe(DuelStatus.READY);
  for (let i = 1; i < route.points.length; i++) run.update(100, route.points[i].x, route.points[i].z);
  expect(run.status).toBe(DuelStatus.DONE);
  expect(run.elapsed()).toBe((route.points.length - 1 - DUEL_LEAD) * 100);
});

test("gap to the ghost in metres along the route", () => {
  const route = build_route(5, ROAD, DUEL_LEVELS[0]);
  const run = new DuelRun(route);
  for (let i = 0; i <= DUEL_LEAD + 50; i++) run.update(100, route.points[i].x, route.points[i].z);
  const ghost = route.points[DUEL_LEAD + 40];
  expect(run.gap(ghost)).toBeCloseTo(20, 0);
  const ahead = route.points[DUEL_LEAD + 55];
  expect(run.gap(ahead)).toBeCloseTo(-10, 0);
  expect(run.gap(null)).toBeNull();
});

test("stars against par", () => {
  const route = { ...build_route(5, ROAD, DUEL_LEVELS[0]), par_ms: 10_000 };
  const run = new DuelRun(route);
  run.status = DuelStatus.DONE;
  run.started = 0;
  run.ended = 10_000;
  expect(run.stars()).toBe(3);
  run.ended = 13_000;
  expect(run.stars()).toBe(1);
});

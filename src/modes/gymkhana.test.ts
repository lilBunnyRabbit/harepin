/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Solid } from "../world/world";
import { GymRun, HIT_MS, LEVELS, MISS_MS, RunStatus, Step, build_course, find_site, footprint, to_local, to_world, type Body, type SiteGround, type Site } from "./gymkhana";

const BODY: Body = { circles: [1.25, -1.25], radius: 1.05, length: 4.66, width: 1.9 };

function flat(solids: Solid[] = []): SiteGround {
  const road = Array.from({ length: 400 }, (_, i) => ({ x: 0, z: (i - 200) * 5, tx: 0, tz: 1 }));
  return { height: () => 5, distance_to_road: (x) => Math.abs(x), road, solids };
}

const SITE: Site = { x: 100, y: 5, z: 0, heading: 0.4 };

function drive(run: GymRun, path: [number, number, number, number][], t0 = 0): number {
  let t = t0;
  for (const [u, v, heading, speed] of path) {
    const { x, z } = to_world(run.course.site, u, v);
    t += 100;
    run.update(100, { x, z, heading: heading + run.course.site.heading, speed }, BODY);
  }
  return t;
}

function clean_path(run: GymRun): [number, number, number, number][] {
  const { cones, sides, spin, stop } = run.course;
  const path: [number, number, number, number][] = [[0, -2, 0, 8], [0, 5, 0, 8]];
  sides.forEach((side, i) => {
    const u = cones[i].u + side * 1.8;
    path.push([u, cones[i].v - 1, 0, 8], [u, cones[i].v + 1, 0, 8]);
  });
  for (let a = 0; a <= Math.PI + 0.01; a += 0.1) path.push([spin.u, spin.v, a, 3]);
  path.push([stop.u, stop.v + 10, Math.PI, 8], [stop.u, stop.v, Math.PI, 0.1]);
  return path;
}

test("course frame round-trips", () => {
  const { x, z } = to_world(SITE, 3, -7);
  const back = to_local(SITE, x, z);
  expect(back.u).toBeCloseTo(3);
  expect(back.v).toBeCloseTo(-7);
});

test("site: clear of the road and of solids, same every time", () => {
  const tree: Solid = { kind: "circle", x: 40, y: 5, z: 0, radius: 1, height: 6 };
  const ground = flat([tree]);
  const site = find_site(ground, 200);
  expect(site).not.toBeNull();
  if (!site) return;
  expect(find_site(ground, 200)).toEqual(site);
  const area = footprint();
  for (const [u, v] of [[area.u0, area.v0], [area.u1, area.v0], [area.u0, area.v1], [area.u1, area.v1]]) expect(Math.abs(to_world(site, u, v).x)).toBeGreaterThan(9);
  const local = to_local(site, tree.x, tree.z);
  expect(local.u < area.u0 || local.u > area.u1 || local.v < area.v0 || local.v > area.v1).toBe(true);
});

test("site: none on a hillside", () => {
  const road = Array.from({ length: 400 }, (_, i) => ({ x: 0, z: (i - 200) * 5, tx: 0, tz: 1 }));
  const slope = (grade: number): SiteGround => ({ height: (x) => 5 + Math.abs(x) * grade, distance_to_road: (x) => Math.abs(x), road, solids: [] });
  expect(find_site(slope(0.02), 200)).not.toBeNull();
  expect(find_site(slope(0.3), 200)).toBeNull();
});

test("levels get harder and courses are seeded", () => {
  const pars = LEVELS.map((level) => build_course(1, SITE, level).par_ms);
  expect(LEVELS.length).toBeGreaterThanOrEqual(5);
  expect(LEVELS.length).toBeLessThanOrEqual(8);
  LEVELS.slice(1).forEach((level, i) => {
    expect(level.spin).toBeLessThanOrEqual(LEVELS[i].spin);
    expect(level.stop.l).toBeLessThan(LEVELS[i].stop.l);
  });
  expect(pars.every((par) => par > 10_000 && par % 500 === 0)).toBe(true);
  expect(build_course(1, SITE, LEVELS[2])).toEqual(build_course(1, SITE, LEVELS[2]));
  expect(build_course(2, SITE, LEVELS[2]).cones).not.toEqual(build_course(1, SITE, LEVELS[2]).cones);
});

test("clean run: start line, slalom, spin, stop", () => {
  const run = new GymRun(build_course(3, SITE, LEVELS[1]));
  expect(run.status).toBe(RunStatus.READY);
  const end = drive(run, clean_path(run));
  expect(run.status).toBe(RunStatus.DONE);
  expect(run.step).toBe(Step.DONE);
  expect(run.hits).toBe(0);
  expect(run.misses).toBe(0);
  expect(run.total()).toBe(run.ended - run.started);
  expect(run.ended).toBe(run.clock);
  expect(end).toBeGreaterThan(0);
  expect(run.stars()).toBe(3);
});

test("cone hits and wrong sides cost time, each cone once", () => {
  const run = new GymRun(build_course(3, SITE, LEVELS[0]));
  const { cones, sides } = run.course;
  drive(run, [[0, -2, 0, 8], [0, 5, 0, 8], [cones[0].u - sides[0] * 1.8, cones[0].v - 1, 0, 8], [cones[0].u - sides[0] * 1.8, cones[0].v + 1, 0, 8]]);
  expect(run.misses).toBe(1);
  const hits = drive(run, [[cones[1].u, cones[1].v - 0.5, 0, 6], [cones[1].u, cones[1].v - 0.4, 0, 6]], 1000);
  expect(run.hits).toBe(1);
  expect(run.penalty_ms()).toBe(HIT_MS + MISS_MS);
  expect(hits).toBeGreaterThan(0);
});

test("no stop before the spin, and only facing home", () => {
  const run = new GymRun(build_course(3, SITE, LEVELS[0]));
  const path = clean_path(run).filter(([, , heading, speed]) => !(speed === 3 && heading > 0));
  drive(run, path);
  expect(run.step).toBe(Step.SPIN);
  const facing = new GymRun(build_course(3, SITE, LEVELS[0]));
  const wrong = clean_path(facing).map(([u, v, heading, speed]): [number, number, number, number] => [u, v, speed === 0.1 ? 0 : heading, speed]);
  drive(facing, wrong);
  expect(facing.status).toBe(RunStatus.RUNNING);
});

test("run clock counts only stepped sim time, not paused frames", () => {
  const run = new GymRun(build_course(3, SITE, LEVELS[1]));
  drive(run, [[0, -2, 0, 8], [0, 5, 0, 8]]);
  expect(run.status).toBe(RunStatus.RUNNING);
  const { x, z } = to_world(run.course.site, 0, 6);
  const pose = { x, z, heading: run.course.site.heading, speed: 0 };
  const before = run.elapsed();
  for (let i = 0; i < 50; i++) run.update(0, pose, BODY);
  expect(run.elapsed()).toBe(before);
  run.update(16, pose, BODY);
  expect(run.elapsed()).toBe(before + 16);
});

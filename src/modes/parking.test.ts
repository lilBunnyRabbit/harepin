/// <reference types="bun" />
import { expect, test } from "bun:test";
import { to_world, type Body, type Site } from "./gymkhana";
import { HOLD_MS, PARK_ANGLE, PARK_IDS, PARK_LEVELS, ParkRun, ParkStatus, STRAIGHT_ANGLE, Verdict, fit, park_solids, park_stars, touching, type ParkBay, type ParkLevel } from "./parking";
import { Track, type Store } from "./track";

const COUPE: Body = { circles: [1.25, -1.25], radius: 1.05, length: 4.66, width: 1.9 };
const MUSCLE: Body = { circles: [1.4, -1.4], radius: 1.1, length: 5.0, width: 2.0 };
const SITE: Site = { x: 40, y: 0, z: -12, heading: 0.7 };
const DEG = Math.PI / 180;

function pose(site: Site, u: number, v: number, heading: number, speed = 0) {
  const { x, z } = to_world(site, u, v);
  return { x, z, heading: site.heading + heading, speed };
}

function at_bay(bay: ParkBay, flip = false, along = 0, turn = 0) {
  const heading = bay.heading + (flip ? Math.PI : 0) + turn;
  return pose(SITE, bay.u + Math.sin(bay.heading) * along, bay.v + Math.cos(bay.heading) * along, heading);
}

function solids(level: ParkLevel) {
  return park_solids(SITE, level, () => 0);
}

function memory(): Store {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function park(run: ParkRun, end: ReturnType<typeof pose>, ms: number) {
  const { start } = run.level;
  run.update(100, pose(SITE, start.u, start.v, start.heading, 2), COUPE);
  run.update(ms - 100, { ...end, speed: 1 }, COUPE);
  for (let t = 0; t < HOLD_MS + 100; t += 100) run.update(100, end, COUPE);
}

test("the ladder runs easy to hard with unique ids", () => {
  expect(new Set(PARK_IDS).size).toBe(PARK_IDS.length);
  expect(PARK_LEVELS.map((l) => l.name)).toEqual(["Wide bay", "Between cars", "Reverse bay", "Parallel", "Garage", "Angled", "Tight parallel", "Tight garage"]);
  for (let i = 1; i < PARK_LEVELS.length; i++) expect(PARK_LEVELS[i].par_ms).toBeGreaterThanOrEqual(PARK_LEVELS[i - 1].par_ms - 10000);
});

for (const level of PARK_LEVELS)
  test(`${level.id} ${level.name}: start and bay are clear, the bay fits the biggest body`, () => {
    const s = solids(level);
    const { start, bay } = level;
    expect(touching(s, pose(SITE, start.u, start.v, start.heading), MUSCLE)).toBe(false);
    for (const body of [COUPE, MUSCLE]) {
      const centred = at_bay(bay);
      expect(touching(s, centred, body)).toBe(false);
      expect(fit(SITE, bay, centred, body).verdict).toBe(Verdict.INSIDE);
    }
    expect(bay.w).toBeGreaterThanOrEqual(2.3);
  });

test("fit: outside, crooked, backwards and inside", () => {
  const bay: ParkBay = { u: 0, v: 10, heading: 0, w: 3, l: 6, either: false };
  expect(fit(SITE, bay, at_bay(bay), COUPE).verdict).toBe(Verdict.INSIDE);
  expect(fit(SITE, bay, at_bay(bay, false, 1.2), COUPE).verdict).toBe(Verdict.OUTSIDE);
  expect(fit(SITE, bay, at_bay(bay, false, 0, PARK_ANGLE + 2 * DEG), COUPE).verdict).toBe(Verdict.CROOKED);
  expect(fit(SITE, bay, at_bay(bay, true), COUPE).verdict).toBe(Verdict.BACKWARDS);
  const turned = fit(SITE, bay, at_bay(bay, false, 0.4, 3 * DEG), COUPE);
  expect(turned.verdict).toBe(Verdict.INSIDE);
  expect(turned.angle).toBeCloseTo(3 * DEG);
  expect(turned.offset).toBeCloseTo(0.4);
});

test("fit: an either bay takes the car both ways round", () => {
  const bay: ParkBay = { u: 0, v: 10, heading: Math.PI / 2, w: 2.6, l: 5.6, either: true };
  const back = fit(SITE, bay, at_bay(bay, true, 0, 1 * DEG), COUPE);
  expect(back.verdict).toBe(Verdict.INSIDE);
  expect(back.angle).toBeCloseTo(1 * DEG);
});

test("park_stars: each miss costs a star, never below one", () => {
  const par = 20000;
  const clean = { ms: par, touches: 0, angle: STRAIGHT_ANGLE };
  expect(park_stars(clean, par)).toBe(3);
  expect(park_stars({ ...clean, touches: 1 }, par)).toBe(2);
  expect(park_stars({ ...clean, touches: 3 }, par)).toBe(1);
  expect(park_stars({ ...clean, ms: par + 1 }, par)).toBe(2);
  expect(park_stars({ ...clean, angle: STRAIGHT_ANGLE + 0.001 }, par)).toBe(2);
  expect(park_stars({ ms: par * 3, touches: 9, angle: PARK_ANGLE }, par)).toBe(1);
});

test("run: clock waits for the car to move, a still park finishes it", () => {
  const level = PARK_LEVELS[0];
  const run = new ParkRun(SITE, level, solids(level));
  run.update(5000, pose(SITE, 0, 0, 0, 0), COUPE);
  expect(run.status).toBe(ParkStatus.READY);
  park(run, at_bay(level.bay), 9000);
  expect(run.status).toBe(ParkStatus.DONE);
  expect(run.elapsed()).toBeGreaterThanOrEqual(8900 + HOLD_MS);
  expect(run.elapsed()).toBeLessThan(9000 + HOLD_MS + 200);
  expect(run.touches).toBe(0);
  expect(run.stars()).toBe(3);
});

test("run: rolling through the bay or stopping crooked does not finish", () => {
  const level = PARK_LEVELS[0];
  const run = new ParkRun(SITE, level, solids(level));
  run.update(100, pose(SITE, 0, 0, 0, 2), COUPE);
  for (let t = 0; t < 3000; t += 100) run.update(100, { ...at_bay(level.bay), speed: 1 }, COUPE);
  expect(run.status).toBe(ParkStatus.RUNNING);
  for (let t = 0; t < 3000; t += 100) run.update(100, at_bay(level.bay, false, 0, 10 * DEG), COUPE);
  expect(run.status).toBe(ParkStatus.RUNNING);
  expect(run.last.verdict).toBe(Verdict.CROOKED);
});

test("run: a touch counts once per contact, a fresh one after a clear gap", () => {
  const level = PARK_LEVELS[1];
  const s = solids(level);
  const parked = level.obstacles.find((o) => o.kind === "car")!;
  const scrape = pose(SITE, parked.u - 2.25 - 1.05 - 1.25, parked.v, Math.PI / 2, 1);
  expect(touching(s, scrape, COUPE)).toBe(true);
  const run = new ParkRun(SITE, level, s);
  run.update(100, pose(SITE, level.start.u, level.start.v, 0, 2), COUPE);
  for (let i = 0; i < 5; i++) run.update(100, scrape, COUPE);
  expect(run.touches).toBe(1);
  run.update(100, pose(SITE, level.start.u, level.start.v, 0, 2), COUPE);
  run.update(100, scrape, COUPE);
  expect(run.touches).toBe(1);
  run.update(600, pose(SITE, level.start.u, level.start.v, 0, 2), COUPE);
  run.update(100, scrape, COUPE);
  expect(run.touches).toBe(2);
});

test("track: stars unlock the next level and the best is kept per seed", () => {
  const store = memory();
  const track = new Track("parking", 7, PARK_IDS, store);
  expect(track.is_open("p1")).toBe(true);
  expect(track.is_open("p2")).toBe(false);
  track.record("p1", { stars: 2, ms: 12000 });
  expect(track.is_open("p2")).toBe(true);
  expect(track.record("p1", { stars: 1, ms: 9000 }).improved).toBe(false);
  expect(track.record("p1", { stars: 3, ms: 14000 }).improved).toBe(true);
  expect(new Track("parking", 7, PARK_IDS, store).runs.p1).toEqual({ stars: 3, ms: 14000 });
  expect(new Track("parking", 8, PARK_IDS, store).runs.p1).toBeUndefined();
});

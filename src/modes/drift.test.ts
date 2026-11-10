/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Solid } from "../world/world";
import { Combo, ComboEnd, DRIFT_LEVELS, DriftRun, DriftStatus, GRACE_MS, LEAD, MAX_MULT, MULT_MS, build_zone, drift_stars, slip } from "./drift";
import type { Body } from "./gymkhana";
import { RouteTracker, bendiest } from "./route";
import { better, parse_runs } from "./track";

const DEG = Math.PI / 180;
const BODY: Body = { circles: [1.25, -1.25], radius: 1.05, length: 4.66, width: 1.9 };

function wiggly(n = 800) {
  const road = [];
  let x = 0;
  let z = 0;
  for (let i = 0; i < n; i++) {
    const heading = i > 300 && i < 500 ? Math.sin((i - 300) / 15) * 1.2 : 0;
    const tx = Math.sin(heading);
    const tz = Math.cos(heading);
    road.push({ x, z, tx, tz });
    x += tx * 2;
    z += tz * 2;
  }
  return road;
}

test("slip is the angle between heading and travel", () => {
  expect(slip({ heading: 0, vx: 0, vz: 10 })).toBeCloseTo(0);
  expect(slip({ heading: 0, vx: 10, vz: 10 }) / DEG).toBeCloseTo(45);
  expect(slip({ heading: 0, vx: -10, vz: 10 }) / DEG).toBeCloseTo(45);
  expect(slip({ heading: Math.PI / 2, vx: 0, vz: 10 }) / DEG).toBeCloseTo(90);
});

test("score is angle × speed × time at the multiplier", () => {
  const combo = new Combo();
  combo.step(1000, 30 * DEG, 20, true, false);
  expect(combo.chain).toBeCloseTo(30 * 20 * 0.1);
  expect(combo.mult).toBe(1);
  const capped = new Combo();
  capped.step(1000, 80 * DEG, 20, true, false);
  expect(capped.chain).toBeCloseTo(60 * 20 * 0.1);
});

test("too slow, too straight or spun out scores nothing", () => {
  for (const [angle, speed] of [
    [30 * DEG, 5],
    [5 * DEG, 20],
    [120 * DEG, 20],
  ]) {
    const combo = new Combo();
    combo.step(1000, angle, speed, true, false);
    expect(combo.score).toBe(0);
  }
});

test("multiplier climbs while the slide lasts, up to the cap", () => {
  const combo = new Combo();
  for (let t = 0; t < MULT_MS * 2; t += 100) combo.step(100, 30 * DEG, 20, true, false);
  expect(combo.mult).toBe(3);
  for (let t = 0; t < MULT_MS * 10; t += 100) combo.step(100, 30 * DEG, 20, true, false);
  expect(combo.mult).toBe(MAX_MULT);
});

test("a short straighten keeps the chain, a long one banks it", () => {
  const combo = new Combo();
  for (let t = 0; t < 3000; t += 100) combo.step(100, 30 * DEG, 20, true, false);
  const chain = combo.chain;
  expect(combo.step(GRACE_MS - 100, 0, 20, true, false)).toBe(ComboEnd.NONE);
  expect(combo.chain).toBe(chain);
  expect(combo.mult).toBe(2);
  expect(combo.step(200, 0, 20, true, false)).toBe(ComboEnd.BANKED);
  expect(combo.chain).toBe(0);
  expect(combo.mult).toBe(1);
  expect(combo.banked).toBe(chain);
  expect(combo.best_chain).toBe(chain);
});

test("a wall touch throws the live chain away, banked points stay", () => {
  const combo = new Combo();
  combo.step(1000, 30 * DEG, 20, true, false);
  combo.step(GRACE_MS, 0, 20, true, false);
  const banked = combo.banked;
  combo.step(1000, 30 * DEG, 20, true, false);
  expect(combo.step(16, 30 * DEG, 20, true, true)).toBe(ComboEnd.LOST);
  expect(combo.score).toBe(banked);
  expect(combo.lost).toBe(1);
  expect(combo.step(16, 30 * DEG, 20, true, true)).toBe(ComboEnd.NONE);
});

test("off the road or going backwards runs the grace clock instead of scoring", () => {
  const combo = new Combo();
  combo.step(500, 30 * DEG, 20, false, false);
  expect(combo.score).toBe(0);
});

test("stars by score thresholds", () => {
  const zone = { silver: 500, gold: 1000 };
  expect(drift_stars(0, zone)).toBe(1);
  expect(drift_stars(500, zone)).toBe(2);
  expect(drift_stars(999, zone)).toBe(2);
  expect(drift_stars(1000, zone)).toBe(3);
});

test("zones sit on the bendiest stretch, seeded, with rising targets", () => {
  const road = wiggly();
  const [best] = bendiest(road, 100, 3);
  expect(best).toBeGreaterThan(250);
  expect(best).toBeLessThan(450);
  const a = build_zone(7, road, DRIFT_LEVELS[0]);
  expect(build_zone(7, road, DRIFT_LEVELS[0])).toEqual(a);
  expect(a.points.length).toBe(DRIFT_LEVELS[0].points + LEAD);
  const zones = DRIFT_LEVELS.map((level) => build_zone(7, road, level));
  zones.slice(1).forEach((zone, i) => expect(zone.gold / zone.length).toBeGreaterThan(zones[i].gold / zones[i].length));
  for (const zone of zones) expect(zone.silver).toBeLessThan(zone.gold);
});

test("tracker follows the car and ignores a far stretch of road", () => {
  const points = [...Array(50).keys()].map((i) => ({ x: 0, z: i * 2, tx: 0, tz: 1 }));
  const loop = [...points, ...points.map((p, i) => ({ x: 1, z: 98 - i * 2, tx: 0, tz: -1 }))];
  const tracker = new RouteTracker(loop, 10);
  expect(tracker.update(0, 0)).toBe(0);
  expect(tracker.update(0.4, 10)).toBe(5);
  expect(tracker.index).toBeLessThan(50);
});

test("run: starts at the zone line, scores, ends at the far end", () => {
  const road = wiggly();
  const zone = build_zone(7, road, DRIFT_LEVELS[0]);
  const run = new DriftRun(zone, []);
  const step = (i: number, angle: number) => {
    const p = zone.points[i];
    const travel = Math.atan2(p.tx, p.tz);
    return run.update(100, { x: p.x, z: p.z, heading: travel + angle, vx: p.tx * 18, vz: p.tz * 18 }, BODY, 6);
  };
  step(0, 0);
  expect(run.status).toBe(DriftStatus.READY);
  for (let i = LEAD; i < zone.points.length; i++) step(i, 30 * DEG);
  expect(run.status).toBe(DriftStatus.DONE);
  expect(run.combo.chain).toBe(0);
  expect(run.combo.score).toBeGreaterThan(0);
  expect(run.timed_out).toBe(false);
});

test("run: a solid by the road drops the combo", () => {
  const road = wiggly();
  const zone = build_zone(7, road, DRIFT_LEVELS[0]);
  const p = zone.points[LEAD + 10];
  const tree: Solid = { kind: "circle", x: p.x, y: 0, z: p.z, radius: 0.5, height: 5 };
  const run = new DriftRun(zone, [tree]);
  for (let i = LEAD; i <= LEAD + 10; i++) {
    const q = zone.points[i];
    run.update(100, { x: q.x, z: q.z, heading: Math.atan2(q.tx, q.tz) + 30 * DEG, vx: q.tx * 18, vz: q.tz * 18 }, BODY, 6);
  }
  expect(run.combo.lost).toBe(1);
});

test("runs rank by stars, then score, and the score survives a save", () => {
  expect(better({ stars: 2, ms: 1000, score: 900 }, { stars: 2, ms: 5000, score: 950 })).toBe(true);
  expect(better({ stars: 2, ms: 5000, score: 950 }, { stars: 2, ms: 1000, score: 900 })).toBe(false);
  expect(parse_runs({ d1: { stars: 2, ms: 10, score: 400 }, d2: { stars: 2, ms: 10, score: -1 } })).toEqual({ d1: { stars: 2, ms: 10, score: 400 } });
});

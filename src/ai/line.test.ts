/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { drive_at, plan_for, race_line } from "./line";
import { hold_speed } from "./corners";
import { UNIT_SCALE } from "./capability";
import { AI_TUNING } from "./tuning";
import type { LineGround } from "./hazards";
import { ROAD_HALF, RouteKind, type RoadPoint } from "../worldgen/types";
import { World } from "../world/world";
import { flight } from "../worldgen/jumps";

/** A closed stadium: two straights joined by half circles, points 2 m apart, driven anticlockwise. */
function stadium(straight: number, radius: number): RoadPoint[] {
  const points: RoadPoint[] = [];
  const add = (x: number, z: number, tx: number, tz: number) => points.push({ x, y: 0, z, tx, tz });
  for (let s = 0; s < straight; s += 2) add(radius, s, 0, 1);
  for (let a = 0; a < Math.PI; a += 2 / radius) add(Math.cos(a) * radius, straight + Math.sin(a) * radius, -Math.sin(a), Math.cos(a));
  for (let s = straight; s > 0; s -= 2) add(-radius, s, 0, -1);
  for (let a = Math.PI; a < 2 * Math.PI; a += 2 / radius) add(Math.cos(a) * radius, Math.sin(a) * radius, -Math.sin(a), Math.cos(a));
  return points;
}

const lap = (line: ReturnType<typeof race_line>) => line.step.reduce((t, s, i) => t + s / line.speed[i], 0);

describe("race line", () => {
  const road = stadium(200, 30);
  const line = race_line(road, [], 1);

  test("stays inside the road less the car's width", () => {
    for (let i = 0; i < road.length; i++) expect(Math.abs(line.offset[i])).toBeLessThanOrEqual(line.room[i] + 1e-9);
  });

  test("wide, inside, wide: plans a quicker lap than the centreline", () => {
    const centre = race_line(road, [], 100);
    expect(lap(line)).toBeLessThan(lap(centre) * 0.99);
  });

  test("every bend can be braked for: no point plans faster than the next allows", () => {
    const n = road.length;
    for (let i = 0; i < n; i++) {
      const next = line.speed[(i + 1) % n];
      expect(line.speed[i] ** 2).toBeLessThanOrEqual(next * next + 2 * AI_TUNING.line_brake * line.step[i] + 1e-6);
    }
  });

  test("no exit plans more than the car pulls: each point at most what full throttle from the last gives", () => {
    const n = road.length;
    for (let i = 0; i < n; i++) {
      const next = line.speed[(i + 1) % n];
      expect(next ** 2).toBeLessThanOrEqual(line.speed[i] ** 2 + 2 * drive_at(line.speed[i]) * line.step[i] + 1e-6);
    }
  });

  test("over a crest it plans under the take-off speed, whatever the bend allows", () => {
    const y = (z: number) => 2 * Math.exp(-(((z - 100) / 12) ** 2));
    const hump = road.map((p, i) => (i > 20 && i < 80 ? { ...p, y: y(p.z) } : p));
    const crested = race_line(hump, [], 1);
    const top = hump.findIndex((p, i) => i > 20 && i < 80 && p.z >= 100);
    // The line reads a crest over 20 m either side: its take-off speed is the one that chord gives.
    const peak = (2 * y(100) - y(80) - y(120)) / 20 ** 2;
    expect(crested.speed[top]).toBeLessThanOrEqual(Math.sqrt(9.81 / peak));
    expect(line.speed[top]).toBeGreaterThan(Math.sqrt(9.81 / peak));
  });

  // Halfway down the first straight (x = 30, heading +z), where the right normal points to +x.
  const at = road.findIndex((p) => p.x === 30 && p.z >= 100);
  const side = Math.sign(line.offset[at]);
  test("the straight runs off the centre, so a hazard on its side moves it", () => expect(Math.abs(line.offset[at])).toBeGreaterThan(1));
  const hump = (z: number) => 0.3 * Math.exp(-(((z - 100) / 1.2) ** 2));
  const flat: LineGround = { height: () => 0, touches: () => 0 };

  test("a one-sided step moves the line off it, to the clear side of the road", () => {
    const ground: LineGround = { ...flat, height: (x, z) => (x > 25 && x < 35 && (x - 30) * side > 1.5 ? hump(z) : 0) };
    const stepped = race_line(road, [], 1, ground);
    for (let i = at - 1; i <= at + 1; i++) expect(stepped.offset[i] * side).toBeLessThanOrEqual(1e-9);
    expect(stepped.hi[at] * side).toBeLessThanOrEqual(0);
  });

  test("a ripple across the whole road is no step: the line runs over it", () => {
    const ground: LineGround = { ...flat, height: (x, z) => (x > 20 && x < 40 ? hump(z) : 0) };
    const rippled = race_line(road, [], 1, ground);
    expect(Array.from(rippled.offset)).toEqual(Array.from(race_line(road, [], 1, flat).offset));
    expect(rippled.lo[at]).toBe(-(ROAD_HALF - 1));
    expect(rippled.hi[at]).toBe(ROAD_HALF - 1);
  });

  test("steps on one side then the other within a few metres are taken, not woven through", () => {
    const ground: LineGround = { ...flat, height: (x, z) => (x > 25 && x < 35 ? ((x - 30) * side > 0 ? hump(z) : hump(z - 4)) : 0) };
    const woven = race_line(road, [], 1, ground);
    for (let i = at - 5; i <= at + 7; i++) expect(Math.abs(woven.offset[i + 1] - woven.offset[i])).toBeLessThan(0.3);
    expect(woven.kick[at]).toBe(1);
    expect(woven.kick[at + 2]).toBe(1);
    expect(woven.hi[at] - woven.lo[at]).toBe(2 * (ROAD_HALF - 1));
  });

  test("the corner model only raises the plan, and never past the car's measured grip", () => {
    const { model_pace, model_brake } = AI_TUNING;
    AI_TUNING.model_pace = 0;
    AI_TUNING.model_brake = 0;
    const plain = plan_for(line, UNIT_SCALE);
    AI_TUNING.model_pace = model_pace;
    AI_TUNING.model_brake = model_brake;
    const modelled = plan_for(line, UNIT_SCALE);
    for (let i = 0; i < road.length; i++) {
      expect(modelled.speed[i]).toBeGreaterThanOrEqual(plain.speed[i] - 1e-9);
      const radius = 1 / Math.max(1e-9, Math.abs(line.bend[i]));
      expect(modelled.speed[i]).toBeLessThanOrEqual(Math.max(plain.speed[i], hold_speed(radius, UNIT_SCALE.car)) + 1e-9);
    }
  });

  test("a car's model share takes that share of the raise: none plans as the line alone, half plans between", () => {
    const { model_pace, model_brake } = AI_TUNING;
    AI_TUNING.model_pace = 0;
    AI_TUNING.model_brake = 0;
    const plain = plan_for(line, UNIT_SCALE);
    AI_TUNING.model_pace = model_pace;
    AI_TUNING.model_brake = model_brake;
    const full = plan_for(line, UNIT_SCALE);
    const none = plan_for(line, { ...UNIT_SCALE, model: 0 });
    const half = plan_for(line, { ...UNIT_SCALE, model: 0.5 });
    expect(Array.from(none.speed)).toEqual(Array.from(plain.speed));
    for (let i = 0; i < road.length; i++) {
      expect(half.speed[i]).toBeGreaterThanOrEqual(plain.speed[i] - 1e-9);
      expect(half.speed[i]).toBeLessThanOrEqual(full.speed[i] + 1e-9);
    }
  });

  test("a car's pull_bend only slows the pull out of a bend: none plans as before, more never plans faster", () => {
    const base = plan_for(line, UNIT_SCALE);
    const none = plan_for(line, { ...UNIT_SCALE, pull_bend: 0 });
    const half = plan_for(line, { ...UNIT_SCALE, pull_bend: 0.5 });
    const full = plan_for(line, { ...UNIT_SCALE, pull_bend: 1 });
    expect(Array.from(none.speed)).toEqual(Array.from(base.speed));
    let slower = 0;
    for (let i = 0; i < road.length; i++) {
      expect(half.speed[i]).toBeLessThanOrEqual(base.speed[i] + 1e-9);
      expect(full.speed[i]).toBeLessThanOrEqual(half.speed[i] + 1e-9);
      if (full.speed[i] < base.speed[i] - 0.1) slower++;
    }
    expect(slower).toBeGreaterThan(0);
  });

  test("a solid on the road holds the line a car's width off it", () => {
    const post = { x: 30 + side * 3.5, z: 100 };
    const ground: LineGround = { ...flat, touches: (car, gap) => (Math.hypot(car.pos.x - post.x, car.pos.z - post.z) < car.spec.radius + 0.3 + gap ? 1 : 0) };
    const posted = race_line(road, [], 1, ground);
    for (let i = at - 1; i <= at + 1; i++) expect(Math.abs(30 + posted.offset[i] - post.x)).toBeGreaterThan(1 + 0.3);
  });

  test("a road kicker is planned at a take-off whose flight clears its opening's top, lower for a car that rides taller", () => {
    const world = new World(44);
    const route = world.routes.find((r) => r.kind === RouteKind.CIRCUIT);
    if (!route) throw new Error("island seed 44 has no circuit");
    const line = race_line(route.points, world.ramps, 1, undefined, UNIT_SCALE, world.challenges);
    const k = line.gaps.findIndex((g) => g !== undefined);
    const gap = line.gaps[k];
    if (!gap) throw new Error("island seed 44's circuit has no kicker with an opening");
    const toe = (roof: number) => {
      const plan = plan_for(line, { ...UNIT_SCALE, roof });
      let v = Infinity;
      for (let i = 0; i < plan.ramp.length; i++) if (plan.ramp[i] === k && plan.kick[i]) v = Math.min(v, plan.speed[i]);
      return v;
    };
    const low = toe(UNIT_SCALE.roof);
    const tall = toe(UNIT_SCALE.roof + 0.3);
    expect(tall).toBeLessThan(low);
    expect(tall).toBeGreaterThanOrEqual(gap.ramp.speed);
    expect(flight(gap.ramp, low, gap.d) + UNIT_SCALE.roof).toBeLessThan(gap.top);
  });
});

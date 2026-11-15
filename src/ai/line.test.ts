/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { bank_floor, bank_pace, grip_at, race_line } from "./line";
import { BANK_OVER } from "./tuning";
import { GRAVITY } from "../car/rigid-body";
import type { RoadPoint } from "../worldgen/types";

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
      expect(line.speed[i] ** 2).toBeLessThanOrEqual(next * next + 2 * 2.5 * line.step[i] + 1e-6);
    }
  });

  test("an all-flat bank array plans the same line as none, to the bit", () => {
    const flat = race_line(road, [], 1, new Float64Array(road.length));
    expect(Array.from(flat.speed)).toEqual(Array.from(line.speed));
    expect(Array.from(flat.offset)).toEqual(Array.from(line.offset));
  });

  test("a steep bowl plans between its neutral speed and BANK_OVER times it, and faster than flat", () => {
    const bowl = (50 * Math.PI) / 180;
    const banks = Float64Array.from(line.bend, (k) => (Math.abs(k) > 1e-3 ? Math.sign(k) * bowl : 0));
    const banked = race_line(road, [], 1, banks);
    let checked = 0;
    for (let i = 0; i < road.length; i++) {
      if (banks[i] === 0) continue;
      const k = banked.bend[i];
      const neutral = Math.sqrt((GRAVITY * Math.tan(bowl)) / Math.abs(k));
      expect(bank_floor(k, banks[i])).toBeCloseTo(neutral, 6);
      const pace = bank_pace(k, banks[i], grip_at(k), Math.sqrt(grip_at(k) / Math.abs(k)));
      expect(pace).toBeGreaterThanOrEqual(neutral - 1e-9);
      expect(pace).toBeLessThanOrEqual(BANK_OVER * neutral + 1e-9);
      expect(banked.speed[i]).toBeLessThanOrEqual(pace + 1e-9);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
    expect(lap(banked)).toBeLessThan(lap(line));
  });
});

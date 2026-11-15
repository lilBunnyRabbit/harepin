/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { race_line } from "./line";
import { AI_TUNING } from "./tuning";
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
      expect(line.speed[i] ** 2).toBeLessThanOrEqual(next * next + 2 * AI_TUNING.line_brake * line.step[i] + 1e-6);
    }
  });
});

/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { Standings } from "./standings";

describe("race standings", () => {
  test("order by progress, gaps by when the car ahead stood here, finishers by time", () => {
    const s = new Standings(3, 100, 2, 2);
    s.update(0, [-3, -7, -11]);
    expect(s.order).toEqual([0, 1, 2]);
    expect(s.gap(0, 1, 0)).toBeNaN();
    s.update(10, [50, 40, 45]);
    expect(s.order).toEqual([0, 2, 1]);
    s.update(12, [60, 50, 48]);
    expect(s.gap(0, 1, 12)).toBeCloseTo(2);
    expect(s.gap(0, 2, 12)).toBeCloseTo(2);
    s.update(30, [200, 190, 210]);
    expect(s.finish[0]).toBe(30);
    expect(s.finish[2]).toBe(Infinity);
    expect(s.place(2)).toBe(2);
    s.finished(2, 31);
    s.update(32, [205, 200, 212]);
    expect(s.order).toEqual([0, 2, 1]);
    expect(s.gap(0, 1, 40)).toBeCloseTo(2);
  });
});

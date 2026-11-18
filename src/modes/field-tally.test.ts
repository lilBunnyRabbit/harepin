import { expect, test } from "bun:test";
import { FieldTally } from "./field-tally";

const PER_LAP = 100;

test("a knockout drops the last car still in at each share of the leader's distance", () => {
  const tally = new FieldTally(4, PER_LAP, 1, true);
  const order = [0, 1, 2, 3];
  expect(tally.update(1, [20, 15, 10, 5], order)).toBe(-1);
  expect(tally.update(2, [25, 20, 15, 10], order)).toBe(3);
  expect(tally.update(3, [30, 25, 20, 15], order)).toBe(-1);
  expect(tally.update(4, [50, 45, 40, 35], order)).toBe(2);
  expect(tally.update(5, [75, 70, 65, 60], order)).toBe(1);
  expect(tally.left()).toBe(1);
  expect(tally.update(6, [99, 98, 97, 96], order)).toBe(-1);
  expect(tally.final_order(order)).toEqual([0, 1, 2, 3]);
});

test("without a knockout nobody goes out, and each lap is timed from progress", () => {
  const tally = new FieldTally(2, PER_LAP, 2, false);
  tally.update(0, [0, 0], [0, 1]);
  tally.update(50, [100, 90], [0, 1]);
  tally.update(60, [120, 100], [0, 1]);
  tally.update(95, [200, 180], [0, 1]);
  expect(tally.out).toEqual([]);
  expect(tally.best_lap[0]).toBe(45);
  expect(tally.best_lap[1]).toBe(60);
  expect(tally.fastest(0)).toBe(true);
  expect(tally.fastest(1)).toBe(false);
});

test("beats: a lap time stands as fastest only when no other car went under it", () => {
  const tally = new FieldTally(2, PER_LAP, 2, false);
  tally.update(0, [0, 0], [0, 1]);
  tally.update(50, [100, 90], [0, 1]);
  tally.update(60, [120, 100], [0, 1]);
  tally.update(95, [200, 180], [0, 1]);
  expect(tally.beats(0, 45)).toBe(true);
  expect(tally.beats(0, 61)).toBe(false);
  expect(tally.beats(0, Infinity)).toBe(false);
});

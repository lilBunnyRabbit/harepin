import { expect, test } from "bun:test";
import { advance, finish, type Steps } from "./steps";

function* count_to(n: number, seen: number[]): Steps<string> {
  for (let i = 0; i < n; i++) {
    seen.push(i);
    yield;
  }
  return "done";
}

test("finish runs every step and returns the value", () => {
  const seen: number[] = [];
  expect(finish(count_to(4, seen))).toBe("done");
  expect(seen).toEqual([0, 1, 2, 3]);
});

test("advance takes at least one step, stops at its budget and picks up where it stopped", () => {
  const seen: number[] = [];
  const steps = count_to(3, seen);
  expect(advance(steps, 0).done).toBe(false);
  expect(seen).toEqual([0]);
  expect(advance(steps, 0).done).toBe(false);
  expect(advance(steps, 1000)).toEqual({ done: true, value: "done" });
  expect(seen).toEqual([0, 1, 2]);
});

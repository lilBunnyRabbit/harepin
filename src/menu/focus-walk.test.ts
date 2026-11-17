import { expect, test } from "bun:test";
import { first_spot, walk_step, type Spot } from "./focus-walk";

const spot = (left: number, top: number, bar = false, group: unknown = null): Spot => ({ left, top, right: left + 100, bottom: top + 40, group, bar });

// A station bar over a page body of two columns and two rows.
const HOME = spot(300, 0, true, "bar");
const EVENTS = spot(420, 0, true, "bar");
const A = spot(0, 100);
const B = spot(400, 100);
const C = spot(0, 160);
const D = spot(400, 160);
const PAGE = [HOME, EVENTS, A, B, C, D];
const at = (one: Spot) => PAGE.indexOf(one);

test("the first focus of a page is in its body, never the station bar", () => {
  expect(first_spot(PAGE)).toBe(at(A));
  expect(first_spot([HOME, EVENTS])).toBe(-1);
});

test("arrows walk the body's rows and columns", () => {
  expect(walk_step(at(A), PAGE, "right")).toBe(at(B));
  expect(walk_step(at(A), PAGE, "down")).toBe(at(C));
  expect(walk_step(at(D), PAGE, "left")).toBe(at(C));
  expect(walk_step(at(D), PAGE, "up")).toBe(at(B));
});

test("at an edge focus stays: no arrow leaves the body for the station bar", () => {
  expect(walk_step(at(A), PAGE, "up")).toBe(-1);
  expect(walk_step(at(B), PAGE, "up")).toBe(-1);
  expect(walk_step(at(A), PAGE, "left")).toBe(-1);
  expect(walk_step(at(D), PAGE, "right")).toBe(-1);
  expect(walk_step(at(D), PAGE, "down")).toBe(-1);
});

test("focus that sits on the bar walks down into the body", () => {
  expect(walk_step(at(HOME), PAGE, "down")).toBe(at(B));
});

test("a neighbour in the same group beats a nearer one outside it", () => {
  const near = spot(0, 50, false, "other");
  const far = spot(0, 300, false, "list");
  const from = spot(0, 0, false, "list");
  expect(walk_step(0, [from, near, far], "down")).toBe(2);
});

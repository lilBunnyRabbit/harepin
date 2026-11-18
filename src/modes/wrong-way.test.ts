/// <reference types="bun" />
import { expect, test } from "bun:test";
import { WrongWay, faces_back } from "./wrong-way";

const NORTH = { x: 0, z: 0, tx: 0, tz: 1 };
const HALF = 6;

test("wrong way: on once the car faces back down the route, off only when it points along it again on the road", () => {
  const way = new WrongWay();
  expect(way.update(NORTH, 0, 0, HALF)).toBe(false);
  expect(way.update(NORTH, Math.PI / 2, 0, HALF)).toBe(false);
  expect(way.update(NORTH, Math.PI, 0, HALF)).toBe(true);
  expect(way.update(NORTH, Math.PI / 2, 0, HALF)).toBe(true);
  expect(way.update(NORTH, 0.2, 30, HALF)).toBe(true);
  expect(way.update(NORTH, 0.2, 3, HALF)).toBe(false);
});

test("wrong way: a slide past sideways that never turns the car round does not set it", () => {
  const way = new WrongWay();
  expect(way.update(NORTH, 1.7, 0, HALF)).toBe(false);
  expect(way.update(NORTH, -1.7, 20, HALF)).toBe(false);
});

test("faces back: only while the car points back down the route, not driving forward off it", () => {
  expect(faces_back(NORTH, Math.PI)).toBe(true);
  expect(faces_back(NORTH, 0.3)).toBe(false);
  expect(faces_back(NORTH, Math.PI / 2)).toBe(false);
});

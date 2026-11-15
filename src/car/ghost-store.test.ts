/// <reference types="bun" />
import { expect, test } from "bun:test";
import { faster, parse_lap, stored_lap } from "./ghost-store";

const lap = (end_ms: number) => [0, 1, 2, 3, 0, 0, 0, 1, end_ms, 4, 5, 6, 0, 0, 0, 1];

test("the faster lap wins, a tie keeps the stored one, and a missing side takes the other", () => {
  const slow = lap(9000);
  const quick = lap(8000);
  expect(faster(slow, quick)).toBe(quick);
  expect(faster(quick, slow)).toBe(quick);
  const twin = lap(9000);
  expect(faster(slow, twin)).toBe(slow);
  expect(faster(null, slow)).toBe(slow);
  expect(faster(slow, null)).toBe(slow);
  expect(faster(null, null)).toBeNull();
});

test("an old localStorage lap parses only as JSON of a whole lap", () => {
  expect(parse_lap(JSON.stringify(lap(8000)))).toEqual(lap(8000));
  expect(parse_lap(null)).toBeNull();
  expect(parse_lap("")).toBeNull();
  expect(parse_lap("{not json")).toBeNull();
  expect(parse_lap(JSON.stringify([1, 2, 3]))).toBeNull();
  expect(parse_lap(JSON.stringify(lap(-1)))).toBeNull();
});

test("a stored ghost reads only with a valid lap field", () => {
  expect(stored_lap({ key: "harepin:ghost:a", lap: lap(8000) })).toEqual(lap(8000));
  expect(stored_lap(undefined)).toBeNull();
  expect(stored_lap(null)).toBeNull();
  expect(stored_lap(lap(8000))).toBeNull();
  expect(stored_lap({ key: "harepin:ghost:a", lap: [0, Number.NaN, 0, 0, 0, 0, 0, 1] })).toBeNull();
  expect(stored_lap({ key: "harepin:ghost:a", lap: "[0]" })).toBeNull();
});

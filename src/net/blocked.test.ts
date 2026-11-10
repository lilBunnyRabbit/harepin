/// <reference types="bun" />
import { expect, test } from "bun:test";
import { BlockedWatch } from "./blocked";

test("blocked only after repeated failures over 15 s, and clears after 30 s of quiet", () => {
  const watch = new BlockedWatch();
  watch.fail(0);
  expect(watch.blocked(20_000)).toBe(false);
  watch.fail(5_000);
  expect(watch.blocked(10_000)).toBe(false);
  expect(watch.blocked(15_000)).toBe(true);
  expect(watch.blocked(34_999)).toBe(true);
  expect(watch.blocked(35_000)).toBe(false);
});

test("failures far apart never add up, and a connection clears the streak", () => {
  const watch = new BlockedWatch();
  watch.fail(0);
  watch.fail(40_000);
  expect(watch.blocked(56_000)).toBe(false);
  watch.fail(57_000);
  expect(watch.blocked(57_000)).toBe(true);
  watch.clear();
  expect(watch.blocked(57_000)).toBe(false);
});

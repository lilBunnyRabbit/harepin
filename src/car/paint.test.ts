import "../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { MAX_PAINT, REWARD_PAINTS } from "./build";
import { paint_finish, reward_paints } from "./paint";

test("every reward paint slot has its paint; only Legend's weaves", () => {
  expect(reward_paints.length).toBe(REWARD_PAINTS);
  const weaves = reward_paints.map((_, i) => paint_finish(MAX_PAINT + 1 + i)?.weave !== null);
  expect(weaves).toEqual([false, false, false, false, true]);
  expect(paint_finish(0)).toBeNull();
  expect(paint_finish(MAX_PAINT + REWARD_PAINTS + 1)).toBeNull();
});

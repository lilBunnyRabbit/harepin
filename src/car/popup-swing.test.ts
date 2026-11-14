/// <reference types="bun" />
import { expect, test } from "bun:test";
import { popup_ease, popup_step } from "./popup-swing";

test("the pop-up swing eases in and out, rising the whole way", () => {
  expect([popup_ease(0), popup_ease(0.5), popup_ease(1)]).toEqual([0, 0.5, 1]);
  expect(popup_ease(0.1)).toBeLessThan(0.1);
  expect(popup_ease(0.9)).toBeGreaterThan(0.9);
  for (let u = 0; u < 1; u += 0.05) expect(popup_ease(u + 0.05)).toBeGreaterThan(popup_ease(u));
});

test("a pop-up step moves toward open or shut and stops at either end", () => {
  expect(popup_step(0, true, 0.1)).toBeGreaterThan(0);
  expect(popup_step(1, false, 0.1)).toBeLessThan(1);
  expect([popup_step(0.9, true, 1), popup_step(0.1, false, 1), popup_step(0, false, 0.1)]).toEqual([1, 0, 0]);
  let open = 0;
  let steps = 0;
  while (open < 1) {
    open = popup_step(open, true, 1 / 60);
    steps++;
  }
  expect(steps / 60).toBeGreaterThanOrEqual(0.3);
  expect(steps / 60).toBeLessThanOrEqual(0.4);
});

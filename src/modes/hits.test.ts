/// <reference types="bun" />
import { expect, test } from "bun:test";
import { HIT_MS } from "./gymkhana";
import { HIT_GAP_MS, Hits } from "./hits";

const STEP = 16;

function counter() {
  let contacts = 0;
  const hits = new Hits(() => contacts);
  return {
    hits,
    touch: () => contacts++,
    drive: (ms: number, running = true) => {
      for (let t = 0; t < ms; t += STEP) hits.update(STEP, running);
    },
  };
}

test("each new contact costs a cone's 2 s", () => {
  const { hits, touch, drive } = counter();
  touch();
  drive(STEP);
  drive(HIT_GAP_MS);
  touch();
  drive(STEP);
  expect(hits.count).toBe(2);
  expect(hits.penalty_ms).toBe(2 * HIT_MS);
});

test("a scrape along a rail counts once, however long it lasts", () => {
  const { hits, touch } = counter();
  for (let t = 0; t < 3 * HIT_GAP_MS; t += STEP) {
    touch();
    hits.update(STEP, true);
  }
  expect(hits.count).toBe(1);
});

test("contacts before the clock runs cost nothing and are not saved for later", () => {
  const { hits, touch, drive } = counter();
  touch();
  drive(STEP, false);
  drive(HIT_GAP_MS);
  expect(hits.count).toBe(0);
});

test("contacts made before the counter exists are not counted", () => {
  let contacts = 5;
  const hits = new Hits(() => contacts);
  hits.update(STEP, true);
  expect(hits.count).toBe(0);
  contacts++;
  hits.update(STEP, true);
  expect(hits.count).toBe(1);
});

/// <reference types="bun" />
import { expect, test } from "bun:test";
import { Rewind, type RewindPart } from "./rewind";

function counter() {
  const part = { value: 0, restored: [] as number[] };
  const rewind_part: RewindPart<number> = {
    snapshot: () => part.value,
    restore: (snapshot) => part.restored.push(snapshot),
  };
  return { part, rewind_part };
}

test("step walks back newest first, keeps the oldest frame, and clear empties it", () => {
  const { part, rewind_part } = counter();
  const rewind = new Rewind([rewind_part]);
  for (let i = 1; i <= 3; i++) {
    part.value = i;
    rewind.record(i * 100);
  }
  expect([rewind.step(400), rewind.step(400), rewind.step(400)]).toEqual([true, true, true]);
  expect(part.restored).toEqual([2, 1, 1]);
  expect(rewind.can_step).toBe(false);
  rewind.clear();
  expect(rewind.step(400)).toBe(false);
});

test("frames older than the window fall off, past a buffer grow", () => {
  const { part, rewind_part } = counter();
  const rewind = new Rewind([rewind_part]);
  for (let i = 0; i < 3000; i++) {
    part.value = i;
    rewind.record(i * 5);
  }
  let steps = 0;
  for (; rewind.can_step; steps++) rewind.step(15_000);
  expect(part.restored.at(-1)).toBe(999);
  expect(steps).toBe(2000);
});

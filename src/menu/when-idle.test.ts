import { expect, test } from "bun:test";
import { when_idle } from "./when-idle";

const POLL_MS = 5;
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

test("idle: it runs at once, with no poll left behind", () => {
  let runs = 0;
  expect(when_idle(() => false, () => runs++, POLL_MS)).toBe(0);
  expect(runs).toBe(1);
});

test("in a run: the Updated card waits, then shows once when the run ends", async () => {
  let racing = true;
  let shown = 0;
  when_idle(() => racing, () => shown++, POLL_MS);
  await wait(POLL_MS * 4);
  expect(shown).toBe(0);
  racing = false;
  await wait(POLL_MS * 4);
  expect(shown).toBe(1);
  await wait(POLL_MS * 4);
  expect(shown).toBe(1);
});

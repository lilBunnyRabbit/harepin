import { afterAll, expect, test } from "bun:test";
import { ToastQueue } from "./toast-queue";

// The queue's timers are the window's; Bun has none, and its global carries the same setTimeout.
const had_window = "window" in globalThis;
if (!had_window) Object.assign(globalThis, { window: globalThis });
afterAll(() => {
  if (!had_window) Reflect.deleteProperty(globalThis, "window");
});

test("a note pushed while a menu is open waits, and shows once it closes", async () => {
  let menu_open = true;
  const shown: string[] = [];
  const queue = new ToastQueue(
    (text) => shown.push(text),
    () => menu_open,
  );
  queue.push("Goal done: First lap");
  expect(shown).toEqual([]);
  menu_open = false;
  await new Promise((done) => setTimeout(done, 400));
  expect(shown).toEqual(["Goal done: First lap"]);
  queue.stop();
});

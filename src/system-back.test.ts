import { expect, test } from "bun:test";
import { GUARD_STATE, SystemBack, type Watcher } from "./system-back";

class TestWatcher implements Watcher {
  listener: (() => void) | null = null;
  destroyed = false;
  addEventListener(_type: "close", listener: () => void) {
    this.listener = listener;
  }
  destroy() {
    this.destroyed = true;
  }
}

function with_watcher() {
  const watchers: TestWatcher[] = [];
  let backs = 0;
  const back = new SystemBack({ create_watcher: () => watchers[watchers.push(new TestWatcher()) - 1], push_guard: () => {} }, () => backs++);
  return { back, watchers, backs: () => backs };
}

function with_history() {
  let pushes = 0;
  let backs = 0;
  const back = new SystemBack({ create_watcher: null, push_guard: () => pushes++ }, () => backs++);
  return { back, pushes: () => pushes, backs: () => backs };
}

test("nothing is armed before the first gesture", () => {
  const { back, watchers } = with_watcher();
  expect(back.armed).toBe(false);
  expect(watchers.length).toBe(0);
});

test("a system back on the watcher is one game back, and the watcher re-arms", () => {
  const { back, watchers, backs } = with_watcher();
  back.gesture();
  watchers[0].listener?.();
  expect(backs()).toBe(1);
  expect(watchers.length).toBe(2);
  watchers[1].listener?.();
  expect(backs()).toBe(2);
});

test("gestures never stack watchers", () => {
  const { back, watchers } = with_watcher();
  back.gesture();
  back.gesture();
  back.gesture("a");
  expect(watchers.length).toBe(1);
});

test("Esc already handled by the game is not a second back", () => {
  const { back, watchers, backs } = with_watcher();
  back.gesture("Escape");
  watchers[0].listener?.();
  expect(backs()).toBe(0);
  expect(back.armed).toBe(true);
  back.key_up("Escape");
  watchers[1].listener?.();
  expect(backs()).toBe(1);
});

test("an Esc the game swallowed does not mute the next system back", () => {
  const { back, watchers, backs } = with_watcher();
  back.gesture("Escape");
  back.key_up("Escape");
  watchers[0].listener?.();
  expect(backs()).toBe(1);
});

test("without a watcher, one history entry stands in and is never stacked", () => {
  const { back, pushes, backs } = with_history();
  back.gesture();
  back.gesture();
  expect(pushes()).toBe(1);
  back.popped(null);
  expect(backs()).toBe(1);
  expect(back.armed).toBe(false);
  back.gesture();
  expect(pushes()).toBe(2);
});

test("popping onto the guard itself, or with no guard armed, is not a back", () => {
  const { back, backs } = with_history();
  back.popped(null);
  back.gesture();
  back.popped(GUARD_STATE);
  expect(backs()).toBe(0);
});

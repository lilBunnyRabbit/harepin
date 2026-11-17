import { expect, test } from "bun:test";
import { DEFAULT_BINDINGS, rebind_key } from "./bindings";
import { pause_keys, pause_press } from "./pause-keys";

test("free roam: each row takes its letter, Reset car the player's key, 1-4 still flip the aids", () => {
  const { acts, flips, caps } = pause_keys(DEFAULT_BINDINGS, "roam");
  expect(acts).toMatchObject({ KeyR: "reset", KeyM: "map", KeyE: "events", KeyG: "garage", KeyO: "online", KeyH: "showroom", KeyS: "settings", KeyT: "chat", KeyC: "camera" });
  expect(acts.KeyQ).toBeUndefined();
  expect(flips).toMatchObject({ Digit1: "tcs", Digit2: "abs", Digit3: "assist", Digit4: "auto", Digit5: "stability", KeyN: "lights" });
  expect(caps).toMatchObject({ reset: "R", map: "M", events: "E", garage: "G", online: "O", showroom: "H", settings: "S" });
});

test("in an event: Restart R, Leave Q, Car and parts G, Home H, Settings S, camera keeps C", () => {
  const { acts, caps } = pause_keys(DEFAULT_BINDINGS, "event");
  expect(acts).toMatchObject({ KeyR: "reset", KeyQ: "leave", KeyG: "garage", KeyH: "showroom", KeyS: "settings", KeyC: "camera" });
  expect(caps).toMatchObject({ reset: "R", leave: "Q", garage: "G", showroom: "H", settings: "S", camera: "C" });
});

test("a rebound Reset wins a clash with a row", () => {
  const { bindings } = rebind_key(DEFAULT_BINDINGS, "reset", "KeyM");
  const { acts, caps } = pause_keys(bindings, "roam");
  expect(acts.KeyM).toBe("reset");
  expect(acts.KeyR).toBeUndefined();
  expect(caps.reset).toBe("M");
  expect(caps.map).toBeUndefined();
});

function press(code: string, more: Partial<KeyboardEvent> = {}) {
  const calls: string[] = [];
  const event = { code, repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...more, preventDefault: () => calls.push("prevent"), stopPropagation: () => calls.push("stop") };
  return { event, calls };
}

test("a door key stops at the pause: E opens Events without stepping the menu on, Q leaves without shifting down", () => {
  const roam = pause_keys(DEFAULT_BINDINGS, "roam");
  const e = press("KeyE");
  expect(pause_press(roam, e.event)).toEqual({ act: "events" });
  expect(e.calls).toEqual(["prevent", "stop"]);
  const q = press("KeyQ");
  expect(pause_press(pause_keys(DEFAULT_BINDINGS, "event"), q.event)).toEqual({ act: "leave" });
  expect(q.calls).toContain("stop");
});

test("an aid key stops at the pause too; a free key and a held or chorded one pass on untouched", () => {
  const roam = pause_keys(DEFAULT_BINDINGS, "roam");
  const aid = press("Digit1");
  expect(pause_press(roam, aid.event)).toEqual({ aid: "tcs" });
  expect(aid.calls).toContain("stop");
  for (const other of [press("KeyQ"), press("KeyE", { repeat: true }), press("KeyE", { ctrlKey: true }), press("ArrowDown")]) {
    expect(pause_press(roam, other.event)).toBeNull();
    expect(other.calls).toEqual([]);
  }
});

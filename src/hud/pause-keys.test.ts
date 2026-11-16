import { expect, test } from "bun:test";
import { DEFAULT_BINDINGS, rebind_key } from "./bindings";
import { pause_keys } from "./pause-keys";

test("free roam: the doors take their letters, 1-4 still flip the aids", () => {
  const { acts, flips, caps } = pause_keys(DEFAULT_BINDINGS, "roam");
  expect(acts).toMatchObject({ KeyR: "reset", KeyM: "map", KeyE: "events", KeyG: "garage", KeyO: "online", KeyQ: "leave", KeyT: "chat", KeyC: "camera" });
  expect(flips).toMatchObject({ Digit1: "tcs", Digit2: "abs", Digit3: "assist", Digit4: "auto", Digit5: "stability", KeyN: "lights" });
  expect(caps).toMatchObject({ reset: "R", map: "M", events: "E", garage: "G", online: "O", leave: "Q" });
  expect(caps.settings).toBeUndefined();
});

test("in an event: Car and parts C, Showroom H, Settings S, Leave Q", () => {
  const { acts, caps } = pause_keys(DEFAULT_BINDINGS, "event");
  expect(acts).toMatchObject({ KeyR: "reset", KeyC: "garage", KeyH: "showroom", KeyS: "settings", KeyO: "settings", KeyQ: "leave" });
  expect(caps).toMatchObject({ garage: "C", showroom: "H", settings: "S", leave: "Q" });
  expect(caps.camera).toBeUndefined();
});

test("a rebound Reset wins a clash with a door", () => {
  const { bindings } = rebind_key(DEFAULT_BINDINGS, "reset", "KeyM");
  const { acts, caps } = pause_keys(bindings, "roam");
  expect(acts.KeyM).toBe("reset");
  expect(acts.KeyR).toBeUndefined();
  expect(caps.map).toBeUndefined();
});

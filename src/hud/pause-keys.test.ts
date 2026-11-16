import { expect, test } from "bun:test";
import { DEFAULT_BINDINGS, rebind_key } from "./bindings";
import { pause_keys } from "./pause-keys";

test("free roam: each row takes its letter, Reset car the player's key, 1-4 still flip the aids", () => {
  const { acts, flips, caps } = pause_keys(DEFAULT_BINDINGS, "roam");
  expect(acts).toMatchObject({ KeyR: "reset", KeyM: "map", KeyE: "events", KeyG: "garage", KeyO: "online", KeyH: "showroom", KeyS: "settings", KeyT: "chat", KeyC: "camera" });
  expect(acts.KeyQ).toBeUndefined();
  expect(flips).toMatchObject({ Digit1: "tcs", Digit2: "abs", Digit3: "assist", Digit4: "auto", Digit5: "stability", KeyN: "lights" });
  expect(caps).toMatchObject({ reset: "R", map: "M", events: "E", garage: "G", online: "O", showroom: "H", settings: "S" });
});

test("in an event: Restart R, Leave Q, Car and parts G, Showroom H, Settings S, camera keeps C", () => {
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

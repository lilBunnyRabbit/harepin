import { expect, test } from "bun:test";
import { DEFAULT_BINDINGS, rebind_key } from "./bindings";
import { pause_keys } from "./pause-keys";

test("free roam: the doors take 1-4 in tile order, reset the player's key", () => {
  const { acts, caps } = pause_keys(DEFAULT_BINDINGS, "roam");
  expect(acts).toMatchObject({ KeyR: "reset", Digit1: "map", Digit2: "events", Digit3: "garage", Digit4: "online", KeyQ: "leave", KeyT: "chat", KeyO: "settings", KeyC: "camera" });
  expect(caps).toMatchObject({ reset: "R", map: "1", events: "2", garage: "3", online: "4" });
});

test("in an event: the rows after Restart take the digits, Leave takes Q", () => {
  const { acts, caps } = pause_keys(DEFAULT_BINDINGS, "event");
  expect(acts).toMatchObject({ KeyR: "reset", Digit1: "garage", Digit2: "showroom", Digit3: "settings", KeyQ: "leave" });
  expect(acts.Digit4).toBeUndefined();
  expect(caps).toMatchObject({ garage: "1", showroom: "2", settings: "3", leave: "Q" });
});

test("a rebound Reset moves with the player and wins a clash", () => {
  const { bindings } = rebind_key(DEFAULT_BINDINGS, "reset", "KeyQ");
  const { acts, caps } = pause_keys(bindings, "event");
  expect(acts.KeyQ).toBe("reset");
  expect(acts.KeyR).toBeUndefined();
  expect(caps.reset).toBe("Q");
  expect(caps.leave).toBeUndefined();
});

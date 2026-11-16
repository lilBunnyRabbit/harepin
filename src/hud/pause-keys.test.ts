import { expect, test } from "bun:test";
import { DEFAULT_BINDINGS, rebind_key } from "./bindings";
import { pause_keys } from "./pause-keys";

test("reset, garage and camera answer to the player's keys", () => {
  const { acts, caps } = pause_keys(DEFAULT_BINDINGS);
  expect(acts).toMatchObject({ KeyR: "reset", KeyV: "garage", KeyC: "camera", KeyM: "showroom", KeyO: "settings", KeyT: "chat", KeyL: "leave" });
  expect(acts.KeyG).toBeUndefined();
  expect(caps).toEqual({ reset: "R", garage: "V", camera: "C", showroom: "M", settings: "O", chat: "T", leave: "L" });
});

test("a rebound key moves with its action, and a player key beats a fixed one", () => {
  const { bindings } = rebind_key(DEFAULT_BINDINGS, "garage", "KeyO");
  const { acts, caps } = pause_keys(bindings);
  expect(acts.KeyO).toBe("garage");
  expect(acts.KeyV).toBeUndefined();
  expect(caps.garage).toBe("O");
  expect(caps.settings).toBeUndefined();
});

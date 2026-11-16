import { expect, test } from "bun:test";
import { DEFAULT_BINDINGS, rebind_key } from "./bindings";
import { pause_keys } from "./pause-keys";

test("reset, restart, garage, camera and map answer to the player's keys", () => {
  const { acts, caps } = pause_keys(DEFAULT_BINDINGS);
  expect(acts).toMatchObject({ KeyR: "reset", KeyL: "reset", KeyV: "garage", KeyC: "camera", KeyM: "map", Home: "showroom", KeyO: "settings", KeyT: "chat", End: "leave" });
  expect(acts.KeyG).toBeUndefined();
  expect(caps).toEqual({ reset: "R", garage: "V", camera: "C", map: "M", showroom: "Home", settings: "O", chat: "T", leave: "End" });
});

test("no fixed pause key is a default driving key, so a habit press never leaves the run", () => {
  const driving = new Set(Object.values(DEFAULT_BINDINGS).flatMap((binding) => binding.keys));
  const { acts } = pause_keys(DEFAULT_BINDINGS);
  for (const [code, act] of Object.entries(acts)) if (driving.has(code)) expect(["reset", "garage", "camera", "map"]).toContain(act);
});

test("a rebound key moves with its action, and a player key beats a fixed one", () => {
  const { bindings } = rebind_key(DEFAULT_BINDINGS, "garage", "KeyO");
  const { acts, caps } = pause_keys(bindings);
  expect(acts.KeyO).toBe("garage");
  expect(acts.KeyV).toBeUndefined();
  expect(caps.garage).toBe("O");
  expect(caps.settings).toBeUndefined();
});

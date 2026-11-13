import { describe, expect, test } from "bun:test";
import { DEFAULT_BINDINGS } from "../../hud/bindings";
import { Device } from "../device";
import { keymap, pro_text } from "./guide-text";

describe("keymap", () => {
  test("the keyboard leads with the four drive keys", () => {
    const [drive] = keymap(DEFAULT_BINDINGS, Device.KEYBOARD);
    expect(drive.what).toBe("Drive");
    expect(drive.keys).toHaveLength(4);
  });

  test("every device ends on how to open the menu", () => {
    for (const device of Object.values(Device)) expect(keymap(DEFAULT_BINDINGS, device).at(-1)?.what).toBe("Menu");
  });
});

test("Pro keeps the automatic gearbox on touch", () => {
  expect(pro_text(DEFAULT_BINDINGS, Device.TOUCH)).toContain("automatic");
  expect(pro_text(DEFAULT_BINDINGS, Device.KEYBOARD)).toStartWith("Nothing helps.");
});

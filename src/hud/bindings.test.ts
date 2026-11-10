import { describe, expect, test } from "bun:test";
import { BINDABLE, DEFAULT_BINDINGS, key_label, pad_text, parse_bindings, rebind_key, rebind_pad, type Bindings } from "./bindings";

const owners = (bindings: Bindings, code: string) => BINDABLE.filter((action) => bindings[action].keys.includes(code));

describe("default table", () => {
  test("every key and button answers to one action", () => {
    expect(parse_bindings(DEFAULT_BINDINGS)).toEqual(DEFAULT_BINDINGS);
  });

  test("keeps the keys the game always had", () => {
    expect(DEFAULT_BINDINGS.throttle.keys).toEqual(["KeyW", "ArrowUp"]);
    expect(DEFAULT_BINDINGS.precision.keys).toEqual(["KeyX"]);
    expect(DEFAULT_BINDINGS.handbrake.pad).toBe(0);
  });
});

describe("rebind_key", () => {
  test("a free key replaces the action's keys", () => {
    const { bindings, swapped } = rebind_key(DEFAULT_BINDINGS, "reset", "KeyK");
    expect(bindings.reset.keys).toEqual(["KeyK"]);
    expect(swapped).toBeNull();
    expect(owners(bindings, "KeyR")).toEqual([]);
  });

  test("a taken key swaps: the other action gets the old keys in its place", () => {
    const { bindings, swapped } = rebind_key(DEFAULT_BINDINGS, "reset", "KeyC");
    expect(swapped).toBe("camera");
    expect(bindings.reset.keys).toEqual(["KeyC"]);
    expect(bindings.camera.keys).toEqual(["KeyR"]);
  });

  test("a swap out of a key list keeps the other keys and their order", () => {
    const { bindings } = rebind_key(DEFAULT_BINDINGS, "handbrake", "ArrowUp");
    expect(bindings.throttle.keys).toEqual(["KeyW", "Space"]);
    expect(owners(bindings, "ArrowUp")).toEqual(["handbrake"]);
  });

  test("rebinding the key an action already has changes nothing else", () => {
    const { bindings, swapped } = rebind_key(DEFAULT_BINDINGS, "throttle", "KeyW");
    expect(swapped).toBeNull();
    expect(bindings.throttle.keys).toEqual(["KeyW"]);
  });

  test("never mutates the table it was given", () => {
    const before = structuredClone(DEFAULT_BINDINGS);
    rebind_key(DEFAULT_BINDINGS, "reset", "KeyC");
    rebind_pad(DEFAULT_BINDINGS, "reset", 0);
    expect(DEFAULT_BINDINGS).toEqual(before);
  });
});

describe("rebind_pad", () => {
  test("a taken button swaps, including into an empty slot", () => {
    const { bindings, swapped } = rebind_pad(DEFAULT_BINDINGS, "ghost", 0);
    expect(swapped).toBe("handbrake");
    expect(bindings.ghost.pad).toBe(0);
    expect(bindings.handbrake.pad).toBeNull();
  });

  test("two bound buttons trade places", () => {
    const { bindings } = rebind_pad(DEFAULT_BINDINGS, "reset", 1);
    expect(bindings.reset.pad).toBe(1);
    expect(bindings.nitro.pad).toBe(3);
  });
});

describe("parse_bindings", () => {
  test("garbage gives the defaults", () => {
    for (const raw of [null, undefined, 3, "keys", []]) expect(parse_bindings(raw)).toEqual(DEFAULT_BINDINGS);
  });

  test("a valid remap survives", () => {
    const { bindings } = rebind_pad(rebind_key(DEFAULT_BINDINGS, "reset", "KeyC").bindings, "reset", 1);
    expect(parse_bindings(JSON.parse(JSON.stringify(bindings)))).toEqual(bindings);
  });

  test("unknown actions are dropped, bad entries take their default", () => {
    const parsed = parse_bindings({ fly: { keys: ["KeyZ"], pad: 2 }, reset: { keys: "KeyR" }, camera: { keys: ["KeyK"], pad: 99 }, ghost: { keys: [7], pad: null } });
    expect(parsed).not.toHaveProperty("fly");
    expect(parsed.reset).toEqual(DEFAULT_BINDINGS.reset);
    expect(parsed.camera).toEqual({ keys: ["KeyK"], pad: DEFAULT_BINDINGS.camera.pad });
    expect(parsed.ghost).toEqual(DEFAULT_BINDINGS.ghost);
  });

  test("menu-reserved keys and buttons never load", () => {
    expect(parse_bindings({ reset: { keys: ["Escape"], pad: 9 } }).reset).toEqual(DEFAULT_BINDINGS.reset);
    expect(parse_bindings({ reset: { keys: ["KeyK"], pad: 7 } }).reset.pad).toBe(DEFAULT_BINDINGS.reset.pad);
  });

  test("stick and trigger actions take no pad button", () => {
    expect(parse_bindings({ throttle: { keys: ["KeyW"], pad: 3 } }).throttle.pad).toBeNull();
  });

  test("a table where two actions share a key or button falls back whole", () => {
    expect(parse_bindings({ reset: { keys: ["KeyC"], pad: 3 } })).toEqual(DEFAULT_BINDINGS);
    expect(parse_bindings({ ghost: { keys: ["KeyG"], pad: 0 } })).toEqual(DEFAULT_BINDINGS);
  });

  test("duplicate keys within one action collapse", () => {
    expect(parse_bindings({ reset: { keys: ["KeyK", "KeyK"], pad: 3 } }).reset.keys).toEqual(["KeyK"]);
  });
});

describe("labels", () => {
  test("codes read as the key cap", () => {
    expect(["KeyW", "Digit1", "ArrowLeft", "ShiftRight", "Numpad4", "Space", "Semicolon"].map(key_label)).toEqual(["W", "1", "←", "R Shift", "Num 4", "Space", "Semicolon"]);
  });

  test("the pad column shows the fixed stick or trigger", () => {
    expect(pad_text(DEFAULT_BINDINGS, "throttle")).toBe("RT");
    expect(pad_text(DEFAULT_BINDINGS, "camera")).toBe("View");
    expect(pad_text(DEFAULT_BINDINGS, "ghost")).toBe("");
  });
});

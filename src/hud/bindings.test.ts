import { describe, expect, test } from "bun:test";
import { BINDABLE, DEFAULT_BINDINGS, key_label, pad_text, parse_bindings, rebind_key, rebind_pad, type Bindings } from "./bindings";

const owners = (bindings: Bindings, code: string) => BINDABLE.filter((action) => bindings[action].keys.includes(code));

const unique = (bindings: Bindings) => {
  const keys = BINDABLE.flatMap((action) => bindings[action].keys);
  const pads = BINDABLE.flatMap((action) => bindings[action].pad ?? []);
  return new Set(keys).size === keys.length && new Set(pads).size === pads.length;
};

describe("default table", () => {
  test("every key and button answers to one action", () => {
    expect(parse_bindings(DEFAULT_BINDINGS)).toEqual(DEFAULT_BINDINGS);
  });

  test("keeps the keys the game always had", () => {
    expect(DEFAULT_BINDINGS.throttle.keys).toEqual(["KeyW", "ArrowUp"]);
    expect(DEFAULT_BINDINGS.precision.keys).toEqual(["KeyX"]);
    expect(DEFAULT_BINDINGS.handbrake.pad).toBe(0);
  });

  test("no two actions share a default key or pad button", () => {
    expect(unique(DEFAULT_BINDINGS)).toBe(true);
  });

  test("pad buttons match the pre-remap game: X rewinds, precision steer is keyboard only", () => {
    expect(DEFAULT_BINDINGS.rewind.pad).toBe(2);
    expect(DEFAULT_BINDINGS.nitro.pad).toBe(1);
    expect(DEFAULT_BINDINGS.precision.pad).toBeNull();
    expect(pad_text(DEFAULT_BINDINGS, "precision")).toBe("");
  });
});

describe("rebind_key", () => {
  test("a free key replaces the action's keys", () => {
    const { bindings, from, swapped } = rebind_key(DEFAULT_BINDINGS, "reset", "KeyK");
    expect(bindings.reset.keys).toEqual(["KeyK"]);
    expect(from).toBeNull();
    expect(swapped).toBe(false);
    expect(owners(bindings, "KeyR")).toEqual([]);
  });

  test("a taken key is stolen; the owner keeps its other keys", () => {
    const { bindings, from, swapped } = rebind_key(DEFAULT_BINDINGS, "throttle", "KeyS");
    expect(from).toBe("brake");
    expect(swapped).toBe(false);
    expect(bindings.throttle.keys).toEqual(["KeyS"]);
    expect(bindings.brake.keys).toEqual(["ArrowDown"]);
  });

  test("an owner left with no key takes the old keys: a true swap", () => {
    const { bindings, from, swapped } = rebind_key(DEFAULT_BINDINGS, "reset", "KeyC");
    expect(from).toBe("camera");
    expect(swapped).toBe(true);
    expect(bindings.reset.keys).toEqual(["KeyC"]);
    expect(bindings.camera.keys).toEqual(["KeyR"]);
  });

  test("an action with no key to give leaves the owner with none, not a swap", () => {
    const keyless = parse_bindings({ reset: { keys: ["KeyC"], pad: 3 } });
    expect(keyless.camera.keys).toEqual([]);
    const { bindings, from, swapped } = rebind_key(keyless, "camera", "KeyC");
    expect(from).toBe("reset");
    expect(swapped).toBe(false);
    expect(bindings.camera.keys).toEqual(["KeyC"]);
    expect(bindings.reset.keys).toEqual([]);
  });

  test("rebinding the key an action already has changes nothing else", () => {
    const { bindings, from } = rebind_key(DEFAULT_BINDINGS, "throttle", "KeyW");
    expect(from).toBeNull();
    expect(bindings.throttle.keys).toEqual(["KeyW"]);
  });

  test("never mutates the table it was given", () => {
    const before = structuredClone(DEFAULT_BINDINGS);
    rebind_key(DEFAULT_BINDINGS, "reset", "KeyC");
    rebind_pad(DEFAULT_BINDINGS, "reset", 0);
    expect(DEFAULT_BINDINGS).toEqual(before);
  });

  test("a chain of steals stays unique, within the key limit, and survives a reload", () => {
    let bindings = DEFAULT_BINDINGS;
    for (const [action, code] of [
      ["throttle", "KeyS"],
      ["steer_left", "ArrowDown"],
      ["steer_right", "KeyW"],
    ] as const)
      bindings = rebind_key(bindings, action, code).bindings;
    expect(bindings.throttle.keys).toEqual(["KeyS"]);
    expect(bindings.brake.keys).toEqual(["KeyA", "ArrowLeft"]);
    expect(bindings.steer_left.keys).toEqual(["ArrowDown"]);
    expect(bindings.steer_right.keys).toEqual(["KeyW"]);
    expect(unique(bindings)).toBe(true);
    expect(BINDABLE.every((action) => bindings[action].keys.length <= 4)).toBe(true);
    expect(parse_bindings(JSON.parse(JSON.stringify(bindings)))).toEqual(bindings);
  });
});

describe("rebind_pad", () => {
  test("a button taken by an action with nothing to give leaves the owner with none", () => {
    const { bindings, from, swapped } = rebind_pad(DEFAULT_BINDINGS, "restart", 3);
    expect(from).toBe("reset");
    expect(swapped).toBe(false);
    expect(bindings.restart.pad).toBe(3);
    expect(bindings.reset.pad).toBeNull();
  });

  test("two bound buttons trade places", () => {
    const { bindings, swapped } = rebind_pad(DEFAULT_BINDINGS, "reset", 1);
    expect(swapped).toBe(true);
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

  test("empty key lists and empty codes are bad entries", () => {
    expect(parse_bindings({ reset: { keys: [], pad: 3 } }).reset.keys).toEqual(["KeyR"]);
    expect(parse_bindings({ reset: { keys: [""], pad: 3 } }).reset.keys).toEqual(["KeyR"]);
  });

  test("Ctrl and Meta never load: held, they make any key a browser shortcut", () => {
    for (const code of ["ControlLeft", "ControlRight", "MetaLeft", "MetaRight"]) expect(parse_bindings({ nitro: { keys: [code], pad: 1 } }).nitro).toEqual(DEFAULT_BINDINGS.nitro);
  });

  test("menu-reserved keys and buttons never load", () => {
    expect(parse_bindings({ reset: { keys: ["Escape"], pad: 9 } }).reset).toEqual(DEFAULT_BINDINGS.reset);
    expect(parse_bindings({ reset: { keys: ["KeyK"], pad: 7 } }).reset.pad).toBe(DEFAULT_BINDINGS.reset.pad);
  });

  test("stick and trigger actions take no pad button", () => {
    expect(parse_bindings({ throttle: { keys: ["KeyW"], pad: 3 } }).throttle.pad).toBeNull();
  });

  test("a stored remap beats the default it collides with; the default gives up only that key", () => {
    const parsed = parse_bindings({ reset: { keys: ["KeyC"], pad: 1 } });
    expect(parsed.reset).toEqual({ keys: ["KeyC"], pad: 1 });
    expect(parsed.camera.keys).toEqual([]);
    expect(parsed.nitro.pad).toBeNull();
    expect(parsed.brake).toEqual(DEFAULT_BINDINGS.brake);
    expect(unique(parsed)).toBe(true);
  });

  test("two stored entries sharing a key: the first in table order keeps it, nothing else resets", () => {
    const parsed = parse_bindings({ reset: { keys: ["KeyK", "KeyJ"], pad: 3 }, ghost: { keys: ["KeyK"], pad: null }, throttle: { keys: ["KeyI"], pad: null } });
    expect(parsed.reset.keys).toEqual(["KeyK", "KeyJ"]);
    expect(parsed.ghost.keys).toEqual([]);
    expect(parsed.throttle.keys).toEqual(["KeyI"]);
    expect(unique(parsed)).toBe(true);
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

describe("M moves from the gearbox to the map", () => {
  const before_map = () => {
    const { map: _, ...rest } = structuredClone(DEFAULT_BINDINGS);
    return { ...rest, auto: { keys: ["KeyM"], pad: 3 }, reset: { keys: ["KeyR"], pad: null } };
  };

  test("a table saved with auto on M gets auto on 4 and the map on M, auto keeps its pad button", () => {
    const parsed = parse_bindings(JSON.parse(JSON.stringify(before_map())));
    expect(parsed.auto).toEqual({ keys: ["Digit4"], pad: 3 });
    expect(parsed.map.keys).toEqual(["KeyM"]);
    expect(unique(parsed)).toBe(true);
  });

  test("a player who put M on something else keeps it and the map gets no key", () => {
    const parsed = parse_bindings({ ...before_map(), auto: { keys: ["KeyK"], pad: null }, ghost: { keys: ["KeyM"], pad: null } });
    expect(parsed.ghost.keys).toEqual(["KeyM"]);
    expect(parsed.auto.keys).toEqual(["KeyK"]);
    expect(parsed.map.keys).toEqual([]);
  });

  test("a 4 already taken stays with its owner; auto is left without a key", () => {
    const parsed = parse_bindings({ ...before_map(), ghost: { keys: ["Digit4"], pad: null } });
    expect(parsed.ghost.keys).toEqual(["Digit4"]);
    expect(parsed.auto.keys).toEqual([]);
    expect(parsed.map.keys).toEqual(["KeyM"]);
  });

  test("a table that already has the map is left alone", () => {
    const parsed = parse_bindings({ ...before_map(), map: { keys: ["KeyJ"], pad: null } });
    expect(parsed.auto.keys).toEqual(["KeyM"]);
    expect(parsed.map.keys).toEqual(["KeyJ"]);
  });
});

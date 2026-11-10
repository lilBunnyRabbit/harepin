import { describe, expect, test } from "bun:test";
import { AidPreset, guide_seen_on_load, preset_aids, preset_of, random_name, rolled_name } from "./guide-rules";

describe("guide_seen_on_load", () => {
  test("a fresh install has not seen it", () => {
    expect(guide_seen_on_load(null, false)).toBe(false);
  });

  test("a stored theme or build counts as seen", () => {
    expect(guide_seen_on_load(null, true)).toBe(true);
  });

  test("settings saved before the flag count as seen", () => {
    expect(guide_seen_on_load({ name: "Old Timer" }, false)).toBe(true);
    expect(guide_seen_on_load({}, false)).toBe(true);
  });

  test("an explicit flag wins", () => {
    expect(guide_seen_on_load({ guide_seen: false, name: "New" }, true)).toBe(false);
    expect(guide_seen_on_load({ guide_seen: true }, false)).toBe(true);
  });

  test("a broken flag falls back to seen", () => {
    expect(guide_seen_on_load({ guide_seen: "no" }, false)).toBe(true);
    expect(guide_seen_on_load("garbage", false)).toBe(false);
  });
});

describe("presets", () => {
  test("Pro keeps the automatic gearbox on touch only", () => {
    expect(preset_aids(AidPreset.PRO, false).auto).toBe(false);
    expect(preset_aids(AidPreset.PRO, true).auto).toBe(true);
  });

  test("today's defaults read as Easy, a mix as none", () => {
    expect(preset_of({ tcs: true, abs: true, assist: true, auto: true }, false)).toBe(AidPreset.EASY);
    expect(preset_of({ tcs: true, abs: true, assist: false, auto: true }, false)).toBe(AidPreset.BALANCED);
    expect(preset_of({ tcs: false, abs: true, assist: false, auto: true }, false)).toBe(null);
  });
});

test("rolled_name takes the first free number", () => {
  expect(rolled_name([])).toBe("Rolled 1");
  expect(rolled_name(["Rolled 1", "Mine", "Rolled 3"])).toBe("Rolled 2");
});

describe("random_name", () => {
  test("never repeats the current name", () => {
    for (let at = 0; at < 8; at++) expect(random_name("Swift Bunny", () => at / 8)).not.toBe("Swift Bunny");
  });

  test("always gives a bunny", () => {
    expect(random_name("", () => 0.999)).toMatch(/ Bunny$/);
  });
});

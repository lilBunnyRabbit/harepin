/// <reference types="bun" />
import { expect, test } from "bun:test";
import { DEFAULT_BUILD, build_code, parse_build } from "./build";
import { BUILD_NAME_LENGTH } from "./builds";
import { PRESETS } from "./presets";

test("every preset is a build code that reads back as itself", () => {
  for (const preset of PRESETS) {
    const build = parse_build(preset.code);
    expect(build).not.toBeNull();
    expect(build && build_code(build)).toBe(preset.code);
  }
});

test("the first preset is the car a new player starts in", () => {
  expect(PRESETS[0].code).toBe(build_code(DEFAULT_BUILD));
});

test("preset names are short and distinct", () => {
  for (const preset of PRESETS) expect(preset.name.length).toBeLessThanOrEqual(BUILD_NAME_LENGTH);
  expect(new Set(PRESETS.map((p) => p.name.toLowerCase())).size).toBe(PRESETS.length);
  expect(new Set(PRESETS.map((p) => p.code)).size).toBe(PRESETS.length);
});

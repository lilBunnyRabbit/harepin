/// <reference types="bun" />
import { expect, test } from "bun:test";
import { parse_build } from "../car/build";
import { DEFAULT_SETTINGS } from "../menu/prefs";
import { FEEL_TESTS, feel_car } from "./feel-tests";

test("every feel test loads a real car and only real settings", () => {
  for (const feel of FEEL_TESTS) {
    expect(parse_build(feel_car(feel.car))).not.toBeNull();
    for (const key of Object.keys(feel.settings)) expect(Object.keys(DEFAULT_SETTINGS)).toContain(key);
  }
});

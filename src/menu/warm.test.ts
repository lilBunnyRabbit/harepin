/// <reference types="bun" />
import { expect, test } from "bun:test";
import { PAGE_BUILD_MS, SETTINGS_BUILD_MS, warm_pick } from "./warm";

const IDS = ["play", "settings", "world"];

test("warm builds one page per slot, the heavy page last", () => {
  expect(warm_pick(IDS, new Set(), "settings", 50)).toBe("play");
  expect(warm_pick(IDS, new Set(["play"]), "settings", 50)).toBe("world");
  expect(warm_pick(IDS, new Set(["play", "world"]), "settings", 50)).toBe("settings");
  expect(warm_pick(IDS, new Set(IDS), "settings", 50)).toBe("done");
});

test("warm waits when the idle slot is shorter than the page's build", () => {
  expect(warm_pick(IDS, new Set(), "settings", PAGE_BUILD_MS)).toBe("wait");
  expect(warm_pick(IDS, new Set(["play", "world"]), "settings", SETTINGS_BUILD_MS - 1)).toBe("wait");
});

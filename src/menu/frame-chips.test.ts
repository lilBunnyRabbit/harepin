import { expect, test } from "bun:test";
import { render } from "svelte/server";
import { UpdateState } from "../version";
import FrameChips from "./FrameChips.svelte";
import type { Menu } from "./page";
import { DEFAULT_SETTINGS } from "./prefs";

const chips = (state: UpdateState, update = true) => {
  const host = { runs: { stars: 3 }, career: { stars: {} }, car_code: () => "", online_count: () => 1, update_state: () => state, show_updates: () => undefined };
  const menu = { host, state: () => DEFAULT_SETTINGS, sync: () => undefined } as unknown as Menu;
  return render(FrameChips, { props: { menu, update } }).body;
};

test("the menu frame says an update is downloading, and offers it once it waits", () => {
  expect(chips(UpdateState.NONE)).not.toContain("pdate");
  const coming = chips(UpdateState.COMING);
  expect(coming).toContain("Downloading update");
  expect(coming).not.toContain("<button");
  expect(chips(UpdateState.READY)).toMatch(/<button[^>]*class="ui-chip[^>]*>.*Update ready/s);
  expect(chips(UpdateState.READY, false)).not.toContain("pdate");
});

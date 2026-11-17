import "../../../scripts/fake-dom";
import { expect, test } from "bun:test";
import { render } from "svelte/server";
import type { Menu } from "../page";
import { DEFAULT_SETTINGS } from "../prefs";
import type { MenuState } from "../ui/menu-state.svelte";
import DailyBoard from "./DailyBoard.svelte";
import { daily_text } from "./run-text";

function setup(host: object) {
  const menu = { host, state: () => DEFAULT_SETTINGS } as unknown as Menu;
  const live = { prefs: DEFAULT_SETTINGS, live: <T>(read: () => T) => read(), set: () => {} } as unknown as MenuState;
  return { menu, live };
}

test("the daily board shows today's top three and your own time past them", () => {
  const runs = { today: "2026-11-13" };
  const rows = [
    { name: "Ana", ms: 59_000, you: false, here: true },
    { name: "Bo", ms: 60_000, you: false, here: true },
    { name: "Cy", ms: 61_000, you: false, here: false },
    { name: "Di", ms: 62_000, you: false, here: false },
    { name: "Me", ms: 70_000, you: true, here: true },
  ];
  const html = render(DailyBoard, { props: setup({ runs, daily_board: () => ({ rows, hidden: 2 }) }) }).body;
  for (const text of ["Ana", "0:59.000", "Cy", "Me · you", "1:10.000", "2 from other versions hidden"]) expect(html).toContain(text);
  expect(html).not.toContain("Di");
  const empty = render(DailyBoard, { props: setup({ runs, daily_board: () => ({ rows: [], hidden: 0 }) }) }).body;
  expect(empty).toContain("No times yet today.");
  expect(empty).not.toContain("other versions");
});

test("a scored daily shows in its mode's unit; a timed one as a time", () => {
  expect(daily_text("race", { ms: 61_000 })).toBe("1:01.000");
  expect(daily_text("race", { ms: 61_000, score: 212.4 })).toBe("212 km/h");
  expect(daily_text("drift", { ms: 61_000, score: 1840 })).toBe("1,840 pts");
  expect(daily_text("jump", { ms: 61_000, score: 42.5 })).toContain("m");
});

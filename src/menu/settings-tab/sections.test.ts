import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, MapView, SpeedoStyle } from "../prefs";
import { SettingsNav } from "./nav.svelte";
import { CHANGES, LIST, SECTIONS, chips, summary, wire_boxes, type SummaryLive } from "./sections";

const LIVE: SummaryLive = { tier: "high", theme: "Brand Dark", name: "Hare" };

describe("settings tab", () => {
  test("the HUD wire draws the picked map and speedometer, and Off drops the map", () => {
    const boxes = wire_boxes(MapView.LINE, SpeedoStyle.DIAL);
    expect(boxes.find((box) => box.part === "map")?.look).toBe("line");
    expect(boxes.find((box) => box.part === "speed")?.look).toBe("dial");
    expect(wire_boxes(MapView.OFF, SpeedoStyle.BAR).some((box) => box.part === "map")).toBe(false);
  });

  test("the Display card names the theme, the map and the speedometer", () => {
    expect(summary("display", { ...DEFAULT_SETTINGS, map: "close", speedo: "dial" }, LIVE)).toEqual(["Brand Dark", "Close-up map", "Dial speedometer"]);
  });

  test("every section card has live values", () => {
    for (const section of SECTIONS) expect(summary(section.id, DEFAULT_SETTINGS, LIVE).length).toBeGreaterThan(0);
  });

  test("key list cells split into chips and separators", () => {
    expect(chips("LT / RT, Y")).toEqual([
      { chip: true, text: "LT" },
      { chip: false, text: " / " },
      { chip: true, text: "RT" },
      { chip: false, text: ", " },
      { chip: true, text: "Y" },
    ]);
    expect(chips("")).toEqual([]);
  });

  test("summaries read the state", () => {
    expect(summary("audio", { ...DEFAULT_SETTINGS, muted: true }, LIVE)).toEqual(["Muted"]);
    expect(summary("graphics", { ...DEFAULT_SETTINGS, quality: "auto" }, { ...LIVE, tier: "medium" })).toEqual(["Auto, running Medium"]);
    expect(summary("driving", { ...DEFAULT_SETTINGS, tcs: true, abs: true, assist: false, stability: false, auto: false, ai_difficulty: "hard" }, LIVE)).toEqual(["2 of 4 aids", "Manual gears", "AI hard"]);
    expect(summary("net", { ...DEFAULT_SETTINGS, show_country: false }, LIVE)).toEqual(["Hare", "Country hidden"]);
  });

  test("Settings opens on the list, a section steps to the next one, a deep page steps from its section", () => {
    let state = { ...DEFAULT_SETTINGS };
    const nav = new SettingsNav(
      (key, value) => (state = { ...state, [key]: value }),
      () => state,
    );
    expect(nav.sub).toBe(LIST);
    nav.step(1);
    expect(nav.sub).toBe(LIST);
    nav.show("graphics");
    nav.step(-1);
    expect(nav.sub).toBe("net");
    nav.show("keys");
    expect(nav.parent()).toBe("controls");
    nav.step(1);
    expect(nav.sub).toBe("audio");
    nav.close();
    expect(nav.sub).toBe(LIST);
    expect(nav.keys()).toEqual([]);
    expect(nav.has(CHANGES)).toBe(false);
  });

  test("reset puts back only the open section's settings", () => {
    let state = { ...DEFAULT_SETTINGS, muted: !DEFAULT_SETTINGS.muted, tcs: !DEFAULT_SETTINGS.tcs };
    const nav = new SettingsNav(
      (key, value) => (state = { ...state, [key]: value }),
      () => state,
    );
    nav.show("audio");
    nav.reset();
    expect(state.muted).toBe(DEFAULT_SETTINGS.muted);
    expect(state.tcs).toBe(!DEFAULT_SETTINGS.tcs);
  });
});

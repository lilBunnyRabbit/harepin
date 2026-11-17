import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, MapView, SpeedoStyle } from "../prefs";
import { SettingsNav } from "./nav.svelte";
import { CHANGES, chips, summary, wire_boxes } from "./sections";

describe("settings tab", () => {
  test("the HUD wire draws the picked map and speedometer, and Off drops the map", () => {
    const boxes = wire_boxes(MapView.LINE, SpeedoStyle.DIAL);
    expect(boxes.find((box) => box.part === "map")?.look).toBe("line");
    expect(boxes.find((box) => box.part === "speed")?.look).toBe("dial");
    expect(wire_boxes(MapView.OFF, SpeedoStyle.BAR).some((box) => box.part === "map")).toBe(false);
  });

  test("the Display card names the map and the speedometer", () => {
    expect(summary("display", { ...DEFAULT_SETTINGS, map: "close", speedo: "dial" }, "high", "Brand Dark")).toBe("Close-up map · Dial speedometer · Brand Dark");
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
    expect(summary("audio", { ...DEFAULT_SETTINGS, muted: true }, "high", "Brand Dark")).toBe("Muted");
    expect(summary("graphics", { ...DEFAULT_SETTINGS, quality: "auto" }, "medium", "Brand Dark")).toBe("Auto, running Medium");
  });

  test("sections step round the tabs, deep pages and What's new step from their tab", () => {
    let state = { ...DEFAULT_SETTINGS };
    const nav = new SettingsNav(
      (key, value) => (state = { ...state, [key]: value }),
      () => state,
    );
    nav.show("graphics");
    nav.step(-1);
    expect(nav.sub).toBe("net");
    nav.show("keys");
    expect(nav.parent()).toBe("controls");
    nav.step(1);
    expect(nav.sub).toBe("audio");
    nav.show(CHANGES);
    expect(nav.keys()).toEqual([]);
    nav.step(1);
    expect(nav.sub).toBe("graphics");
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

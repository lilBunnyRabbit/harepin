import { describe, expect, test } from "bun:test";
import { SteerMode } from "../car/car";
import { DEFAULT_BINDINGS, rebind_key } from "../hud/bindings";
import { DEFAULT_SETTINGS, parse_settings, type SettingsState } from "./prefs";

describe("parse_settings", () => {
  test("nothing stored gives the defaults, with the guide seen only by a returning player", () => {
    expect(parse_settings(null)).toEqual({ ...DEFAULT_SETTINGS, guide_seen: false });
    expect(parse_settings(null, true)).toEqual({ ...DEFAULT_SETTINGS, guide_seen: true });
    expect(parse_settings("garbage", true)).toEqual({ ...DEFAULT_SETTINGS, guide_seen: true });
  });

  test("an empty object is legacy settings: defaults, guide seen", () => {
    expect(parse_settings({})).toEqual({ ...DEFAULT_SETTINGS, guide_seen: true });
  });

  test("valid values survive", () => {
    const stored: SettingsState = {
      quality: "low",
      name: "Hopper",
      laps: 5,
      tcs: false,
      abs: false,
      assist: false,
      auto: false,
      steer_mode: "smooth",
      precision_key: true,
      bindings: rebind_key(DEFAULT_BINDINGS, "reset", "KeyC").bindings,
      touch_steer: "buttons",
      steer_sensitivity: "low",
      camera: "cockpit",
      camera_return: "never",
      invert_y: true,
      ghost: false,
      volume: 0.25,
      muted: true,
      hud: "compact",
      dash: "center",
      map: "pace",
      show_country: false,
      last_world: "sky",
      last_seed: 4294967295,
      guide_seen: false,
      smooth_steer: true,
    };
    expect(parse_settings(stored)).toEqual(stored);
  });

  test("wrong types fall back per field", () => {
    const parsed = parse_settings({ quality: 1, laps: "3", tcs: "no", volume: "0.5", hud: null, bindings: [], last_world: 2, last_seed: "12", name: 7, guide_seen: "yes" });
    expect(parsed).toEqual({ ...DEFAULT_SETTINGS, guide_seen: true });
  });

  test("out-of-range values fall back or clamp", () => {
    expect(parse_settings({ laps: 4 }).laps).toBe(3);
    expect(parse_settings({ quality: "ultra" }).quality).toBe("auto");
    expect(parse_settings({ volume: 3 }).volume).toBe(1);
    expect(parse_settings({ volume: -1 }).volume).toBe(0);
    expect(parse_settings({ volume: Number.NaN }).volume).toBe(0.8);
    expect(parse_settings({ last_seed: 4294967296 }).last_seed).toBeNull();
    expect(parse_settings({ last_seed: -1 }).last_seed).toBeNull();
    expect(parse_settings({ last_seed: 1.5 }).last_seed).toBeNull();
    expect(parse_settings({ last_world: "moon" }).last_world).toBeNull();
  });

  test("names are cleaned, blank names roll a random one", () => {
    expect(parse_settings({ name: "  Old   Timer  " }).name).toBe("Old Timer");
    expect(parse_settings({ name: "   " }).name).toBeNull();
  });

  test("unknown keys are dropped", () => {
    expect(parse_settings({ junk: 1 })).toEqual({ ...DEFAULT_SETTINGS, guide_seen: true });
  });
});

describe("smooth steer default", () => {
  test("a save from before Smooth moves Classic to Smooth once", () => {
    expect(parse_settings({ steer_mode: SteerMode.SNAP }).steer_mode).toBe(SteerMode.SMOOTH);
  });

  test("Classic picked after the move stays Classic", () => {
    expect(parse_settings({ steer_mode: SteerMode.SNAP, smooth_steer: true }).steer_mode).toBe(SteerMode.SNAP);
  });

  test("Hold is never moved", () => {
    expect(parse_settings({ steer_mode: SteerMode.HOLD }).steer_mode).toBe(SteerMode.HOLD);
  });
});

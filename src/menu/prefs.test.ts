import { describe, expect, test } from "bun:test";
import { SteerMode } from "../car/car";
import { DEFAULT_BINDINGS, rebind_key } from "../hud/bindings";
import { DEFAULT_PAD_RESPONSE } from "../hud/pad-curve";
import { DEFAULT_SETTINGS, SAVED_MAPS_MAX, pad_settings, parse_settings, type SettingsState } from "./prefs";

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
      stability: true,
      auto: false,
      steer_mode: "smooth",
      precision_key: true,
      bindings: rebind_key(DEFAULT_BINDINGS, "reset", "KeyC").bindings,
      touch_steer: "buttons",
      steer_sensitivity: "low",
      rumble: "strong",
      pad_steer_inner: 15,
      pad_steer_outer: 90,
      pad_steer_linearity: 50,
      pad_throttle_inner: 5,
      pad_throttle_outer: 80,
      pad_brake_inner: 10,
      pad_brake_outer: 95,
      camera: "cockpit",
      camera_return: "never",
      speed_zoom: "strong",
      camera_tilt: false,
      invert_y: true,
      ghost: false,
      volume: 0.25,
      muted: true,
      hud: "compact",
      dash: "center",
      speedo: "bar",
      map: "pace",
      show_country: false,
      last_world: "sky",
      last_seed: 4294967295,
      last_map: "1S3ZZZZZZ-A0",
      saved_maps: [{ name: "Gap run", code: "1S3ZZZZZZ-A0" }, { name: "Plain", code: "1C000001A" }],
      last_mainland_seed: 12,
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
    expect(parse_settings({ last_map: "1C000001A" }).last_map).toBeNull();
    expect(parse_settings({ last_map: "1c000001a-e2" }).last_map).toBeNull();
    expect(parse_settings({ last_map: "1Z000001A-E2" }).last_map).toBeNull();
  });

  test("saved maps keep only named entries with a canonical code, capped", () => {
    const maps = [{ name: " Mine ", code: "1C000001A-E2" }, { name: "", code: "1C000001A" }, { name: "Lower", code: "1c000001a" }, { name: "Newer", code: "1Z000001A" }, "x", null];
    expect(parse_settings({ saved_maps: maps }).saved_maps).toEqual([{ name: "Mine", code: "1C000001A-E2" }]);
    expect(parse_settings({ saved_maps: Array(80).fill({ name: "a", code: "1C000001A" }) }).saved_maps).toHaveLength(SAVED_MAPS_MAX);
    expect(parse_settings({ saved_maps: { name: "a" } }).saved_maps).toEqual([]);
  });

  test("saves from before the pad settings get the old fixed pad curve", () => {
    const parsed = parse_settings({ tcs: false });
    expect(pad_settings(parsed)).toEqual(DEFAULT_PAD_RESPONSE);
    expect(pad_settings(parsed).steer).toEqual({ inner: 0.08, outer: 1, exponent: 1.4 });
    expect(pad_settings(parsed).throttle).toEqual({ inner: 0, outer: 1, exponent: 1 });
  });

  test("corrupt deadzone pairs are repaired to legal ones", () => {
    const parsed = parse_settings({ pad_steer_inner: 90, pad_steer_outer: 20, pad_throttle_inner: 0, pad_throttle_outer: 0, pad_brake_inner: 45, pad_brake_outer: 50 });
    expect([parsed.pad_steer_inner, parsed.pad_steer_outer]).toEqual([50, 60]);
    expect([parsed.pad_throttle_inner, parsed.pad_throttle_outer]).toEqual([0, 50]);
    expect([parsed.pad_brake_inner, parsed.pad_brake_outer]).toEqual([45, 55]);
  });

  test("pad percents clamp to 0..100 and round", () => {
    expect(parse_settings({ pad_steer_inner: 140 }).pad_steer_inner).toBe(50);
    expect(parse_settings({ pad_steer_outer: -5 }).pad_steer_outer).toBe(50);
    expect(parse_settings({ pad_steer_linearity: 33.6 }).pad_steer_linearity).toBe(34);
    expect(parse_settings({ pad_brake_inner: "10" }).pad_brake_inner).toBe(0);
  });

  test("names are cleaned, blank names roll a random one", () => {
    expect(parse_settings({ name: "  Old   Timer  " }).name).toBe("Old Timer");
    expect(parse_settings({ name: "   " }).name).toBeNull();
  });

  test("unknown keys are dropped", () => {
    expect(parse_settings({ junk: 1 })).toEqual({ ...DEFAULT_SETTINGS, guide_seen: true });
  });
});

describe("steering assist and stability split", () => {
  test("a save from before the split gives stability the old steer assist's value", () => {
    expect(parse_settings({ assist: false })).toMatchObject({ assist: false, stability: false });
    expect(parse_settings({ assist: true })).toMatchObject({ assist: true, stability: true });
    expect(parse_settings({})).toMatchObject({ assist: true, stability: true });
  });

  test("a saved stability is kept apart from the steering assist", () => {
    expect(parse_settings({ assist: false, stability: true })).toMatchObject({ assist: false, stability: true });
    expect(parse_settings({ assist: true, stability: false })).toMatchObject({ assist: true, stability: false });
  });

  test("both are on by default", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ assist: true, stability: true });
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

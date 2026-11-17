import { Difficulty } from "../ai/difficulty";
import { SteerMode } from "../car/car";
import { DEFAULT_BINDINGS, parse_bindings, type Bindings } from "../hud/bindings";
import { RumbleLevel } from "../hud/rumble";
import { fit_zone, pad_response, STEER_INNER, STEER_LINEARITY, STEER_OUTER, TRIGGER_INNER, TRIGGER_OUTER, type PadPercents, type PadResponse } from "../hud/pad-curve";
import { guide_seen_on_load, seen_flag } from "./guide-rules";
import { clean_name } from "../net/net";
import { parse_last_seed, parse_last_world } from "./saved-pick";
import type { WorldKind } from "../worldgen/types";
import { clean_map_code } from "../worldgen/kinds/map-code";
import { DEFAULT_CUSTOM, parse_custom_race, type CustomRace } from "../modes/custom-race";

export const QualityMode = {
  AUTO: "auto",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;
export type QualityMode = (typeof QualityMode)[keyof typeof QualityMode];
export type QualityTier = Exclude<QualityMode, "auto">;

export const CameraView = {
  CHASE: "chase",
  COCKPIT: "cockpit",
} as const;
export type CameraView = (typeof CameraView)[keyof typeof CameraView];

/** When a mouse look moved off the chase angle eases back behind the car, once the car drives. */
export const CameraReturn = {
  OFF: "off",
  SHORT: "short",
  LONG: "long",
  NEVER: "never",
} as const;
export type CameraReturn = (typeof CameraReturn)[keyof typeof CameraReturn];

/** Seconds of driving before the camera eases back; `off` returns at once. */
export const CAMERA_RETURN_SECONDS: Record<CameraReturn, number> = { off: 0, short: 1.5, long: 3, never: Infinity };

export const SpeedZoom = {
  OFF: "off",
  SUBTLE: "subtle",
  STRONG: "strong",
} as const;
export type SpeedZoom = (typeof SpeedZoom)[keyof typeof SpeedZoom];

export const HudSize = {
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
} as const;
export type HudSize = (typeof HudSize)[keyof typeof HudSize];

/** How the speed card draws: a big speed over a rev bar, or the speed inside a rev dial. */
export const SpeedoStyle = {
  BAR: "bar",
  DIAL: "dial",
} as const;
export type SpeedoStyle = (typeof SpeedoStyle)[keyof typeof SpeedoStyle];

/** What the map card shows: the map's picture north up, the run's route alone, the road ahead turning with the car, or nothing. */
export const MapView = {
  REAL: "real",
  LINE: "line",
  CLOSE: "close",
  OFF: "off",
} as const;
export type MapView = (typeof MapView)[keyof typeof MapView];

export const TouchSteer = { DRAG: "drag", BUTTONS: "buttons" } as const;
export type TouchSteer = (typeof TouchSteer)[keyof typeof TouchSteer];

/** How little finger travel drag steering needs for full lock; the px per step live in `hud/drag-steer.ts`. */
export const SteerSensitivity = { LOW: "low", MEDIUM: "medium", HIGH: "high", VERY_HIGH: "very_high" } as const;
export type SteerSensitivity = (typeof SteerSensitivity)[keyof typeof SteerSensitivity];

export const LAPS = [1, 2, 3, 5] as const;
export type Laps = (typeof LAPS)[number];

export interface SettingsState {
  quality: QualityMode;
  /** null: a random bunny name each load. */
  name: string | null;
  laps: Laps;
  tcs: boolean;
  abs: boolean;
  /** Steering assist: grip-limited lock and auto countersteer. */
  assist: boolean;
  /** Stability (STM): the yaw damper. Saves from before the split take the old steer assist's value. */
  stability: boolean;
  auto: boolean;
  steer_mode: SteerMode;
  precision_key: boolean;
  bindings: Bindings;
  touch_steer: TouchSteer;
  steer_sensitivity: SteerSensitivity;
  /** Pad rumble from tyre slip, rough ground, kerbs, landings and hits. */
  rumble: RumbleLevel;
  /** Pad deadzones and steering linearity, 0..100 each; see `hud/pad-curve.ts`. */
  pad_steer_inner: number;
  pad_steer_outer: number;
  pad_steer_linearity: number;
  pad_throttle_inner: number;
  pad_throttle_outer: number;
  pad_brake_inner: number;
  pad_brake_outer: number;
  camera: CameraView;
  camera_return: CameraReturn;
  speed_zoom: SpeedZoom;
  camera_tilt: boolean;
  invert_y: boolean;
  ghost: boolean;
  /** How fast and how clean an AI field races (O5); nothing is recorded against it. */
  ai_difficulty: Difficulty;
  /** Master volume, 0..1. */
  volume: number;
  muted: boolean;
  hud_size: HudSize;
  speedo: SpeedoStyle;
  /** Saved as `minimap`: saves from before the one HUD kept `map`, where Off was often not the player's pick, so those start on the default. */
  minimap: MapView;
  mirror: boolean;
  /** Sends the country guessed from the time zone with this player's directory entry. */
  show_country: boolean;
  /** The world the player last picked in the menu; a bare URL drives it again. Never set by an invite or a join. */
  last_world: WorldKind | null;
  last_seed: number | null;
  /** The custom map picked with `last_world`, as its code; null for the plain map. */
  last_map: string | null;
  /** The mainland map last driven, for Play's map and its Keep driving while the player is on a mini map. */
  last_mainland_seed: number | null;
  /** Set by Drive, Skip or the last step of the first-run guide; never by an invite link. */
  guide_seen: boolean;
  /** The last race set up on the Custom race page. */
  custom_race: CustomRace;
  /** Set once Classic, the old default steer mode, has been moved to Smooth; a later pick of Classic sticks. */
  smooth_steer: boolean;
}
export type SettingKey = keyof SettingsState;

interface Field<T> {
  fallback: T;
  parse(raw: unknown): T;
}

const one_of = <T extends string | number>(values: readonly T[], fallback: T): Field<T> => ({
  fallback,
  parse: (raw) => (values.includes(raw as T) ? (raw as T) : fallback),
});

const flag = (fallback: boolean): Field<boolean> => ({ fallback, parse: (raw) => (typeof raw === "boolean" ? raw : fallback) });

const percent = (fallback: number): Field<number> => ({ fallback, parse: (raw) => (typeof raw === "number" && Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : fallback) });

const FIELDS: { [K in SettingKey]: Field<SettingsState[K]> } = {
  quality: one_of(Object.values(QualityMode), QualityMode.AUTO),
  name: { fallback: null, parse: (raw) => (typeof raw === "string" && raw.trim() ? clean_name(raw) : null) },
  laps: one_of(LAPS, 3),
  tcs: flag(true),
  abs: flag(true),
  assist: flag(true),
  stability: flag(true),
  auto: flag(true),
  steer_mode: one_of(Object.values(SteerMode), SteerMode.SMOOTH),
  precision_key: flag(false),
  bindings: { fallback: DEFAULT_BINDINGS, parse: parse_bindings },
  touch_steer: one_of(Object.values(TouchSteer), TouchSteer.DRAG),
  steer_sensitivity: one_of(Object.values(SteerSensitivity), SteerSensitivity.MEDIUM),
  rumble: one_of(Object.values(RumbleLevel), RumbleLevel.SUBTLE),
  pad_steer_inner: percent(STEER_INNER),
  pad_steer_outer: percent(STEER_OUTER),
  pad_steer_linearity: percent(STEER_LINEARITY),
  pad_throttle_inner: percent(TRIGGER_INNER),
  pad_throttle_outer: percent(TRIGGER_OUTER),
  pad_brake_inner: percent(TRIGGER_INNER),
  pad_brake_outer: percent(TRIGGER_OUTER),
  camera: one_of(Object.values(CameraView), CameraView.CHASE),
  camera_return: one_of(Object.values(CameraReturn), CameraReturn.SHORT),
  speed_zoom: one_of(Object.values(SpeedZoom), SpeedZoom.SUBTLE),
  camera_tilt: flag(false),
  invert_y: flag(false),
  ghost: flag(true),
  ai_difficulty: one_of(Object.values(Difficulty), Difficulty.NORMAL),
  volume: { fallback: 0.8, parse: (raw) => (typeof raw === "number" && Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.8) },
  muted: flag(false),
  hud_size: one_of(Object.values(HudSize), HudSize.MEDIUM),
  speedo: one_of(Object.values(SpeedoStyle), SpeedoStyle.BAR),
  minimap: one_of(Object.values(MapView), MapView.REAL),
  mirror: flag(true),
  show_country: flag(true),
  last_world: { fallback: null, parse: parse_last_world },
  last_seed: { fallback: null, parse: parse_last_seed },
  last_map: { fallback: null, parse: clean_map_code },
  last_mainland_seed: { fallback: null, parse: parse_last_seed },
  guide_seen: { fallback: false, parse: seen_flag },
  custom_race: { fallback: DEFAULT_CUSTOM, parse: parse_custom_race },
  smooth_steer: flag(true),
};

const KEYS = Object.keys(FIELDS) as SettingKey[];

function from_fields(pick: <K extends SettingKey>(key: K, field: Field<SettingsState[K]>) => SettingsState[K]): SettingsState {
  return Object.fromEntries(KEYS.map((key) => [key, pick(key, FIELDS[key])])) as unknown as SettingsState;
}

export const DEFAULT_SETTINGS: SettingsState = from_fields((_, field) => field.fallback);

export function parse_settings(raw: unknown, played = false): SettingsState {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SETTINGS, guide_seen: guide_seen_on_load(raw, played) };
  const stored = raw as Record<string, unknown>;
  const state = from_fields((key, field) => field.parse(stored[key]));
  if (stored.smooth_steer !== true && state.steer_mode === SteerMode.SNAP) state.steer_mode = SteerMode.SMOOTH;
  state.smooth_steer = true;
  if (typeof stored.stability !== "boolean") state.stability = state.assist;
  for (const axis of ["steer", "throttle", "brake"] as const) {
    [state[`pad_${axis}_inner`], state[`pad_${axis}_outer`]] = fit_zone(state[`pad_${axis}_inner`], state[`pad_${axis}_outer`], "inner");
  }
  return state;
}

export const pad_percents = (s: SettingsState): PadPercents => ({
  steer_inner: s.pad_steer_inner,
  steer_outer: s.pad_steer_outer,
  steer_linearity: s.pad_steer_linearity,
  throttle_inner: s.pad_throttle_inner,
  throttle_outer: s.pad_throttle_outer,
  brake_inner: s.pad_brake_inner,
  brake_outer: s.pad_brake_outer,
});

export const pad_settings = (s: SettingsState): PadResponse => pad_response(pad_percents(s));

import { SteerMode } from "../car/car";
import { DEFAULT_BINDINGS, parse_bindings, type Bindings } from "../hud/bindings";
import { guide_seen_on_load, seen_flag } from "./guide-rules";
import { clean_name, parse_seed } from "../net/net";
import { is_kind } from "../worldgen/kinds/kinds";
import type { WorldKind } from "../worldgen/types";

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

/** Where the HUD pieces sit; each is a CSS layout keyed on `data-hud` on the root. */
export const HudLayout = {
  MINIMAL: "minimal",
  CLASSIC: "classic",
  RACING: "racing",
  COMPACT: "compact",
} as const;
export type HudLayout = (typeof HudLayout)[keyof typeof HudLayout];

/** Where the dash (speed, gear, revs, aid switches) sits in Classic and Minimal; Racing always centres it, Compact keeps it up top. */
export const DashPlace = {
  RIGHT: "right",
  CENTER: "center",
} as const;
export type DashPlace = (typeof DashPlace)[keyof typeof DashPlace];

export const MapView = {
  FULL: "full",
  CLOSE: "close",
  PACE: "pace",
  OFF: "off",
} as const;
export type MapView = (typeof MapView)[keyof typeof MapView];

export const TouchSteer = { DRAG: "drag", BUTTONS: "buttons" } as const;
export type TouchSteer = (typeof TouchSteer)[keyof typeof TouchSteer];

export const LAPS = [1, 2, 3, 5] as const;
export type Laps = (typeof LAPS)[number];

export interface SettingsState {
  quality: QualityMode;
  /** null: a random bunny name each load. */
  name: string | null;
  laps: Laps;
  tcs: boolean;
  abs: boolean;
  assist: boolean;
  auto: boolean;
  steer_mode: SteerMode;
  precision_key: boolean;
  bindings: Bindings;
  touch_steer: TouchSteer;
  camera: CameraView;
  camera_return: CameraReturn;
  invert_y: boolean;
  ghost: boolean;
  /** Master volume, 0..1. */
  volume: number;
  muted: boolean;
  hud: HudLayout;
  dash: DashPlace;
  map: MapView;
  /** Sends the country guessed from the time zone with this player's directory entry. */
  show_country: boolean;
  /** The world the player last picked in the menu; a bare URL drives it again. Never set by an invite or a join. */
  last_world: WorldKind | null;
  last_seed: number | null;
  /** Set by Drive, Skip or the last step of the first-run guide; never by an invite link. */
  guide_seen: boolean;
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

const FIELDS: { [K in SettingKey]: Field<SettingsState[K]> } = {
  quality: one_of(Object.values(QualityMode), QualityMode.AUTO),
  name: { fallback: null, parse: (raw) => (typeof raw === "string" && raw.trim() ? clean_name(raw) : null) },
  laps: one_of(LAPS, 3),
  tcs: flag(true),
  abs: flag(true),
  assist: flag(true),
  auto: flag(true),
  steer_mode: one_of(Object.values(SteerMode), SteerMode.SMOOTH),
  precision_key: flag(false),
  bindings: { fallback: DEFAULT_BINDINGS, parse: parse_bindings },
  touch_steer: one_of(Object.values(TouchSteer), TouchSteer.DRAG),
  camera: one_of(Object.values(CameraView), CameraView.CHASE),
  camera_return: one_of(Object.values(CameraReturn), CameraReturn.SHORT),
  invert_y: flag(false),
  ghost: flag(true),
  volume: { fallback: 0.8, parse: (raw) => (typeof raw === "number" && Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.8) },
  muted: flag(false),
  hud: one_of(Object.values(HudLayout), HudLayout.CLASSIC),
  dash: one_of(Object.values(DashPlace), DashPlace.RIGHT),
  map: one_of(Object.values(MapView), MapView.FULL),
  show_country: flag(true),
  last_world: { fallback: null, parse: (raw) => (is_kind(raw) ? raw : null) },
  last_seed: { fallback: null, parse: (raw) => (typeof raw === "number" ? parse_seed(String(raw)) : null) },
  guide_seen: { fallback: false, parse: seen_flag },
};

const KEYS = Object.keys(FIELDS) as SettingKey[];

function from_fields(pick: <K extends SettingKey>(key: K, field: Field<SettingsState[K]>) => SettingsState[K]): SettingsState {
  return Object.fromEntries(KEYS.map((key) => [key, pick(key, FIELDS[key])])) as unknown as SettingsState;
}

export const DEFAULT_SETTINGS: SettingsState = from_fields((_, field) => field.fallback);

export function parse_settings(raw: unknown, played = false): SettingsState {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SETTINGS, guide_seen: guide_seen_on_load(raw, played) };
  const stored = raw as Record<string, unknown>;
  return from_fields((key, field) => field.parse(stored[key]));
}

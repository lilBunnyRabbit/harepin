import type { Difficulty } from "../../ai/difficulty";
import { SteerMode } from "../../car/car";
import { keys_text, pad_text, type Bindable, type Bindings } from "../../hud/bindings";
import { RumbleLevel } from "../../hud/rumble";
import { CameraReturn, CameraView, MapView, QualityMode, SpeedoStyle, SpeedZoom, type QualityTier, type SettingKey, type SettingsState } from "../prefs";
import type { ThemeBase } from "../../theme/theme";
import type { Option } from "../ui/types";

export interface SectionMeta {
  id: string;
  label: string;
  icon: string;
  keys: readonly SettingKey[];
}

export interface DeepMeta {
  id: string;
  label: string;
  parent: string;
}

/** `SettingsNav.sub` on the list of section cards, before a section is open. */
export const LIST = "";
/** The What's new page, a page of its own beside the sections. */
export const CHANGES = "changes";

export const SECTIONS: readonly SectionMeta[] = [
  { id: "graphics", label: "Graphics", icon: "icon-graphics", keys: ["quality"] },
  { id: "display", label: "Display", icon: "icon-display", keys: ["hud_size", "speedo", "minimap"] },
  { id: "driving", label: "Driving", icon: "icon-aids", keys: ["tcs", "abs", "assist", "stability", "auto", "ghost", "ai_difficulty"] },
  { id: "camera", label: "Camera", icon: "icon-camera", keys: ["camera", "camera_return", "speed_zoom", "camera_tilt", "invert_y"] },
  {
    id: "controls",
    label: "Controls",
    icon: "icon-controls",
    keys: [
      "steer_mode",
      "precision_key",
      "touch_steer",
      "steer_sensitivity",
      "rumble",
      "pad_steer_inner",
      "pad_steer_outer",
      "pad_steer_linearity",
      "pad_throttle_inner",
      "pad_throttle_outer",
      "pad_brake_inner",
      "pad_brake_outer",
    ],
  },
  { id: "audio", label: "Audio", icon: "icon-audio", keys: ["volume", "muted"] },
  { id: "net", label: "Online", icon: "icon-globe", keys: ["show_country"] },
];

export const DEEP: readonly DeepMeta[] = [
  { id: "creator", label: "Make your own theme", parent: "display" },
  { id: "themes", label: "Your themes", parent: "display" },
  { id: "keys", label: "All keys and buttons", parent: "controls" },
  { id: "bindings", label: "Change keys and buttons", parent: "controls" },
];

export const TIER_LABEL: Record<QualityTier, string> = { high: "High", medium: "Medium", low: "Low" };
export const CAMERA_RETURN_LABEL: Record<CameraReturn, string> = { off: "Off", short: "1.5 s", long: "3 s", never: "Never" };
export const SPEED_ZOOM_LABEL: Record<SpeedZoom, string> = { off: "Off", subtle: "Subtle", strong: "Strong" };
export const RUMBLE_LABEL: Record<RumbleLevel, string> = { off: "Off", subtle: "Subtle", strong: "Strong" };
export const STEER_LABEL: Record<SteerMode, string> = { snap: "Classic", hold: "Hold", smooth: "Smooth" };
export const MAP_VIEWS: Record<MapView, [string, string]> = {
  real: ["Realistic", "The map's own picture around you, north up"],
  line: ["Race line", "Only the route of the run you are in, with the next gate and the other cars. Roaming shows Realistic"],
  close: ["Close-up", "Turns with you and shows the road about 130 m ahead"],
  off: ["Off", "No map"],
};
export const SPEEDO_STYLES: Record<SpeedoStyle, [string, string]> = {
  bar: ["Bar", "A big speed over a rev bar"],
  dial: ["Dial", "The speed inside a round rev dial"],
};

export const options = <T extends string | number>(labels: Record<T, string> | readonly (readonly [T, string])[]): Option<T>[] =>
  Array.isArray(labels) ? labels.map(([value, label]) => ({ value, label })) : (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));

export type WirePart = "title" | "map" | "speed";

export interface WireBox {
  part: WirePart;
  inset: string;
  /** The speed box is a circle for the dial; the map box draws the picked view. */
  look: MapView | SpeedoStyle | null;
}

/** The one HUD as a mini wireframe: part, then x, y, width, height in percent of a 16:9 frame. */
const WIRE: [WirePart, number, number, number, number][] = [
  ["title", 36, 6, 28, 12],
  ["map", 4, 68, 22, 26],
  ["speed", 74, 68, 22, 26],
];

export function wire_boxes(map: MapView, speedo: SpeedoStyle): WireBox[] {
  const boxes: WireBox[] = [];
  for (const [part, x, y, w, h] of WIRE) {
    if (part === "map" && map === MapView.OFF) continue;
    boxes.push({ part, inset: `${y}% ${100 - x - w}% ${100 - y - h}% ${x}%`, look: part === "map" ? map : part === "speed" ? speedo : null });
  }
  return boxes;
}

/** What a section card reads beside the saved settings. */
export interface SummaryLive {
  tier: QualityTier;
  theme: string;
  name: string;
}

const AID_KEYS = ["tcs", "abs", "assist", "stability"] as const;
const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "easy", normal: "normal", hard: "hard" };

/** A section's current values, the most telling first: its card on the Settings list shows them. */
export function summary(id: string, state: SettingsState, live: SummaryLive): string[] {
  switch (id) {
    case "graphics":
      return [state.quality === QualityMode.AUTO ? `Auto, running ${TIER_LABEL[live.tier]}` : `Fixed at ${TIER_LABEL[live.tier]}`];
    case "display":
      return [live.theme, `${MAP_VIEWS[state.minimap][0]} map`, `${SPEEDO_STYLES[state.speedo][0]} speedometer`];
    case "driving":
      return [`${AID_KEYS.filter((aid) => state[aid]).length} of ${AID_KEYS.length} aids`, `${state.auto ? "Auto" : "Manual"} gears`, `AI ${DIFFICULTY_LABEL[state.ai_difficulty]}`];
    case "camera":
      return [state.camera === CameraView.CHASE ? "Chase" : "Cockpit", `Returns ${CAMERA_RETURN_LABEL[state.camera_return].toLowerCase()}`, `Speed zoom ${SPEED_ZOOM_LABEL[state.speed_zoom].toLowerCase()}`];
    case "controls":
      return [`${STEER_LABEL[state.steer_mode]} steering`, `Rumble ${RUMBLE_LABEL[state.rumble].toLowerCase()}`];
    case "audio":
      return [state.muted ? "Muted" : `Volume ${Math.round(state.volume * 100)}%`];
    case "net":
      return [live.name, state.show_country ? "Country shown" : "Country hidden"];
    default:
      return [];
  }
}

export const list_help = (bindings: Bindings) => {
  const key = keys_text(bindings.help);
  return `Every key, pad button and touch control.${key ? ` ${key} opens this list while driving.` : ""}`;
};

export const while_driving = (bindings: Bindings, action: Bindable, help: string) => {
  const key = keys_text(bindings[action]);
  return key ? `${help} ${key} switches it while driving.` : help;
};

type Shown = string | ((bindings: Bindings) => string);

const keys =
  (...actions: Bindable[]) =>
  (bindings: Bindings) =>
    actions.map((action) => keys_text(bindings[action])).join(" / ");
const pads =
  (...actions: Bindable[]) =>
  (bindings: Bindings) =>
    actions
      .map((action) => pad_text(bindings, action))
      .filter(Boolean)
      .join(" / ");
const also =
  (shown: (bindings: Bindings) => string, more: string, by = " / ") =>
  (bindings: Bindings) =>
    [shown(bindings), more].filter(Boolean).join(by);

export const KEYS: [string, Shown, Shown, string][] = [
  ["Gas", keys("throttle"), "RT", "Gas"],
  ["Brake", keys("brake"), "LT", "Brake"],
  ["Steer", keys("steer_left", "steer_right"), "L stick", "Drag or arrow buttons to steer (Touch steering)"],
  ["Handbrake", keys("handbrake"), pads("handbrake"), "Handbrake"],
  ["Precision steer (hold, when on)", keys("precision"), "", ""],
  ["Nitro (hold, when fitted)", keys("nitro"), pads("nitro"), "Nitro key: tap on, tap off or burn the tank"],
  ["Reset", keys("reset"), pads("reset"), "Reset"],
  ["Restart lap", also(keys("restart"), "lap strip button"), pads("restart"), "Lap strip button"],
  ["Rewind (hold)", keys("rewind"), pads("rewind"), "Rewind (hold)"],
  ["Shift up / down", keys("shift_up", "shift_down"), pads("shift_up", "shift_down"), ""],
  ["Auto gearbox", keys("auto"), pads("auto"), ""],
  ["Camera", keys("camera"), pads("camera"), "Cam"],
  ["Look around", "Drag / wheel", "R stick", "Drag, pinch to zoom"],
  ["Recenter camera", also(keys("recenter"), "double-click"), pads("recenter"), "Recenter"],
  ["Ghost", keys("ghost"), pads("ghost"), ""],
  ["TCS / ABS / steering / stability", keys("tcs", "abs", "assist", "stability"), pads("tcs", "abs", "assist", "stability"), ""],
  ["Garage", keys("garage"), also(pads("garage"), "Start, Garage", ", "), ""],
  ["World map", keys("map"), pads("map"), ""],
  ["This key list", keys("help"), pads("help"), ""],
  ["Chat", "T", "", "Chat"],
  ["Menu", "Esc", "Start", "Menu button"],
  ["In menus: move, pick, back, stations", "Arrows, Enter, Esc, Q / E", "D-pad, A, B, LB / RB", ""],
  ["In Settings: next section, reset section", "X", "LT / RT, Y", ""],
];

export const shown = (way: Shown, bindings: Bindings) => (typeof way === "string" ? way : way(bindings));

const SEPARATOR = /(, | \/ )/;

export const chips = (text: string): { chip: boolean; text: string }[] =>
  text ? text.split(SEPARATOR).map((part) => ({ chip: !SEPARATOR.test(part), text: part })) : [];

/** Reload without the URL param, after a change the page only applies on load. */
export function reload_without(param: string) {
  const params = new URLSearchParams(location.search);
  params.delete(param);
  const search = params.toString();
  location.replace(`${location.pathname}${search ? `?${search}` : ""}${location.hash}`);
}

export const BASE_TOKENS: [keyof ThemeBase, string][] = [
  ["background", "Background"],
  ["foreground", "Text"],
  ["primary", "Main"],
  ["secondary", "Second"],
  ["accent", "Accent"],
];

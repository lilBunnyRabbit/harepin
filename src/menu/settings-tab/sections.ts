import { SteerMode } from "../../car/car";
import { keys_text, pad_text, type Bindable, type Bindings } from "../../hud/bindings";
import { RumbleLevel } from "../../hud/rumble";
import { CameraReturn, CameraView, HudLayout, MapView, QualityMode, SpeedZoom, type QualityTier, type SettingKey, type SettingsState } from "../prefs";
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

export const CHANGES = "changes";

export const SECTIONS: readonly SectionMeta[] = [
  { id: "graphics", label: "Graphics", icon: "icon-graphics", keys: ["quality"] },
  { id: "display", label: "Display", icon: "icon-display", keys: ["hud", "dash", "speedo", "map", "map_corner"] },
  { id: "driving", label: "Driving", icon: "icon-aids", keys: ["tcs", "abs", "assist", "stability", "auto", "ghost"] },
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
  full: ["Full", "The whole track"],
  close: ["Close-up", "Turns with you and shows the next 200 m"],
  pace: ["Notes", "Rally pace notes instead of a map: the next turn, 1 tightest to 6 fastest, and how far off it is"],
  off: ["Off", "No map"],
};

export const options = <T extends string | number>(labels: Record<T, string> | readonly (readonly [T, string])[]): Option<T>[] =>
  Array.isArray(labels) ? labels.map(([value, label]) => ({ value, label })) : (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));

export type WirePart = "bar" | "title" | "strip" | "map" | "speed" | "dash";

export interface HudLayoutOption {
  value: HudLayout;
  name: string;
  note: string;
  /** Mini wireframe for the picker: part, then x, y, width, height in percent of a 16:9 frame. */
  wire: [WirePart, number, number, number, number][];
}

export const HUD_LAYOUTS: HudLayoutOption[] = [
  {
    value: HudLayout.MINIMAL,
    name: "Minimal",
    note: "Speed and gear; the rest when it matters",
    wire: [
      ["bar", 4, 6, 15, 11],
      ["map", 86, 6, 10, 18],
      ["speed", 78, 76, 18, 18],
    ],
  },
  {
    value: HudLayout.CLASSIC,
    name: "Classic",
    note: "Everything in the corners",
    wire: [
      ["title", 4, 6, 17, 11],
      ["bar", 23, 6, 15, 11],
      ["strip", 40, 6, 24, 11],
      ["map", 82, 6, 14, 25],
      ["dash", 4, 85, 24, 9],
      ["speed", 74, 70, 22, 24],
    ],
  },
  {
    value: HudLayout.RACING,
    name: "Racing",
    note: "Lap timer on top, dash in the middle",
    wire: [
      ["title", 4, 6, 13, 11],
      ["bar", 19, 6, 12, 11],
      ["strip", 36, 6, 28, 13],
      ["map", 82, 6, 14, 25],
      ["speed", 38, 64, 24, 20],
      ["dash", 38, 86, 24, 8],
    ],
  },
  {
    value: HudLayout.COMPACT,
    name: "Compact",
    note: "One slim top row, bottom left free",
    wire: [
      ["bar", 4, 6, 15, 10],
      ["strip", 21, 6, 15, 10],
      ["dash", 38, 6, 20, 10],
      ["speed", 64, 6, 16, 10],
      ["map", 84, 6, 12, 22],
    ],
  },
];

export const hud_layout = (value: HudLayout) => HUD_LAYOUTS.find((layout) => layout.value === value) ?? HUD_LAYOUTS[0];

export interface WireBox {
  part: WirePart;
  inset: string;
  card: boolean;
}

export function wire_boxes(hud: HudLayout, map: MapView): WireBox[] {
  const boxes: WireBox[] = [];
  for (const [part, x, y, w, tall] of hud_layout(hud).wire) {
    if (part === "map" && map === MapView.OFF) continue;
    const h = part === "map" && map === MapView.PACE ? tall / 2 : tall;
    boxes.push({ part, inset: `${y}% ${100 - x - w}% ${100 - y - h}% ${x}%`, card: h !== tall });
  }
  return boxes;
}

export function summary(id: string, state: SettingsState, tier: QualityTier, theme: string): string {
  switch (id) {
    case "graphics":
      return state.quality === QualityMode.AUTO ? `Auto, running ${TIER_LABEL[tier]}` : `Fixed at ${TIER_LABEL[tier]}`;
    case "display":
      return `${hud_layout(state.hud).name} HUD · ${theme}`;
    case "driving":
      return `${(["tcs", "abs", "assist", "stability"] as const).filter((aid) => state[aid]).length} of 4 aids · ${state.auto ? "auto" : "manual"} gears`;
    case "camera":
      return `${state.camera === CameraView.CHASE ? "Chase" : "Cockpit"} · returns ${CAMERA_RETURN_LABEL[state.camera_return]}`;
    case "controls":
      return `Keyboard ${STEER_LABEL[state.steer_mode].toLowerCase()} · key list`;
    case "audio":
      return state.muted ? "Muted" : `Volume ${Math.round(state.volume * 100)}%`;
    case "net":
      return state.show_country ? "Country shown" : "Country hidden";
    default:
      return "";
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
  ["In menus: move, pick, back, tabs", "Arrows, Enter, Esc, Q / E", "D-pad, A, B, LB / RB", ""],
  ["In menus: sections, reset section", "", "LT / RT, Y", ""],
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

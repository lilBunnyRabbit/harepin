import { SteerMode } from "../car";
import { el, icon, type Options } from "../setting-rows";
import { THEMES, choose_theme, current_theme, find_saved, find_theme, load_saved_themes } from "../theme/theme";
import type { SettingsMenu } from "./page";
import { CameraReturn, CameraView, DashPlace, HudLayout, QualityMode, TouchSteer, type QualityTier } from "./prefs";
import { BASE_TOKENS, saved_themes, theme_create } from "./theme-pages";
import { stat } from "./widgets";

export interface SettingsSection {
  id: string;
  label: string;
  icon: string;
  summary: () => string;
  rows: () => HTMLElement[];
}

export interface DeepPage {
  id: string;
  label: string;
  parent: string;
  help: string;
  rows: () => HTMLElement[];
}

const CAMERA_RETURN_LABEL: Record<CameraReturn, string> = { off: "Off", short: "1.5 s", long: "3 s", never: "Never" };
const STEER_LABEL: Record<SteerMode, string> = { snap: "Classic", hold: "Hold", smooth: "Smooth" };

const TIER_LABEL: Record<QualityTier, string> = { high: "High", medium: "Medium", low: "Low" };
const KEYS: [string, string, string, string][] = [
  ["Drive", "WASD / arrows", "RT / LT, L stick", "Gas, Brake, drag or arrow buttons to steer (Touch steering)"],
  ["Handbrake", "Space", "A", "Handbrake"],
  ["Precision steer (hold, when on)", "X", "", ""],
  ["Nitro (hold, when fitted)", "Shift", "B", "Nitro key: tap on, tap off or burn the tank"],
  ["Reset", "R", "Y", "Reset"],
  ["Restart lap", "L / lap strip button", "", "Lap strip button"],
  ["Rewind (hold)", "Backspace", "X", "Rewind (hold)"],
  ["Shift up / down", "E / Q", "RB / LB", ""],
  ["Auto gearbox", "M", "", ""],
  ["Camera", "C", "View", "Cam"],
  ["Look around", "Drag / wheel", "R stick", "Drag, pinch to zoom"],
  ["Recenter camera", "F / double-click", "R3", "Recenter"],
  ["Ghost", "G", "", ""],
  ["TCS / ABS / steer assist", "1 / 2 / 3", "", ""],
  ["Garage", "V", "Start, Garage", ""],
  ["This key list", "H", "", ""],
  ["Chat", "T", "", "Chat"],
  ["Menu", "Esc", "Start", "Menu button"],
  ["In menus: move, pick, back, tabs", "Arrows, Enter, Esc, Q / E", "D-pad, A, B, LB / RB", ""],
  ["In menus: sections, reset section", "", "LT / RT, Y", ""],
];

const PAD_SEPARATOR = /(, | \/ )/;

type WirePart = "bar" | "title" | "strip" | "map" | "speed" | "dash";

interface HudLayoutOption {
  value: HudLayout;
  name: string;
  note: string;
  /** Mini wireframe for the picker: part, then x, y, width, height in percent of a 16:9 frame. */
  wire: [WirePart, number, number, number, number][];
}

const HUD_LAYOUTS: HudLayoutOption[] = [
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

const hud_name = (value: HudLayout) => HUD_LAYOUTS.find((layout) => layout.value === value)?.name ?? value;

const touch_only = (row: HTMLElement) => {
  row.classList.add("settings-touch-only");
  return row;
};

export function settings_sections(m: SettingsMenu): { sections: SettingsSection[]; deep: DeepPage[] } {
  const tier = () => TIER_LABEL[m.host.quality_status().tier];
  const sections: SettingsSection[] = [
    {
      id: "graphics",
      label: "Graphics",
      icon: "icon-graphics",
      summary: () => (m.state().quality === QualityMode.AUTO ? `Auto, running ${tier()}` : `Fixed at ${tier()}`),
      rows: () => graphics(m),
    },
    {
      id: "display",
      label: "Display",
      icon: "icon-display",
      summary: () => `${hud_name(m.state().hud)} HUD · ${current_theme()}`,
      rows: () => display(m),
    },
    {
      id: "driving",
      label: "Driving",
      icon: "icon-aids",
      summary: () => `${(["tcs", "abs", "assist"] as const).filter((aid) => m.state()[aid]).length} of 3 aids · ${m.state().auto ? "auto" : "manual"} gears`,
      rows: () => driving(m),
    },
    {
      id: "camera",
      label: "Camera",
      icon: "icon-camera",
      summary: () => `${m.state().camera === CameraView.CHASE ? "Chase" : "Cockpit"} · returns ${CAMERA_RETURN_LABEL[m.state().camera_return]}`,
      rows: () => camera(m),
    },
    {
      id: "controls",
      label: "Controls",
      icon: "icon-controls",
      summary: () => `Keyboard ${STEER_LABEL[m.state().steer_mode].toLowerCase()} · key list`,
      rows: () => controls(m),
    },
    {
      id: "audio",
      label: "Audio",
      icon: "icon-audio",
      summary: () => (m.state().muted ? "Muted" : `Volume ${Math.round(m.state().volume * 100)}%`),
      rows: () => audio(m),
    },
  ];
  const deep: DeepPage[] = [
    { id: "creator", label: "Make your own theme", parent: "display", help: "Roll colours, keep the ones you like, then name and save it.", rows: () => theme_create(m) },
    { id: "themes", label: "Your themes", parent: "display", help: "Themes you made. Pick one with Theme on Display.", rows: () => saved_themes(m) },
    { id: "keys", label: "All keys and buttons", parent: "controls", help: "Every key, pad button and touch control. H opens this list while driving.", rows: () => key_list(m) },
  ];
  return { sections, deep };
}

function graphics(m: SettingsMenu): HTMLElement[] {
  const status = () => {
    const s = m.host.quality_status();
    const node = el("div", "settings-status");
    node.append(
      el("span", "", m.state().quality === QualityMode.AUTO ? `Auto is running ${TIER_LABEL[s.tier]}` : `Fixed at ${TIER_LABEL[s.tier]}`),
      stat("scale", `${s.ratio.toFixed(2)}x`),
      stat("shadows", s.shadow_size ? `${s.shadow_size}px` : "off"),
      stat("bloom", s.bloom ? "on" : "off"),
    );
    return node;
  };
  return [
    m.rows.segmented(
      "Quality",
      "How much the game draws. Auto steps down when the frame rate drops.",
      m.value("quality"),
      [
        [QualityMode.AUTO, "Auto"],
        [QualityMode.HIGH, "High"],
        [QualityMode.MEDIUM, "Medium"],
        [QualityMode.LOW, "Low"],
      ],
      status,
    ),
    m.rows.info(
      "Running now",
      "What the game draws at this moment; Auto changes it as the frame rate moves.",
      () => {
        const s = m.host.quality_status();
        return `${TIER_LABEL[s.tier]} · ${s.ratio.toFixed(2)}x · shadows ${s.shadow_size ? `${s.shadow_size}px` : "off"} · bloom ${s.bloom ? "on" : "off"}`;
      },
      status,
    ),
  ];
}

function hud_wire(m: SettingsMenu): HTMLElement {
  const layout = HUD_LAYOUTS.find((option) => option.value === m.state().hud) ?? HUD_LAYOUTS[0];
  const frame = el("span", "hud-wire");
  frame.setAttribute("aria-hidden", "true");
  for (const [part, x, y, w, h] of layout.wire) {
    const box = el("span", `hud-wire-${part}`);
    box.style.inset = `${y}% ${100 - x - w}% ${100 - y - h}% ${x}%`;
    frame.append(box);
  }
  return frame;
}

function display(m: SettingsMenu): HTMLElement[] {
  const active = current_theme();
  const saved = load_saved_themes();
  const in_use = THEMES[active] ? active : (find_saved(saved, active)?.name ?? active);
  let pick = in_use;
  const names = (): Options<string> => [...saved.map(({ name }) => [name, name] as const), ...Object.keys(THEMES).map((name) => [name, name] as const)];
  const use = () => {
    if (pick === in_use) return;
    choose_theme(pick);
    m.reload("theme");
  };
  const swatches = () => {
    const theme = find_theme(pick, saved);
    if (!theme) return null;
    const row = el("span", "set-swatches");
    for (const [token] of BASE_TOKENS) {
      const swatch = el("i");
      swatch.style.background = theme[token];
      row.append(swatch);
    }
    return row;
  };
  const theme = m.rows.stepper(
    "Theme",
    () => (pick === in_use ? "Colours for the whole game." : "Press A or tap Use to switch to it. The page reloads."),
    {
      get: () => pick,
      set: (name) => {
        pick = name;
        m.refresh();
      },
    },
    names,
    swatches,
    use,
  );
  const use_button = el("button", "set-use", "Use");
  use_button.type = "button";
  use_button.tabIndex = -1;
  use_button.addEventListener("click", (event) => {
    event.stopPropagation();
    use();
  });
  theme.lastElementChild?.before(use_button);
  m.sync(() => (use_button.hidden = pick === in_use));

  const mine = m.rows.link("Your themes", "Themes you made: delete the ones you don't want.", () => `${load_saved_themes().length} saved`, () => m.show_sub("themes"));
  m.sync(() => (mine.hidden = load_saved_themes().length === 0));

  return [
    m.rows.stepper(
      "HUD layout",
      () => {
        const layout = HUD_LAYOUTS.find((option) => option.value === m.state().hud);
        return `Where speed, laps, map and buttons sit. ${layout?.name}: ${layout?.note}.`;
      },
      m.value("hud"),
      HUD_LAYOUTS.map(({ value, name }) => [value, name] as const),
      () => hud_wire(m),
    ),
    m.rows.segmented(
      "Dash",
      "Speed, gear and aids. Racing always centres it, Compact keeps it up top.",
      m.value("dash"),
      [
        [DashPlace.RIGHT, "Right"],
        [DashPlace.CENTER, "Centre"],
      ],
      () => hud_wire(m),
    ),
    theme,
    m.rows.link("Make your own theme", "Roll colours, keep the ones you like, then name and save it.", "Roll, adjust, save", () => m.show_sub("creator")),
    mine,
  ];
}

function driving(m: SettingsMenu): HTMLElement[] {
  return [
    m.rows.toggle("Traction control", "Cuts power when the rear wheels spin. 1 switches it while driving.", m.value("tcs")),
    m.rows.toggle("Anti-lock brakes", "Keeps steering under hard braking. 2 switches it while driving.", m.value("abs")),
    m.rows.toggle("Steering assist", "Counter-steers a slide for you. 3 switches it while driving.", m.value("assist")),
    m.rows.toggle("Automatic gearbox", "Shifts for you. M switches it while driving.", m.value("auto")),
    m.rows.toggle("Ghost car", "Your best lap drives beside you. G switches it while driving.", m.value("ghost")),
  ];
}

function camera(m: SettingsMenu): HTMLElement[] {
  return [
    m.rows.segmented("View", "Behind the car or from the driver's seat. C switches it while driving.", m.value("camera"), [
      [CameraView.CHASE, "Chase"],
      [CameraView.COCKPIT, "Cockpit"],
    ]),
    m.rows.segmented(
      "Returns after",
      "After a mouse look, the camera swings back behind the car once it drives.",
      m.value("camera_return"),
      Object.values(CameraReturn).map((value) => [value, CAMERA_RETURN_LABEL[value]] as const),
    ),
    m.rows.toggle("Invert camera Y", "Mouse drag and right stick.", m.value("invert_y")),
  ];
}

function controls(m: SettingsMenu): HTMLElement[] {
  return [
    m.rows.segmented(
      "Keyboard steering",
      "Classic: quick to full turn, snaps back. Hold: the wheel stays and centres as you roll. Smooth: a tap nudges, holding builds the turn.",
      m.value("steer_mode"),
      Object.values(SteerMode).map((mode) => [mode, STEER_LABEL[mode]] as const),
    ),
    m.rows.toggle("Precision steer key", "Hold X for half the keyboard steering.", m.value("precision_key")),
    touch_only(
      m.rows.segmented("Touch steering", "Drag anywhere to steer, or arrow buttons that steer like the keyboard.", m.value("touch_steer"), [
        [TouchSteer.DRAG, "Drag"],
        [TouchSteer.BUTTONS, "Buttons"],
      ]),
    ),
    m.rows.link("All keys and buttons", "Every key, pad button and touch control. H opens this list while driving.", "Keyboard, pad, touch", () => m.show_sub("keys")),
  ];
}

function audio(m: SettingsMenu): HTMLElement[] {
  const volume = m.value("volume");
  return [
    m.rows.slider(
      "Master volume",
      "Engine, tyres, wind and the menu.",
      { get: () => volume.get() * 100, set: (value) => volume.set(value / 100) },
      5,
      () => !m.state().muted,
    ),
    m.rows.toggle("Mute", "Silences everything; the volume stays where it is.", m.value("muted")),
  ];
}

function key_list(m: SettingsMenu): HTMLElement[] {
  const table = el("table", "settings-keys");
  const head = el("tr");
  head.append(el("th"), el("th", "", "Keyboard"), el("th", "settings-col-pad", "Gamepad"), el("th", "settings-col-touch", "Touch"));
  table.append(el("thead"), el("tbody"));
  table.tHead?.append(head);
  for (const [what, ...ways] of KEYS) {
    const tr = el("tr");
    tr.append(el("th", "", what));
    const [keyboard, pad, touch] = ways;
    const keys = el("td");
    if (keyboard) keys.append(el("kbd", "", keyboard));
    const buttons = el("td", "settings-col-pad");
    for (const part of pad ? pad.split(PAD_SEPARATOR) : []) buttons.append(PAD_SEPARATOR.test(part) ? part : el("kbd", part.length === 1 ? "pad-glyph pad-face" : "pad-glyph", part));
    tr.append(keys, buttons);
    tr.append(el("td", "settings-touch settings-col-touch", touch));
    table.tBodies[0].append(tr);
  }
  m.sync(() => table.toggleAttribute("data-pad", navigator.getGamepads().some((pad) => pad?.connected)));
  // Focusable so the pad can scroll a list taller than a phone screen.
  const wrap = el("div", "settings-keys-wrap");
  wrap.tabIndex = 0;
  wrap.append(table);
  return [wrap];
}

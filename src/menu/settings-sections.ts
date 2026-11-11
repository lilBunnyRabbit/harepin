import { SteerMode } from "../car/car";
import { keys_text, pad_text, type Bindable, type Bindings } from "../hud/bindings";
import { RumbleLevel } from "../hud/rumble";
import { binding_rows } from "./binding-rows";
import { pad_advanced } from "./settings-pad";
import { el, icon, type Options, type Text } from "./setting-rows";
import { THEMES, choose_theme, current_theme, find_saved, find_theme, load_saved_themes } from "../theme/theme";
import type { SettingsMenu } from "./page";
import { CameraReturn, CameraView, DashPlace, SpeedZoom, HudLayout, MapView, QualityMode, SteerSensitivity, TouchSteer, type QualityTier } from "./prefs";
import { BASE_TOKENS, saved_themes, theme_create } from "./theme-pages";
import { stat } from "./widgets";
import { AidPreset, preset_aids, preset_of, type Aids } from "./guide-rules";
import { country_name, flag, own_country } from "../net/country";

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
  help: Text;
  rows: () => HTMLElement[];
}

const CAMERA_RETURN_LABEL: Record<CameraReturn, string> = { off: "Off", short: "1.5 s", long: "3 s", never: "Never" };
const SPEED_ZOOM_LABEL: Record<SpeedZoom, string> = { off: "Off", subtle: "Subtle", strong: "Strong" };
const RUMBLE_LABEL: Record<RumbleLevel, string> = { off: "Off", subtle: "Subtle", strong: "Strong" };
const STEER_LABEL: Record<SteerMode, string> = { snap: "Classic", hold: "Hold", smooth: "Smooth" };
const MAP_VIEWS: Record<MapView, [string, string]> = {
  full: ["Full", "The whole track"],
  close: ["Close-up", "Turns with you and shows the next 200 m"],
  pace: ["Notes", "Rally pace notes instead of a map: the next turn, 1 tightest to 6 fastest, and how far off it is"],
  off: ["Off", "No map"],
};

const TIER_LABEL: Record<QualityTier, string> = { high: "High", medium: "Medium", low: "Low" };
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

const KEYS: [string, Shown, Shown, string][] = [
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

const list_help = (m: SettingsMenu): Text => () => {
  const key = keys_text(m.state().bindings.help);
  return `Every key, pad button and touch control.${key ? ` ${key} opens this list while driving.` : ""}`;
};

const while_driving = (m: SettingsMenu, action: Bindable, help: string): Text => () => {
  const key = keys_text(m.state().bindings[action]);
  return key ? `${help} ${key} switches it while driving.` : help;
};

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
      summary: () => `${(["tcs", "abs", "assist", "stability"] as const).filter((aid) => m.state()[aid]).length} of 4 aids · ${m.state().auto ? "auto" : "manual"} gears`,
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
    {
      id: "net",
      label: "Online",
      icon: "icon-globe",
      summary: () => (m.state().show_country ? "Country shown" : "Country hidden"),
      rows: () => online(m),
    },
  ];
  const deep: DeepPage[] = [
    { id: "creator", label: "Make your own theme", parent: "display", help: "Roll colours, keep the ones you like, then name and save it.", rows: () => theme_create(m) },
    { id: "themes", label: "Your themes", parent: "display", help: "Themes you made. Pick one with Theme on Display.", rows: () => saved_themes(m) },
    { id: "keys", label: "All keys and buttons", parent: "controls", help: list_help(m), rows: () => key_list(m) },
    { id: "bindings", label: "Change keys and buttons", parent: "controls", help: "Pick an action, then press its new key or pad button. Taking one from another action leaves it the rest.", rows: () => binding_rows(m) },
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
  const map = m.state().map;
  const frame = el("span", "hud-wire");
  frame.setAttribute("aria-hidden", "true");
  for (const [part, x, y, w, tall] of layout.wire) {
    if (part === "map" && map === MapView.OFF) continue;
    const h = part === "map" && map === MapView.PACE ? tall / 2 : tall;
    const box = el("span", `hud-wire-${part}`);
    box.style.inset = `${y}% ${100 - x - w}% ${100 - y - h}% ${x}%`;
    if (h !== tall) box.style.borderRadius = "var(--radius-xs)";
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
    m.rows.segmented(
      "Map",
      () => `${MAP_VIEWS[m.state().map][1]}.`,
      m.value("map"),
      Object.values(MapView).map((view) => [view, MAP_VIEWS[view][0]] as const),
      () => hud_wire(m),
    ),
    theme,
    m.rows.link("Make your own theme", "Roll colours, keep the ones you like, then name and save it.", "Roll, adjust, save", () => m.show_sub("creator")),
    mine,
  ];
}

const AID_PRESETS: Options<AidPreset | null> = [
  [AidPreset.EASY, "Easy"],
  [AidPreset.BALANCED, "Balanced"],
  [AidPreset.PRO, "Pro"],
];

function aid_preset(m: SettingsMenu): HTMLElement {
  const touch = () => matchMedia("(pointer: coarse)").matches;
  return m.rows.segmented(
    "Preset",
    "Sets the five aids below in one go. Easy looks after grip, brakes and slides. Balanced keeps traction and ABS, so a sharp turn at speed slides. Pro turns everything off (on touch the gearbox stays automatic). Change any toggle for your own mix.",
    {
      get: () => preset_of(m.state(), touch()),
      set: (preset) => {
        if (!preset) return;
        const aids = preset_aids(preset, touch());
        for (const key of Object.keys(aids) as (keyof Aids)[]) m.set(key, aids[key]);
      },
    },
    AID_PRESETS,
  );
}

function driving(m: SettingsMenu): HTMLElement[] {
  return [
    aid_preset(m),
    m.rows.toggle("Traction control", while_driving(m, "tcs", "Cuts power when the rear wheels spin."), m.value("tcs")),
    m.rows.toggle("Anti-lock brakes", while_driving(m, "abs", "Keeps steering under hard braking."), m.value("abs")),
    m.rows.toggle("Steering assist", while_driving(m, "assist", "Counter-steers a slide for you. Off, catching a slide is up to you."), m.value("assist")),
    m.rows.toggle("Stability", while_driving(m, "stability", "Damps a slide before it swings into a spin. Off, a slide can carry the car round."), m.value("stability")),
    m.rows.toggle("Automatic gearbox", while_driving(m, "auto", "Shifts for you."), m.value("auto")),
    m.rows.toggle("Ghost car", while_driving(m, "ghost", "Your best lap drives beside you."), m.value("ghost")),
  ];
}

function camera(m: SettingsMenu): HTMLElement[] {
  return [
    m.rows.segmented("View", while_driving(m, "camera", "Behind the car or from the driver's seat."), m.value("camera"), [
      [CameraView.CHASE, "Chase"],
      [CameraView.COCKPIT, "Cockpit"],
    ]),
    m.rows.segmented(
      "Returns after",
      "After a mouse look, the camera swings back behind the car once it drives.",
      m.value("camera_return"),
      Object.values(CameraReturn).map((value) => [value, CAMERA_RETURN_LABEL[value]] as const),
    ),
    m.rows.segmented(
      "Speed zoom",
      "How much the view widens and backs off as you go faster.",
      m.value("speed_zoom"),
      Object.values(SpeedZoom).map((value) => [value, SPEED_ZOOM_LABEL[value]] as const),
    ),
    m.rows.toggle("Camera tilt", "The chase view dips under braking and lifts as you accelerate. It never leans.", m.value("camera_tilt")),
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
    m.rows.toggle("Precision steer key", () => `Hold ${keys_text(m.state().bindings.precision) || "the precision key"} for half the keyboard steering.`, m.value("precision_key")),
    touch_only(
      m.rows.segmented("Touch steering", "Drag anywhere to steer, or arrow buttons that steer like the keyboard.", m.value("touch_steer"), [
        [TouchSteer.DRAG, "Drag"],
        [TouchSteer.BUTTONS, "Buttons"],
      ]),
    ),
    touch_only(
      m.rows.segmented("Steering sensitivity", "Drag steering: how far you drag for full lock. Lower needs a longer drag and steers finer.", m.value("steer_sensitivity"), [
        [SteerSensitivity.LOW, "Low"],
        [SteerSensitivity.MEDIUM, "Medium"],
        [SteerSensitivity.HIGH, "High"],
        [SteerSensitivity.VERY_HIGH, "Very high"],
      ]),
    ),
    m.rows.segmented(
      "Controller rumble",
      "Gamepad vibration as the tyres slide, on rough ground and kerbs, and from landings and hits.",
      m.value("rumble"),
      Object.values(RumbleLevel).map((level) => [level, RUMBLE_LABEL[level]] as const),
    ),
    ...pad_advanced(m),
    m.rows.link("Change keys and buttons", "Pick an action, then press its new key or pad button.", "Keyboard and pad", () => m.show_sub("bindings")),
    m.rows.link("All keys and buttons", list_help(m), "Keyboard, pad, touch", () => m.show_sub("keys")),
  ];
}

function audio(m: SettingsMenu): HTMLElement[] {
  const volume = m.value("volume");
  return [
    m.rows.slider(
      "Master volume",
      "Engine, tyres, wind and the menu.",
      { get: () => volume.get() * 100, set: (value) => volume.set(value / 100) },
      { step: 5, enabled: () => !m.state().muted },
    ),
    m.rows.toggle("Mute", "Silences everything; the volume stays where it is.", m.value("muted")),
  ];
}

function online(m: SettingsMenu): HTMLElement[] {
  const country = own_country();
  const hint = country === null ? "Your time zone matches no country, so nothing is shown." : `Players online see ${flag(country)} ${country_name(country)}, from your time zone.`;
  return [m.rows.toggle("Show my country", hint, m.value("show_country"))];
}

function key_list(m: SettingsMenu): HTMLElement[] {
  const table = el("table", "settings-keys");
  const head = el("tr");
  head.append(el("th"), el("th", "", "Keyboard"), el("th", "settings-col-pad", "Gamepad"), el("th", "settings-col-touch", "Touch"));
  table.append(el("thead"), el("tbody"));
  table.tHead?.append(head);
  for (const [what, keyboard, pad, touch] of KEYS) {
    const tr = el("tr");
    tr.append(el("th", "", what));
    const keys = el("td");
    const buttons = el("td", "settings-col-pad");
    tr.append(keys, buttons);
    tr.append(el("td", "settings-touch settings-col-touch", touch));
    table.tBodies[0].append(tr);
    let shown = "";
    m.sync(() => {
      const bindings = m.state().bindings;
      const [key_text, pad_shown] = [keyboard, pad].map((way) => (typeof way === "string" ? way : way(bindings)));
      if (`${key_text}|${pad_shown}` === shown) return;
      shown = `${key_text}|${pad_shown}`;
      keys.replaceChildren(...(key_text ? [el("kbd", "", key_text)] : []));
      buttons.replaceChildren(...(pad_shown ? pad_shown.split(PAD_SEPARATOR) : []).map((part) => (PAD_SEPARATOR.test(part) ? part : el("kbd", part.length === 1 ? "pad-glyph pad-face" : "pad-glyph", part))));
    });
  }
  m.sync(() => table.toggleAttribute("data-pad", navigator.getGamepads().some((pad) => pad?.connected)));
  // Focusable so the pad can scroll a list taller than a phone screen.
  const wrap = el("div", "settings-keys-wrap");
  wrap.tabIndex = 0;
  wrap.append(table);
  return [wrap];
}

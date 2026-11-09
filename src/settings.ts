import { SteerMode } from "./car";
import type { GarageSection } from "./garage";
import { typing } from "./input";
import { DirectoryStatus, PASSWORD_LENGTH, ROOM_LENGTH, clean_password, clean_room, locked_name, save_lock, type Server } from "./directory";
import { clean_name, parse_seed } from "./net";
import { HARMONIES as HARMONY_HUES, Harmony, generate_theme, is_dark, type ThemeMode } from "./random-theme";
import { mulberry32 } from "./rng";
import { WorldKind } from "./worldgen/types";
import {
  THEMES,
  THEME_NAME_LENGTH,
  TOKENS,
  choose_theme,
  current_theme,
  derive_theme,
  find_saved,
  find_theme,
  load_saved_themes,
  store_saved_themes,
  theme_name_problem,
  token_var,
  with_saved,
  without_saved,
  type SavedTheme,
  type ThemeBase,
} from "./theme";
import { TouchSteer } from "./touch";
import { WorldMap } from "./world-map";
import "./settings.css";
import "./menu.css";

export const SETTINGS_KEY = "harepin:settings";

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
  /** The world the player last picked in the menu; a bare URL drives it again. Never set by an invite or a join. */
  last_world: WorldKind | null;
  last_seed: number | null;
}
export type SettingKey = keyof SettingsState;

export const DEFAULT_SETTINGS: SettingsState = {
  quality: QualityMode.AUTO,
  name: null,
  laps: 3,
  tcs: true,
  abs: true,
  assist: true,
  auto: true,
  steer_mode: SteerMode.SNAP,
  touch_steer: TouchSteer.DRAG,
  camera: CameraView.CHASE,
  camera_return: CameraReturn.SHORT,
  invert_y: false,
  ghost: true,
  volume: 0.8,
  muted: false,
  hud: HudLayout.CLASSIC,
  dash: DashPlace.RIGHT,
  last_world: null,
  last_seed: null,
};

const one_of = <T extends string | number>(values: readonly T[], raw: unknown, fallback: T): T => (values.includes(raw as T) ? (raw as T) : fallback);
const bool = (raw: unknown, fallback: boolean) => (typeof raw === "boolean" ? raw : fallback);

export function parse_settings(raw: unknown): SettingsState {
  const d = DEFAULT_SETTINGS;
  if (typeof raw !== "object" || raw === null) return { ...d };
  const s = raw as Record<string, unknown>;
  const volume = typeof s.volume === "number" && Number.isFinite(s.volume) ? Math.min(1, Math.max(0, s.volume)) : d.volume;
  return {
    quality: one_of(Object.values(QualityMode), s.quality, d.quality),
    name: typeof s.name === "string" && s.name.trim() ? clean_name(s.name) : null,
    laps: one_of(LAPS, s.laps, d.laps),
    tcs: bool(s.tcs, d.tcs),
    abs: bool(s.abs, d.abs),
    assist: bool(s.assist, d.assist),
    auto: bool(s.auto, d.auto),
    steer_mode: one_of(Object.values(SteerMode), s.steer_mode, d.steer_mode),
    touch_steer: one_of(Object.values(TouchSteer), s.touch_steer, d.touch_steer),
    camera: one_of(Object.values(CameraView), s.camera, d.camera),
    camera_return: one_of(Object.values(CameraReturn), s.camera_return, d.camera_return),
    invert_y: bool(s.invert_y, d.invert_y),
    ghost: bool(s.ghost, d.ghost),
    volume,
    muted: bool(s.muted, d.muted),
    hud: one_of(Object.values(HudLayout), s.hud, d.hud),
    dash: one_of(Object.values(DashPlace), s.dash, d.dash),
    last_world: s.last_world === WorldKind.ISLAND || s.last_world === WorldKind.SKY ? s.last_world : null,
    last_seed: typeof s.last_seed === "number" ? parse_seed(String(s.last_seed)) : null,
  };
}

function read_saved(): SettingsState {
  try {
    const text = localStorage.getItem(SETTINGS_KEY);
    return parse_settings(text === null ? null : JSON.parse(text));
  } catch (error) {
    console.warn("settings: saved settings unreadable", error);
    return { ...DEFAULT_SETTINGS };
  }
}

function write_saved(state: SettingsState) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("settings: not saved", error);
  }
}

/** URL params win for this load only; the saved copy keeps what the viewer chose. */
function with_overrides(saved: SettingsState, params: URLSearchParams): SettingsState {
  return parse_settings({
    ...saved,
    quality: params.get("quality") ?? saved.quality,
    name: params.get("name") ?? saved.name,
  });
}

export function save_setting<K extends SettingKey>(key: K, value: SettingsState[K]) {
  write_saved({ ...read_saved(), [key]: value });
}

// Picking a world reloads the page; this one-shot flag lets that load skip the menu and drive straight away.
const DRIVE_KEY = "harepin:drive";

/** True once after a menu pick reloaded the page. */
export function take_drive(): boolean {
  try {
    const set = sessionStorage.getItem(DRIVE_KEY) !== null;
    sessionStorage.removeItem(DRIVE_KEY);
    return set;
  } catch {
    return false;
  }
}

export function load_settings(params = new URLSearchParams(location.search)): SettingsState {
  return with_overrides(read_saved(), params);
}

export interface QualityStatus {
  tier: QualityTier;
  ratio: number;
  bloom: boolean;
  /** Sun shadow map size in px, 0 when off. */
  shadow_size: number;
}

export interface SettingsHost {
  readonly room: string;
  readonly seed: number;
  readonly kind: WorldKind;
  name(): string;
  quality_status(): QualityStatus;
  race_busy(): boolean;
  toggle_race(laps: Laps): void;
  readonly version: string;
  show_changelog(): void;
  servers(): Server[];
  servers_status(): DirectoryStatus;
  /** This room's handshake failed on the password, so its row offers another try. */
  password_failed(): boolean;
  browse_servers(on: boolean): void;
  /** The car in the garage, for its menu tile. */
  car_name(): string;
  /** Closes the menu first; null keeps the garage on the section it was last on. */
  open_garage(section: GarageSection | null): void;
  /** The modes level list, the popover the Modes tile opens. */
  readonly modes: HTMLElement;
  players(): number;
  restart_lap(): void;
}

interface Section {
  id: string;
  label: string;
  build: () => HTMLElement[];
}

interface SheetSection extends Section {
  icon: string;
}

export const MenuTab = {
  PLAY: "play",
  GARAGE: "garage",
  ONLINE: "online",
  SETTINGS: "settings",
} as const;
export type MenuTab = (typeof MenuTab)[keyof typeof MenuTab];

const MENU_TABS: [MenuTab, string][] = [
  [MenuTab.PLAY, "Play"],
  [MenuTab.GARAGE, "Garage"],
  [MenuTab.ONLINE, "Online"],
  [MenuTab.SETTINGS, "Settings"],
];

const View = {
  MENU: "menu",
  PAGE: "page",
  SHEET: "sheet",
} as const;
type View = (typeof View)[keyof typeof View];

/** Full-screen pages under a menu tab, by title. */
const PAGE_TITLE: Record<string, string> = { world: "New map", room: "New room" };

/** Where Back goes from a page or a settings section. */
const PARENT: Record<string, MenuTab> = {
  world: MenuTab.PLAY,
  room: MenuTab.ONLINE,
  graphics: MenuTab.SETTINGS,
  controls: MenuTab.SETTINGS,
  display: MenuTab.SETTINGS,
  audio: MenuTab.SETTINGS,
};

const WORLD_NAME: Record<WorldKind, string> = { island: "Island", sky: "Sky Track" };
const WORLD_NOTE: Record<WorldKind, string> = { island: "Towns, hills and every challenge", sky: "Drops, rails, jumps, boost pads" };
const HERO_NOTE: Record<WorldKind, string> = {
  island: "Free roam. Flags on the orange circuit start the challenges.",
  sky: "A toy circuit in the clouds: drops, rails, jumps and boost pads.",
};

type Text = string | (() => string);

const preview = (name: string) => `${import.meta.env.BASE_URL}menu/${name}.webp`;

function world_query(room: string, seed: number, kind: WorldKind): Record<string, string> {
  return { room, seed: String(seed), ...(kind === WorldKind.SKY ? { world: kind } : {}) };
}

const TIER_LABEL: Record<QualityTier, string> = { high: "High", medium: "Medium", low: "Low" };
const STATUS_MS = 1000;
const COPIED_MS = 2000;

const KEYS: [string, string, string, string][] = [
  ["Drive", "WASD / arrows", "RT / LT, L stick", "Gas, Brake, drag or arrow buttons to steer (Touch steering)"],
  ["Handbrake", "Space", "A", "Handbrake"],
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
];

const PAD_SEPARATOR = /(, | \/ )/;

const BASE_TOKENS: [keyof ThemeBase, string][] = [
  ["background", "Background"],
  ["foreground", "Text"],
  ["primary", "Main"],
  ["secondary", "Second"],
  ["accent", "Accent"],
];

const THEME_MODES: [ThemeMode, string][] = [
  ["dark", "Dark"],
  ["light", "Light"],
  ["any", "Either"],
];

const HARMONY_CHOICES: [Harmony | "any", string][] = [
  ["any", "Surprise me"],
  [Harmony.ANALOGOUS, "Matching"],
  [Harmony.COMPLEMENTARY, "Contrasting"],
  [Harmony.TRIADIC, "Three colours"],
  [Harmony.SPLIT, "Split"],
];

const THEME_STEPS = ["Roll", "Adjust", "Name and save"];

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

function el<K extends keyof HTMLElementTagNameMap>(tag: K, class_name = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (class_name) node.className = class_name;
  if (text) node.textContent = text;
  return node;
}

function icon(id: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${id}`);
  svg.append(use);
  return svg;
}

function random_code() {
  return Math.random().toString(36).slice(2, 8);
}

function random_seed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

export function invite_link(room: string, seed: number, kind: WorldKind = WorldKind.ISLAND): string {
  return `${location.origin}${location.pathname}?room=${encodeURIComponent(room)}&seed=${seed}${kind === WorldKind.SKY ? `&world=${kind}` : ""}`;
}

const DIRECTORY_NOTE: Record<DirectoryStatus, string> = {
  connecting: "Looking for other games…",
  online: "Games running right now",
  offline: "No other games found. Invite links still work.",
};

export class Settings {
  on_change: ((state: SettingsState, key: SettingKey) => void) | null = null;
  private readonly root = el("div", "settings");
  readonly panel = el("div", "settings-panel");
  private readonly body = el("div", "settings-body");
  private readonly sheet_tabs = new Map<string, HTMLButtonElement>();
  private readonly menu_tabs = new Map<string, HTMLButtonElement>();
  private readonly pages = new Map<string, HTMLElement>();
  private readonly syncs: (() => void)[] = [];
  private readonly title = el("h2", "settings-title", "Settings");
  private readonly name_input = el("input");
  private saved: SettingsState;
  private timer = 0;
  private section: string = MenuTab.PLAY;
  private keys: HTMLElement | null = null;
  private readonly world_map = new WorldMap();
  private chosen: number;
  private chosen_kind: WorldKind;

  constructor(
    private readonly parent: HTMLElement,
    private readonly host: SettingsHost,
    private current: SettingsState,
  ) {
    this.saved = read_saved();
    this.chosen = host.seed;
    this.chosen_kind = host.kind;
    this.root.hidden = true;
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.setAttribute("aria-label", "Menu");
    this.panel.tabIndex = -1;
    this.build();
    this.root.append(this.panel);
  }

  get state(): SettingsState {
    return this.current;
  }

  get is_open(): boolean {
    return !this.root.hidden;
  }

  /** The menu, on Play unless a section is named. */
  open(section: string = MenuTab.PLAY) {
    if (this.pages.has(section)) this.section = section;
    if (this.is_open) return this.show(this.section);
    if (!this.root.isConnected) this.parent.append(this.root);
    this.root.hidden = false;
    this.root.addEventListener("click", this.click);
    addEventListener("keydown", this.key);
    this.timer = window.setInterval(() => this.refresh(), STATUS_MS);
    this.refresh();
    this.show(this.section);
    this.panel.focus();
  }

  /** Controls, scrolled to the key list: the help key lands here. */
  open_keys() {
    this.open("controls");
    this.keys?.scrollIntoView({ block: "end" });
  }

  close() {
    if (!this.is_open) return;
    this.root.hidden = true;
    this.root.removeEventListener("click", this.click);
    removeEventListener("keydown", this.key);
    clearInterval(this.timer);
    this.world_map.stop();
    this.host.browse_servers(false);
  }

  toggle() {
    if (this.is_open) this.close();
    else this.open();
  }

  focus_name() {
    this.name_input.focus();
  }

  /** The open tab's page. */
  page(): HTMLElement {
    return this.pages.get(this.section) ?? this.body;
  }

  /** One level up: a page or a settings section returns to its tab, a tab closes the menu. */
  back() {
    const parent = PARENT[this.section];
    if (parent) this.show(parent);
    else this.close();
  }

  step_section(step: number) {
    const view = view_of(this.section);
    if (view === View.PAGE) return;
    const ids = [...(view === View.MENU ? this.menu_tabs : this.sheet_tabs).keys()];
    this.show(ids[(ids.indexOf(this.section) + step + ids.length) % ids.length]);
  }

  set<K extends SettingKey>(key: K, value: SettingsState[K]) {
    if (this.current[key] === value) return;
    this.current = { ...this.current, [key]: value };
    this.saved = { ...this.saved, [key]: value };
    write_saved(this.saved);
    this.refresh();
    this.on_change?.(this.current, key);
  }

  private reload(param: string) {
    const params = new URLSearchParams(location.search);
    params.delete(param);
    const search = params.toString();
    location.replace(`${location.pathname}${search ? `?${search}` : ""}${location.hash}`);
  }

  private build() {
    const top = el("div", "menu-top");
    const brand = el("span", "menu-brand");
    brand.append(icon("logo-mark"), el("span", "", "Harepin"));
    const name_chip = el("label", "menu-chip menu-name");
    name_chip.title = "Your name: everyone in the room sees it";
    name_chip.append(this.name_field(), icon("icon-edit"));
    const room = el("span", "menu-chip menu-room");
    const here = el("small");
    room.append(el("span", "menu-live"), el("span", "", `Room ${this.host.room}`), here);
    this.syncs.push(() => (here.textContent = `· ${this.host.players()} here`));
    const leave = el("button", "menu-close");
    leave.type = "button";
    leave.dataset.action = "close";
    leave.setAttribute("aria-label", "Back to driving");
    leave.title = "Back to driving (Esc)";
    leave.append(icon("icon-close"));
    top.append(brand, name_chip, room, leave);

    const menu_nav = el("nav", "menu-tabs");
    menu_nav.setAttribute("aria-label", "Menu");
    for (const [id, label] of MENU_TABS) {
      const tab = el("button", "menu-tab", label);
      tab.type = "button";
      tab.dataset.section = id;
      menu_nav.append(tab);
      this.menu_tabs.set(id, tab);
    }

    const head = el("div", "settings-head");
    this.title.id = "settings-title";
    const back = el("button", "settings-back");
    back.type = "button";
    back.dataset.action = "back";
    back.title = "Back (Esc)";
    back.append(icon("icon-back"), el("span", "", "Back"));
    const close = el("button", "settings-close");
    close.type = "button";
    close.dataset.action = "close";
    close.setAttribute("aria-label", "Back to driving");
    close.title = "Back to driving";
    close.append(icon("icon-close"));
    const random = el("button", "settings-random");
    random.type = "button";
    random.dataset.action = "random";
    random.title = "Drive a random map of this world";
    random.append(icon("icon-dice"), el("span", "", "Random"));
    head.append(back, this.title, random, close);

    const pages: Section[] = [
      { id: MenuTab.PLAY, label: "Play", build: () => this.play() },
      { id: MenuTab.GARAGE, label: "Garage", build: () => this.garage() },
      { id: MenuTab.ONLINE, label: "Online", build: () => this.online() },
      { id: MenuTab.SETTINGS, label: "Settings", build: () => this.settings_tiles() },
      { id: "world", label: PAGE_TITLE.world, build: () => this.world() },
      { id: "room", label: PAGE_TITLE.room, build: () => this.create_room() },
    ];
    const sheet: SheetSection[] = [
      { id: "graphics", label: "Graphics", icon: "icon-graphics", build: () => this.graphics() },
      { id: "controls", label: "Controls", icon: "icon-controls", build: () => this.controls() },
      { id: "display", label: "Display", icon: "icon-display", build: () => [...this.hud_layout(), ...this.display()] },
      { id: "audio", label: "Audio", icon: "icon-audio", build: () => this.audio() },
    ];

    const nav = el("nav", "settings-tabs");
    nav.setAttribute("aria-label", "Settings sections");
    for (const section of sheet) {
      const tab = el("button", "settings-tab");
      tab.type = "button";
      tab.dataset.section = section.id;
      tab.append(icon(section.icon), el("span", "", section.label));
      nav.append(tab);
      this.sheet_tabs.set(section.id, tab);
    }
    for (const section of [...pages, ...sheet]) {
      const page = el("section", "settings-page");
      page.dataset.section = section.id;
      page.setAttribute("aria-label", section.label);
      page.append(...section.build());
      this.body.append(page);
      this.pages.set(section.id, page);
    }
    const foot = el("div", "settings-foot");
    const changes = el("button", "settings-link", "What's new");
    changes.type = "button";
    changes.addEventListener("click", () => this.host.show_changelog());
    foot.append(el("span", "", `Version v${this.host.version}`), changes);
    this.panel.append(top, menu_nav, head, nav, this.body, foot);
  }

  private name_field(): HTMLInputElement {
    const name = this.name_input;
    name.type = "text";
    name.maxLength = 24;
    name.autocomplete = "off";
    name.enterKeyHint = "done";
    name.setAttribute("aria-label", "Your name");
    const commit = () => {
      const next = name.value.trim() ? clean_name(name.value) : null;
      name.value = next ?? "";
      this.set("name", next);
    };
    name.addEventListener("change", commit);
    name.addEventListener("keydown", (event) => {
      if (event.key === "Enter") name.blur();
    });
    this.syncs.push(() => {
      if (document.activeElement !== name) name.value = this.current.name ?? "";
      name.placeholder = this.host.name();
    });
    return name;
  }

  private show(section: string) {
    this.section = section;
    this.root.dataset.view = view_of(section);
    this.root.dataset.section = section;
    for (const [id, tab] of this.sheet_tabs) tab.setAttribute("aria-current", String(id === section));
    for (const [id, tab] of this.menu_tabs) tab.setAttribute("aria-current", String(id === section));
    for (const [id, page] of this.pages) page.hidden = id !== section;
    this.title.textContent = PAGE_TITLE[section] ?? "Settings";
    this.body.scrollTop = 0;
    if (section === "world") this.world_map.show(this.chosen, this.chosen_kind, true);
    else this.world_map.stop();
    this.host.browse_servers(section === MenuTab.ONLINE);
    this.refresh();
  }

  private bind(node: HTMLElement, text: Text) {
    if (typeof text === "string") node.textContent = text;
    else this.syncs.push(() => (node.textContent = text()));
  }

  /** Picture or icon behind, title and a line over a scrim at the bottom. */
  private dress(tile: HTMLElement, title: Text, note: Text, art: Node | null, eyebrow = ""): HTMLElement {
    if (art) {
      const wrap = el("span", "menu-art");
      wrap.append(art);
      tile.append(wrap);
    }
    const text = el("span", "menu-text");
    if (eyebrow) text.append(el("span", "menu-eyebrow", eyebrow));
    const name = el("b");
    const line = el("span");
    this.bind(name, title);
    this.bind(line, note);
    text.append(name, line);
    tile.append(text);
    return text;
  }

  private tile(area: string, title: Text, note: Text, art: Node | null, run: () => void): HTMLButtonElement {
    const tile = el("button", "menu-tile");
    tile.type = "button";
    tile.dataset.area = area;
    this.dress(tile, title, note, art);
    tile.addEventListener("click", run);
    return tile;
  }

  private picture(name: string, contain = false): HTMLImageElement {
    const img = el("img");
    img.src = preview(name);
    img.alt = "";
    img.decoding = "async";
    if (contain) img.dataset.fit = "contain";
    return img;
  }

  private mosaic(tab: MenuTab, ...tiles: HTMLElement[]): HTMLElement[] {
    const grid = el("div", "menu-mosaic");
    grid.dataset.tab = tab;
    grid.append(...tiles);
    return [grid];
  }

  private play(): HTMLElement[] {
    const { room, seed, kind } = this.host;
    const hero = el("div", "menu-tile");
    hero.dataset.area = "hero";
    const text = this.dress(hero, `${WORLD_NAME[kind]} ${seed}`, HERO_NOTE[kind], this.picture(kind), "Keep driving");
    text.append(el("span", "menu-go", "Drive"));
    const drive = el("button", "menu-hit");
    drive.type = "button";
    drive.dataset.action = "close";
    drive.setAttribute("aria-label", `Keep driving ${WORLD_NAME[kind]} ${seed}`);
    const restart = el("button", "menu-corner");
    restart.type = "button";
    restart.append(icon("icon-restart"), el("span", "", "Restart lap"));
    restart.addEventListener("click", () => {
      this.close();
      this.host.restart_lap();
    });
    hero.append(drive, restart);

    const world = (other: WorldKind) => {
      const tile = this.tile(other, WORLD_NAME[other], WORLD_NOTE[other], this.picture(other), () => this.drive(seed, other));
      tile.title = other === kind ? "Keep driving here" : `Reloads room ${room} on ${WORLD_NAME[other]} ${seed}`;
      if (other === kind) tile.append(el("span", "menu-tag", "You're here"));
      return tile;
    };
    const map = this.tile("map", "New map", "Preview a map, roll the dice or type a seed", this.picture(`${kind}-map`, true), () => this.show("world"));
    const modes = this.tile("modes", "Modes", "Gymkhana, parking, drift zones, gate hunt, ghost duel", icon("icon-modes"), () => this.close());
    modes.popoverTargetElement = this.host.modes;
    return this.mosaic(MenuTab.PLAY, hero, world(WorldKind.ISLAND), world(WorldKind.SKY), map, modes);
  }

  private garage(): HTMLElement[] {
    const car = el("div", "menu-tile");
    car.dataset.area = "car";
    const text = this.dress(car, () => this.host.car_name(), "Change car, fit parts, paint it", this.picture("garage"), "Your car");
    text.append(el("span", "menu-go", "Open garage"));
    const open = el("button", "menu-hit");
    open.type = "button";
    open.setAttribute("aria-label", "Open the garage");
    open.addEventListener("click", () => this.host.open_garage(null));
    car.append(open);
    return this.mosaic(
      MenuTab.GARAGE,
      car,
      this.tile("body", "Body", "Car, wing, decal, number", icon("icon-car"), () => this.host.open_garage("body")),
      this.tile("perf", "Performance", "Engine, tyres, brakes, nitro", icon("icon-gauge"), () => this.host.open_garage("performance")),
      this.tile("paint", "Paint", "Colour and decal ink", icon("icon-paint"), () => this.host.open_garage("paint")),
    );
  }

  private info(area: string, eyebrow: string, ...content: HTMLElement[]): HTMLElement {
    const tile = el("div", "menu-tile menu-info");
    tile.dataset.area = area;
    tile.append(el("span", "menu-eyebrow", eyebrow), ...content);
    return tile;
  }

  private online(): HTMLElement[] {
    const { room, seed, kind } = this.host;
    const players = el("span", "menu-caption");
    this.syncs.push(() => (players.textContent = `${this.host.players()} here · ${WORLD_NAME[kind]} ${seed}`));
    const invite = el("div", "settings-inline");
    invite.append(this.copy_action("Copy invite link", invite_link(room, seed, kind)));
    const room_tile = this.info("room", "Your room", el("b", "menu-code", room), players, invite, el("small", "menu-caption", "Friends who open the link join this room on this map"));

    const scroll = el("div", "menu-scroll");
    scroll.append(...this.games());
    const games = this.info("games", "Games running", scroll);

    const race = el("button", "settings-action", "Start race");
    race.type = "button";
    race.addEventListener("click", () => {
      this.host.toggle_race(this.current.laps);
      this.refresh();
    });
    this.syncs.push(() => (race.textContent = this.host.race_busy() ? "Leave race" : "Start race"));
    const laps = this.choice(
      "laps",
      LAPS.map((laps) => [laps, String(laps)] as const),
      "Laps",
    );
    const race_tile = this.info("race", "Lobby race", laps, race, el("small", "menu-caption", "Everyone in the room starts together"));

    const fresh = this.tile("new", "New room", "A fresh code, a map, an optional password", icon("icon-dice"), () => this.show("room"));
    return this.mosaic(MenuTab.ONLINE, room_tile, games, race_tile, fresh);
  }

  private settings_tiles(): HTMLElement[] {
    const hud = (value: HudLayout) => HUD_LAYOUTS.find((layout) => layout.value === value)?.name ?? value;
    const quality = () => {
      const tier = TIER_LABEL[this.host.quality_status().tier];
      return this.current.quality === QualityMode.AUTO ? `Auto, running ${tier}` : `Fixed at ${tier}`;
    };
    const aids = () => {
      const on = (["tcs", "abs", "assist"] as const).filter((aid) => this.current[aid]).length;
      return `${on} of 3 aids on · ${this.current.auto ? "auto" : "manual"} gears · key list`;
    };
    const sound = () => (this.current.muted ? "Muted" : `Volume ${Math.round(this.current.volume * 100)}%`);
    return this.mosaic(
      MenuTab.SETTINGS,
      this.tile("graphics", "Graphics", quality, icon("icon-graphics"), () => this.show("graphics")),
      this.tile("display", "Display", () => `HUD ${hud(this.current.hud)} · ${current_theme()}`, icon("icon-display"), () => this.show("display")),
      this.tile("controls", "Controls", aids, icon("icon-controls"), () => this.show("controls")),
      this.tile("audio", "Audio", sound, icon("icon-audio"), () => this.show("audio")),
    );
  }

  private row(label: string, control: HTMLElement, hint = "", inline = false): HTMLElement {
    const row = el("div", inline ? "settings-row settings-row-inline" : "settings-row");
    const text = el("div", "settings-label");
    text.append(el("span", "", label));
    if (hint) text.append(el("small", "", hint));
    row.append(text, control);
    return row;
  }

  private choice<K extends SettingKey>(key: K, options: readonly (readonly [SettingsState[K], string])[], label: string, hint = ""): HTMLElement {
    const group = el("div", "settings-choice");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", label);
    const buttons = options.map(([value, text]) => {
      const button = el("button", "", text);
      button.type = "button";
      button.setAttribute("role", "radio");
      button.addEventListener("click", () => this.set(key, value));
      group.append(button);
      return [value, button] as const;
    });
    this.syncs.push(() => {
      for (const [value, button] of buttons) button.setAttribute("aria-checked", String(this.current[key] === value));
    });
    return this.row(label, group, hint);
  }

  private hud_layout(): HTMLElement[] {
    const group = el("div", "hud-layouts");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "HUD layout");
    const buttons = HUD_LAYOUTS.map(({ value, name, note, wire }) => {
      const button = el("button", "hud-layout");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.dataset.layout = value;
      const frame = el("span", "hud-wire");
      frame.setAttribute("aria-hidden", "true");
      for (const [part, x, y, w, h] of wire) {
        const box = el("span", `hud-wire-${part}`);
        box.style.inset = `${y}% ${100 - x - w}% ${100 - y - h}% ${x}%`;
        frame.append(box);
      }
      const text = el("span", "hud-layout-text");
      text.append(el("b", "", name), el("small", "", note));
      button.append(frame, text);
      button.addEventListener("click", () => this.set("hud", value));
      group.append(button);
      return [value, button] as const;
    });
    this.syncs.push(() => {
      for (const [value, button] of buttons) button.setAttribute("aria-checked", String(this.current.hud === value));
    });
    const dash = this.choice(
      "dash",
      [
        [DashPlace.RIGHT, "Right"],
        [DashPlace.CENTER, "Centre"],
      ],
      "Dash",
      "Speed, gear and aids. Racing always centres it, Compact keeps it up top",
    );
    return [this.row("HUD layout", group, "Where speed, laps, map and buttons sit"), dash];
  }

  private toggle_row(key: "tcs" | "abs" | "assist" | "auto" | "invert_y" | "ghost" | "muted", label: string, hint = ""): HTMLElement {
    const button = el("button", "settings-switch");
    button.type = "button";
    button.setAttribute("role", "switch");
    button.setAttribute("aria-label", label);
    button.append(el("span", "settings-knob"));
    button.addEventListener("click", () => this.set(key, !this.current[key]));
    this.syncs.push(() => button.setAttribute("aria-checked", String(this.current[key])));
    return this.row(label, button, hint, true);
  }

  private touch_only(row: HTMLElement): HTMLElement {
    row.classList.add("settings-touch-only");
    return row;
  }

  private action(label: string, run: (button: HTMLButtonElement) => void): HTMLButtonElement {
    const button = el("button", "settings-action", label);
    button.type = "button";
    button.addEventListener("click", () => run(button));
    return button;
  }

  private graphics(): HTMLElement[] {
    const status = el("div", "settings-status");
    this.syncs.push(() => {
      const s = this.host.quality_status();
      const lead = this.current.quality === QualityMode.AUTO ? `Auto is running ${TIER_LABEL[s.tier]}` : `Fixed at ${TIER_LABEL[s.tier]}`;
      status.replaceChildren(
        el("span", "", lead),
        this.stat("scale", `${s.ratio.toFixed(2)}x`),
        this.stat("shadows", s.shadow_size ? `${s.shadow_size}px` : "off"),
        this.stat("bloom", s.bloom ? "on" : "off"),
      );
    });
    return [
      this.choice(
        "quality",
        [
          [QualityMode.AUTO, "Auto"],
          [QualityMode.HIGH, "High"],
          [QualityMode.MEDIUM, "Medium"],
          [QualityMode.LOW, "Low"],
        ],
        "Quality",
        "Auto steps down when the frame rate drops",
      ),
      status,
    ];
  }

  private stat(label: string, value: string): HTMLElement {
    const node = el("span", "settings-stat");
    node.append(el("span", "", label), el("b", "", value));
    return node;
  }

  private copy_action(label: string, link: string): HTMLButtonElement {
    return this.action(label, async (button) => {
      try {
        await navigator.clipboard.writeText(link);
        button.textContent = "Copied";
      } catch (error) {
        console.warn("settings: clipboard refused", error);
        button.textContent = "Copy failed";
      }
      setTimeout(() => (button.textContent = label), COPIED_MS);
    });
  }

  private world(): HTMLElement[] {
    const { room, seed } = this.host;
    const field = el("input", "settings-input settings-number");
    field.type = "text";
    field.inputMode = "numeric";
    field.maxLength = 10;
    field.autocomplete = "off";
    field.enterKeyHint = "go";
    field.value = String(seed);
    field.setAttribute("aria-label", "Island seed");
    const dice = el("button", "world-dice");
    dice.type = "button";
    dice.title = "Random seed";
    dice.setAttribute("aria-label", "Random seed");
    dice.append(icon("icon-dice"));
    const seed_field = el("div", "world-seed-field");
    seed_field.append(field, dice);
    const seed_row = this.row("Seed", seed_field, "Same seed, same island, for everyone");
    seed_row.classList.add("world-seed");

    const drive = this.action("Drive this island", () => this.drive(this.chosen, this.chosen_kind));
    drive.classList.add("world-drive");
    const choose = (next: number, now: boolean) => {
      this.chosen = next;
      const name = this.chosen_kind === WorldKind.SKY ? "track" : "island";
      drive.textContent = `Drive this ${name}`;
      drive.disabled = next === seed && this.chosen_kind === this.host.kind;
      drive.title = drive.disabled ? `You're on this ${name}` : `Reloads room ${room} on ${name} ${next}`;
      this.world_map.show(next, this.chosen_kind, now);
      boost.hidden = this.chosen_kind !== WorldKind.SKY;
    };
    const kinds = el("div", "settings-choice");
    kinds.setAttribute("role", "radiogroup");
    kinds.setAttribute("aria-label", "World");
    const kind_buttons = ([[WorldKind.ISLAND, "Island"], [WorldKind.SKY, "Sky Track"]] as const).map(([kind, text]) => {
      const button = el("button", "", text);
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(kind === this.chosen_kind));
      button.addEventListener("click", () => {
        this.chosen_kind = kind;
        for (const [k, b] of kind_buttons) b.setAttribute("aria-checked", String(k === kind));
        choose(this.chosen, true);
      });
      kinds.append(button);
      return [kind, button] as const;
    });
    const kind_row = this.row("World", kinds, "An island to roam, or a toy circuit floating in the sky");
    field.addEventListener("input", () => {
      const next = parse_seed(field.value.trim());
      field.setCustomValidity(next === null ? "A whole number from 0 to 4294967295" : "");
      if (next === null) drive.disabled = true;
      else choose(next, false);
    });
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !drive.disabled) drive.click();
    });
    dice.addEventListener("click", () => {
      const next = random_seed();
      field.value = String(next);
      field.setCustomValidity("");
      choose(next, true);
    });
    drive.disabled = true;

    const legend = el("ul", "world-legend");
    for (const [label, token] of [
      ["Circuit", "accent"],
      ["Start", "primary"],
      ["Checkpoints", "foreground"],
      ["Jumps", "secondary"],
    ]) {
      const item = el("li", "", label);
      item.style.setProperty("--swatch", `var(--${token})`);
      legend.append(item);
    }
    const boost = el("li", "", "Boost");
    // The map's pad tone, tones.pad: the accent a step lighter, never mixed with another brand colour.
    boost.style.setProperty("--swatch", "oklch(from var(--accent) calc(l + 0.14) c h)");
    boost.hidden = this.chosen_kind !== WorldKind.SKY;
    legend.append(boost);

    const current = el("div", "settings-inline");
    current.append(el("b", "settings-value settings-number", String(seed)), this.copy_action("Copy link", invite_link(room, seed, this.host.kind)));
    const current_row = this.row("This island", current, `Room ${room} is driving it`);
    current_row.classList.add("world-current");

    const world = el("div", "world");
    world.append(kind_row, seed_row, this.world_map.root, legend, drive, current_row);
    return [world];
  }

  /** A world the player picked: remembered for the next bare load, then driven in this room. */
  private drive(seed: number, kind: WorldKind) {
    this.set("last_world", kind);
    this.set("last_seed", seed);
    if (seed === this.host.seed && kind === this.host.kind) return this.close();
    this.go(world_query(this.host.room, seed, kind));
  }

  private go(query: Record<string, string>) {
    try {
      sessionStorage.setItem(DRIVE_KEY, "1");
    } catch {}
    location.search = `?${new URLSearchParams(query)}`;
  }

  private join(server: Server, password: string | null) {
    save_lock(server.room, password === null ? null : { password, asked: true });
    this.go({ room: server.room, seed: String(server.seed) });
  }

  private games(): HTMLElement[] {
    const note = el("p", "servers-note");
    const list = el("ol", "servers-list");
    let list_key = "";

    const unlock = el("form", "servers-unlock");
    unlock.hidden = true;
    const unlock_label = el("span", "servers-unlock-label");
    const secret = this.password_input("Room password");
    const unlock_join = el("button", "settings-action", "Join");
    unlock_join.type = "submit";
    const unlock_cancel = this.action("Cancel", () => (unlock.hidden = true));
    const unlock_row = el("div", "settings-inline");
    unlock_row.append(secret, unlock_join, unlock_cancel);
    unlock.append(unlock_label, unlock_row);
    let locked: Server | null = null;
    unlock.addEventListener("submit", (event) => {
      event.preventDefault();
      const password = clean_password(secret.value);
      if (!locked || password === null) return this.invalid(secret, "Enter the room password");
      this.join(locked, password);
    });
    const ask = (server: Server) => {
      locked = server;
      unlock_label.textContent = `Password for ${server.room}`;
      secret.value = "";
      unlock.hidden = false;
      secret.focus();
    };

    this.syncs.push(() => {
      const servers = this.host.servers();
      note.textContent = DIRECTORY_NOTE[this.host.servers_status()];
      const key = JSON.stringify([servers, this.host.password_failed()]);
      if (key === list_key) return;
      list_key = key;
      list.replaceChildren(...servers.map((server) => this.server_row(server, ask)));
    });
    return [note, list, unlock];
  }

  private create_room(): HTMLElement[] {
    const create = el("form", "servers-create");
    const name = el("input", "settings-input");
    name.type = "text";
    name.maxLength = ROOM_LENGTH;
    name.autocomplete = "off";
    name.placeholder = "Random code";
    name.setAttribute("aria-label", "Room name");
    const password = this.password_input("Password");
    password.placeholder = "Optional, locks the room";
    const seed = el("input", "settings-input");
    seed.type = "text";
    seed.inputMode = "numeric";
    seed.maxLength = 10;
    seed.autocomplete = "off";
    seed.placeholder = "Random";
    seed.setAttribute("aria-label", "Map seed");
    const submit = el("button", "settings-action", "Create room");
    submit.type = "submit";
    for (const input of [name, password, seed]) input.addEventListener("input", () => input.setCustomValidity(""));
    create.addEventListener("submit", (event) => {
      event.preventDefault();
      const room = name.value.trim() ? clean_room(name.value) : random_code();
      if (room === null) return this.invalid(name, `Up to ${ROOM_LENGTH} characters`);
      const lock = password.value ? clean_password(password.value) : null;
      if (password.value && lock === null) return this.invalid(password, `Up to ${PASSWORD_LENGTH} characters`);
      const map = seed.value.trim() ? parse_seed(seed.value.trim()) : random_seed();
      if (map === null) return this.invalid(seed, "A whole number from 0 to 4294967295");
      const named = lock === null ? room : locked_name(room);
      save_lock(named, lock === null ? null : { password: lock, asked: false });
      this.go({ room: named, seed: String(map) });
    });
    create.append(
      this.row("Room name", name),
      this.row("Password", password, "Locked rooms show a lock and get a short code on their name; only players with the password can connect"),
      this.row("Map seed", seed),
      submit,
    );

    return [el("p", "servers-note", "Everything is optional: leave it empty for a random code and map."), create];
  }

  private server_row(server: Server, ask: (server: Server) => void): HTMLLIElement {
    const li = el("li", "servers-row");
    const name = el("div", "servers-name");
    const room = el("b");
    if (server.locked) {
      const lock = icon("icon-lock");
      lock.setAttribute("aria-label", "Locked");
      lock.setAttribute("aria-hidden", "false");
      room.append(lock);
    }
    room.append(el("span", "", server.room));
    name.append(room, el("small", "", `${server.host} · map ${server.seed}`));
    const players = el("span", "servers-players", `${server.players} ${server.players === 1 ? "player" : "players"}`);
    li.append(name, players);
    if (server.here && server.locked && this.host.password_failed()) li.append(this.action("Retry password", () => ask(server)));
    else if (server.here) li.append(el("span", "servers-tag", "You're here"));
    else if (server.version !== this.host.version) li.append(el("span", "servers-tag", "Different version"));
    else li.append(this.action("Join", () => (server.locked ? ask(server) : this.join(server, null))));
    return li;
  }

  private password_input(label: string): HTMLInputElement {
    const input = el("input", "settings-input");
    input.type = "password";
    input.maxLength = PASSWORD_LENGTH;
    input.autocomplete = "off";
    input.setAttribute("aria-label", label);
    return input;
  }

  private invalid(input: HTMLInputElement, message: string) {
    input.setCustomValidity(message);
    input.reportValidity();
  }

  private controls(): HTMLElement[] {
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
    this.syncs.push(() => table.toggleAttribute("data-pad", navigator.getGamepads().some((pad) => pad?.connected)));
    const wrap = el("div", "settings-keys-wrap");
    wrap.append(table);
    this.keys = wrap;
    return [
      this.toggle_row("tcs", "Traction control", "Cuts power when the rear wheels spin"),
      this.toggle_row("abs", "Anti-lock brakes", "Keeps steering under hard braking"),
      this.toggle_row("assist", "Steering assist", "Counter-steers a slide"),
      this.toggle_row("auto", "Automatic gearbox"),
      this.choice(
        "steer_mode",
        [
          [SteerMode.SNAP, "Snap back"],
          [SteerMode.HOLD, "Hold & self-centre"],
        ],
        "Keyboard steering",
      ),
      this.touch_only(
        this.choice(
          "touch_steer",
          [
            [TouchSteer.DRAG, "Drag"],
            [TouchSteer.BUTTONS, "Buttons"],
          ],
          "Touch steering",
          "Buttons steer like the keyboard",
        ),
      ),
      this.choice(
        "camera",
        [
          [CameraView.CHASE, "Chase"],
          [CameraView.COCKPIT, "Cockpit"],
        ],
        "Camera",
      ),
      this.choice(
        "camera_return",
        [
          [CameraReturn.OFF, "Off"],
          [CameraReturn.SHORT, "1.5 s"],
          [CameraReturn.LONG, "3 s"],
          [CameraReturn.NEVER, "Never"],
        ],
        "Camera returns after",
        "After a mouse look, once the car drives",
      ),
      this.toggle_row("invert_y", "Invert camera Y", "Mouse drag and right stick"),
      this.toggle_row("ghost", "Ghost car", "Your best lap drives beside you"),
      el("h4", "settings-sub", "Keys"),
      wrap,
    ];
  }

  private display(): HTMLElement[] {
    const active = current_theme();
    let saved = load_saved_themes();
    const in_use = THEMES[active] ? active : (find_saved(saved, active)?.name ?? active);

    const theme = el("select", "settings-select");
    theme.setAttribute("aria-label", "Theme");
    theme.addEventListener("change", () => {
      choose_theme(theme.value);
      this.reload("theme");
    });

    const mine_title = el("h4", "settings-sub", "Your themes");
    const mine = el("ul", "servers-list");
    const list = () => {
      const yours = el("optgroup");
      yours.label = "Your themes";
      const presets = el("optgroup");
      presets.label = "Presets";
      for (const { name } of saved) yours.append(new Option(name, name, false, name === in_use));
      for (const name of Object.keys(THEMES)) presets.append(new Option(name, name, false, name === in_use));
      theme.replaceChildren(...(saved.length ? [yours] : []), presets);
      mine.replaceChildren(...saved.map(({ name }) => this.saved_row(name, name === in_use, () => remove(name))));
      mine_title.hidden = saved.length === 0;
    };
    const remove = (name: string) => {
      const next = without_saved(saved, name);
      if (!store_saved_themes(next)) return;
      if (name === in_use) return this.reload("theme");
      saved = next;
      list();
      theme.focus();
    };
    list();

    return [this.row("Theme", theme, "Reloads the page"), mine_title, mine, ...this.theme_create(active, () => saved)];
  }

  private saved_row(name: string, in_use: boolean, remove: () => void): HTMLLIElement {
    const li = el("li", "servers-row");
    const label = el("div", "servers-name");
    label.append(el("b", "", name));
    li.append(label, in_use ? el("span", "servers-tag", "In use") : el("span"), this.action("Delete", remove));
    return li;
  }

  private theme_create(active: string, saved: () => SavedTheme[]): HTMLElement[] {
    const { background, foreground, primary, secondary, accent } = find_theme(active) ?? THEMES["Brand Dark"];
    let base: ThemeBase = { background, foreground, primary, secondary, accent };
    let mode: ThemeMode = is_dark(base) ? "dark" : "light";
    let harmony: Harmony | "any" = "any";
    // One seed per roll, so a slider or style change reshapes this theme instead of rolling a new one.
    let seed = 0;
    let rolled = false;
    const locked = new Set<keyof ThemeBase>();

    const steps = el("ol", "theme-steps");
    const step_items = THEME_STEPS.map((text) => {
      const item = el("li", "", text);
      steps.append(item);
      return item;
    });

    const roll = el("button", "settings-action theme-roll");
    roll.type = "button";
    const roll_label = el("span", "", "Roll a theme");
    roll.append(icon("icon-dice"), roll_label);

    const scene = el("div", "theme-scene");
    scene.setAttribute("aria-hidden", "true");
    for (const part of ["sky", "hill", "road", "lane", "car", "pill"]) scene.append(el("span", `theme-scene-${part}`));
    scene.querySelector(".theme-scene-pill")?.append(el("b", "", "88"), el("small", "", "km/h"), el("i", "", "3"));

    const locks = el("div", "theme-locks");
    const lock_buttons = BASE_TOKENS.map(([token, label]) => {
      const button = el("button", "theme-lock");
      button.type = "button";
      button.setAttribute("aria-label", `Lock ${label.toLowerCase()} colour`);
      const swatch = el("span", "theme-swatch");
      swatch.append(icon("icon-lock"));
      button.append(swatch, el("span", "", label));
      button.addEventListener("click", () => {
        if (locked.has(token)) locked.delete(token);
        else locked.add(token);
        render();
      });
      locks.append(button);
      return [token, button, swatch] as const;
    });

    const modes = el("div", "settings-choice");
    modes.setAttribute("role", "radiogroup");
    modes.setAttribute("aria-label", "Light or dark");
    const mode_buttons = THEME_MODES.map(([value, text]) => {
      const button = el("button", "", text);
      button.type = "button";
      button.setAttribute("role", "radio");
      button.addEventListener("click", () => {
        mode = value;
        adjust();
      });
      modes.append(button);
      return [value, button] as const;
    });

    const styles = el("div", "theme-styles");
    styles.setAttribute("role", "radiogroup");
    styles.setAttribute("aria-label", "Colour style");
    const style_buttons = HARMONY_CHOICES.map(([value, text]) => {
      const button = el("button", "theme-style");
      button.type = "button";
      button.setAttribute("role", "radio");
      const dots = el("span", "theme-style-dots");
      // Swatches turn the page's own primary by the style's hue offsets, so they stay on the theme's tokens.
      for (const turn of value === "any" ? [0, 0, 0] : HARMONY_HUES[value]) {
        const dot = el("span", value === "any" ? "theme-style-any" : "");
        dot.style.setProperty("--turn", String(turn));
        dots.append(dot);
      }
      button.append(dots, el("span", "", text));
      button.addEventListener("click", () => {
        harmony = value;
        adjust();
      });
      styles.append(button);
      return [value, button] as const;
    });

    const vibrance = this.percent_range("Colour strength");
    const contrast = this.percent_range("Contrast");
    vibrance.addEventListener("input", () => adjust());
    contrast.addEventListener("input", () => adjust());

    const generate = () => {
      const keep = Object.fromEntries([...locked].map((token) => [token, base[token]]));
      base = generate_theme({ mode, harmony, vibrance: Number(vibrance.value) / 100, contrast: Number(contrast.value) / 100, locked: keep }, mulberry32(seed));
    };
    const adjust = () => {
      if (rolled) generate();
      render();
    };
    roll.addEventListener("click", () => {
      seed = Math.floor(Math.random() * 2 ** 32);
      rolled = true;
      roll_label.textContent = "Roll again";
      generate();
      render();
    });

    const form = el("form", "settings-inline");
    const name = el("input", "settings-input");
    name.type = "text";
    name.maxLength = THEME_NAME_LENGTH;
    name.autocomplete = "off";
    name.enterKeyHint = "done";
    name.setAttribute("aria-label", "Theme name");
    // A pad can't type, so an empty name saves under the next free placeholder.
    const free_name = () => {
      let at = saved().length + 1;
      while (find_saved(saved(), `My theme ${at}`)) at++;
      return `My theme ${at}`;
    };
    name.placeholder = free_name();
    name.addEventListener("input", () => name.setCustomValidity(""));
    const save = el("button", "settings-action", "Save");
    save.type = "submit";
    form.append(name, save);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!rolled) return;
      const chosen = name.value.trim() || free_name();
      const problem = theme_name_problem(chosen);
      if (problem) return this.invalid(name, problem);
      if (!store_saved_themes(with_saved(saved(), chosen, derive_theme(base)))) return this.invalid(name, "This browser refused to store it");
      choose_theme(chosen);
      this.reload("theme");
    });

    const render = () => {
      const theme = derive_theme(base);
      for (const token of TOKENS) scene.style.setProperty(token_var(token), theme[token]);
      for (const [token, button, swatch] of lock_buttons) {
        swatch.style.background = base[token];
        button.setAttribute("aria-pressed", String(locked.has(token)));
      }
      for (const [value, button] of mode_buttons) button.setAttribute("aria-checked", String(value === mode));
      for (const [value, button] of style_buttons) button.setAttribute("aria-checked", String(value === harmony));
      save.disabled = !rolled;
      name.disabled = !rolled;
      step_items.forEach((item, at) => item.toggleAttribute("data-current", at === (rolled ? 1 : 0)));
    };
    render();

    return [
      el("h4", "settings-sub", "Create a theme"),
      steps,
      roll,
      scene,
      this.row("Your colours", locks, "Lock a colour to keep it when you roll again"),
      this.row("Light or dark", modes),
      this.row("Colour style", styles),
      this.row("Colour strength", this.range_ends(vibrance, "Muted", "Bold")),
      this.row("Contrast", this.range_ends(contrast, "Soft", "Sharp"), "Text always stays readable"),
      this.row("Name and save", form, "Adds it to Your themes and switches to it; reloads the page"),
    ];
  }

  private range_ends(range: HTMLInputElement, low: string, high: string): HTMLElement {
    const wrap = el("div", "theme-range");
    wrap.append(el("small", "", low), range, el("small", "", high));
    return wrap;
  }

  private percent_range(label: string): HTMLInputElement {
    const range = el("input", "settings-range");
    range.type = "range";
    range.min = "0";
    range.max = "100";
    range.step = "5";
    range.value = "50";
    range.setAttribute("aria-label", label);
    const fill = () => range.style.setProperty("--fill", `${range.value}%`);
    range.addEventListener("input", fill);
    fill();
    return range;
  }

  private audio(): HTMLElement[] {
    const wrap = el("div", "settings-inline settings-volume");
    const range = el("input", "settings-range");
    range.type = "range";
    range.min = "0";
    range.max = "100";
    range.step = "5";
    range.setAttribute("aria-label", "Master volume");
    const readout = el("b", "settings-value settings-number");
    range.addEventListener("input", () => {
      readout.textContent = `${range.value}%`;
      this.set("volume", Number(range.value) / 100);
    });
    this.syncs.push(() => {
      const percent = String(Math.round(this.current.volume * 100));
      if (document.activeElement !== range) range.value = percent;
      readout.textContent = `${percent}%`;
      range.disabled = this.current.muted;
      range.style.setProperty("--fill", `${this.current.volume * 100}%`);
    });
    wrap.append(range, readout);
    return [this.row("Master volume", wrap), this.toggle_row("muted", "Mute")];
  }

  private refresh() {
    for (const sync of this.syncs) sync();
  }

  private readonly click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    if (event.target === this.root) return this.close();
    const button = event.target.closest<HTMLButtonElement>("button");
    if (!button) return;
    if (button.dataset.action === "close") return this.close();
    if (button.dataset.action === "back") return this.back();
    if (button.dataset.action === "random") return this.drive(random_seed(), this.chosen_kind);
    const section = button.dataset.section;
    if (!section) return;
    this.show(section);
  };

  private readonly key = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      return this.back();
    }
    if (typing(event.target) || event.repeat) return;
    if (event.code === "KeyQ" || event.code === "KeyE") this.step_section(event.code === "KeyQ" ? -1 : 1);
  };
}

function view_of(section: string): View {
  if (!(section in PARENT)) return View.MENU;
  return section in PAGE_TITLE ? View.PAGE : View.SHEET;
}

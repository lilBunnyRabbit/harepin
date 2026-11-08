import { SteerMode } from "./car";
import { HudLayout } from "./hud";
import { Mood } from "./lighting";
import { clean_name } from "./net";
import { THEMES, choose_theme, current_theme } from "./theme";
import "./settings.css";

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
  camera: CameraView;
  ghost: boolean;
  hud: HudLayout;
  light: Mood;
  help: boolean;
  /** Master volume, 0..1. */
  volume: number;
  muted: boolean;
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
  camera: CameraView.CHASE,
  ghost: true,
  hud: HudLayout.STRIP,
  light: Mood.GOLDEN,
  help: true,
  volume: 0.8,
  muted: false,
};

/** Settings applied at load (layout, lighting); changing one reloads the page with its URL override dropped. */
const RELOAD_KEYS: readonly SettingKey[] = ["hud", "light"];

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
    camera: one_of(Object.values(CameraView), s.camera, d.camera),
    ghost: bool(s.ghost, d.ghost),
    hud: one_of(Object.values(HudLayout), s.hud, d.hud),
    light: one_of(Object.values(Mood), s.light, d.light),
    help: bool(s.help, d.help),
    volume,
    muted: bool(s.muted, d.muted),
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
    hud: params.get("hud") ?? saved.hud,
    light: params.get("light") ?? saved.light,
  });
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
  name(): string;
  quality_status(): QualityStatus;
  race_busy(): boolean;
  toggle_race(laps: Laps): void;
}

export const SettingsLayout = {
  SHEET: "a",
  CARD: "b",
} as const;
export type SettingsLayout = (typeof SettingsLayout)[keyof typeof SettingsLayout];

const asked_layout = new URLSearchParams(location.search).get("settings");
export const settings_layout: SettingsLayout = one_of(Object.values(SettingsLayout), asked_layout, SettingsLayout.SHEET);

interface Section {
  id: string;
  label: string;
  icon: string;
  build: () => HTMLElement[];
}

const TIER_LABEL: Record<QualityTier, string> = { high: "High", medium: "Medium", low: "Low" };
const STATUS_MS = 1000;
const COPIED_MS = 2000;

const KEYS: [string, string, string, string][] = [
  ["Drive", "W A S D / arrows", "RT / LT, left stick", "Gas, Brake, drag to steer"],
  ["Handbrake", "Space", "A", "Handbrake"],
  ["Reset", "R", "Y", "Reset"],
  ["Rewind (hold)", "Backspace", "X", "◂◂"],
  ["Shift up / down", "E / Q", "RB / LB", ""],
  ["Auto gearbox", "M", "", ""],
  ["Camera", "C", "View", "Cam"],
  ["Ghost", "G", "", ""],
  ["TCS / ABS / steer assist", "1 / 2 / 3", "", ""],
  ["Garage", "V", "", ""],
  ["Help", "H", "", ""],
  ["Chat", "T", "", "Chat"],
  ["Settings", "Esc", "", ""],
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

export class Settings {
  on_change: ((state: SettingsState, key: SettingKey) => void) | null = null;
  private readonly root = el("div", "settings");
  private readonly panel = el("div", "settings-panel");
  private readonly body = el("div", "settings-body");
  private readonly tabs = new Map<string, HTMLButtonElement>();
  private readonly pages = new Map<string, HTMLElement>();
  private readonly syncs: (() => void)[] = [];
  private saved: SettingsState;
  private timer = 0;
  private section = "graphics";

  constructor(
    private readonly parent: HTMLElement,
    private readonly host: SettingsHost,
    private current: SettingsState,
    private readonly layout: SettingsLayout = settings_layout,
  ) {
    this.saved = read_saved();
    this.root.hidden = true;
    this.root.dataset.layout = layout;
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.setAttribute("aria-labelledby", "settings-title");
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

  open(section?: string) {
    if (section && this.pages.has(section)) this.section = section;
    if (this.is_open) return this.show(this.section, true);
    if (!this.root.isConnected) this.parent.append(this.root);
    this.root.hidden = false;
    this.root.addEventListener("click", this.click);
    addEventListener("keydown", this.key);
    this.timer = window.setInterval(() => this.refresh(), STATUS_MS);
    this.refresh();
    this.show(this.section, true);
    this.panel.focus();
  }

  close() {
    if (!this.is_open) return;
    this.root.hidden = true;
    this.root.removeEventListener("click", this.click);
    removeEventListener("keydown", this.key);
    clearInterval(this.timer);
  }

  toggle() {
    if (this.is_open) this.close();
    else this.open();
  }

  set<K extends SettingKey>(key: K, value: SettingsState[K]) {
    if (this.current[key] === value) return;
    this.current = { ...this.current, [key]: value };
    this.saved = { ...this.saved, [key]: value };
    write_saved(this.saved);
    if (RELOAD_KEYS.includes(key)) return this.reload(key);
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
    const head = el("div", "settings-head");
    const title = el("h2", "settings-title", "Settings");
    title.id = "settings-title";
    const close = el("button", "settings-close");
    close.type = "button";
    close.dataset.action = "close";
    close.setAttribute("aria-label", "Close settings");
    close.title = "Close (Esc)";
    close.append(icon("icon-close"));
    head.append(title, close);

    const sections: Section[] = [
      { id: "graphics", label: "Graphics", icon: "icon-graphics", build: () => this.graphics() },
      { id: "lobby", label: "Lobby", icon: "icon-lobby", build: () => this.lobby() },
      { id: "controls", label: "Controls", icon: "icon-controls", build: () => this.controls() },
      { id: "display", label: "Display", icon: "icon-display", build: () => this.display() },
      { id: "audio", label: "Audio", icon: "icon-audio", build: () => this.audio() },
    ];

    const nav = el("nav", "settings-tabs");
    nav.setAttribute("aria-label", "Settings sections");
    for (const section of sections) {
      const tab = el("button", "settings-tab");
      tab.type = "button";
      tab.dataset.section = section.id;
      tab.append(icon(section.icon), el("span", "", section.label));
      nav.append(tab);
      this.tabs.set(section.id, tab);

      const page = el("section", "settings-page");
      page.dataset.section = section.id;
      page.setAttribute("aria-label", section.label);
      page.append(el("h3", "settings-page-title", section.label), ...section.build());
      this.body.append(page);
      this.pages.set(section.id, page);
    }
    this.panel.append(head, nav, this.body);
    if (this.layout === SettingsLayout.CARD) this.body.addEventListener("scroll", this.follow_scroll, { passive: true });
  }

  private show(section: string, scroll = false) {
    this.section = section;
    for (const [id, tab] of this.tabs) tab.setAttribute("aria-current", String(id === section));
    if (this.layout === SettingsLayout.SHEET) {
      for (const [id, page] of this.pages) page.hidden = id !== section;
      this.body.scrollTop = 0;
    } else if (scroll) {
      const page = this.pages.get(section);
      if (page) this.body.scrollTop = page.offsetTop - this.body.offsetTop;
    }
  }

  private readonly follow_scroll = () => {
    let seen = this.section;
    for (const [id, page] of this.pages) if (page.offsetTop - this.body.offsetTop <= this.body.scrollTop + this.body.clientHeight / 3) seen = id;
    if (seen !== this.section) this.show(seen);
  };

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

  private toggle_row(key: "tcs" | "abs" | "assist" | "auto" | "ghost" | "help" | "muted", label: string, hint = ""): HTMLElement {
    const button = el("button", "settings-switch");
    button.type = "button";
    button.setAttribute("role", "switch");
    button.setAttribute("aria-label", label);
    button.append(el("span", "settings-knob"));
    button.addEventListener("click", () => this.set(key, !this.current[key]));
    this.syncs.push(() => button.setAttribute("aria-checked", String(this.current[key])));
    return this.row(label, button, hint, true);
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

  private lobby(): HTMLElement[] {
    const { room, seed } = this.host;
    const room_value = el("div", "settings-inline");
    room_value.append(
      el("b", "settings-value", room),
      this.action("Copy invite", async (button) => {
        const link = `${location.origin}${location.pathname}?room=${encodeURIComponent(room)}&seed=${seed}`;
        try {
          await navigator.clipboard.writeText(link);
          button.textContent = "Copied";
        } catch (error) {
          console.warn("settings: clipboard refused", error);
          button.textContent = "Copy failed";
        }
        setTimeout(() => (button.textContent = "Copy invite"), COPIED_MS);
      }),
    );

    const map_value = el("div", "settings-inline");
    map_value.append(
      el("b", "settings-value settings-number", String(seed)),
      this.action("New map", () => this.go({ room, seed: String(Math.floor(Math.random() * 0x7fffffff)) })),
    );

    const name = el("input", "settings-input");
    name.type = "text";
    name.maxLength = 24;
    name.autocomplete = "off";
    name.enterKeyHint = "done";
    name.setAttribute("aria-label", "Player name");
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

    const race = this.action("Start race", () => {
      this.host.toggle_race(this.current.laps);
      this.refresh();
    });
    this.syncs.push(() => (race.textContent = this.host.race_busy() ? "Leave race" : "Start race"));

    return [
      this.row("Room", room_value, "Friends join with the invite link"),
      this.row("Private room", this.action("New private room", () => this.go({ room: random_code() })), "Starts an empty room with a fresh code"),
      this.row("Player name", name, "Leave empty for a random bunny"),
      this.row("Map", map_value, "Others keep their map until they open your invite"),
      this.choice(
        "laps",
        LAPS.map((laps) => [laps, String(laps)] as const),
        "Race laps",
      ),
      this.row("Lobby race", race, "Everyone in the room starts together"),
    ];
  }

  private go(query: Record<string, string>) {
    location.search = `?${new URLSearchParams(query)}`;
  }

  private controls(): HTMLElement[] {
    const table = el("table", "settings-keys");
    const head = el("tr");
    for (const text of ["", "Keyboard", "Gamepad", "Touch"]) head.append(el("th", "", text));
    table.append(el("thead"), el("tbody"));
    table.tHead?.append(head);
    for (const [what, ...ways] of KEYS) {
      const tr = el("tr");
      tr.append(el("th", "", what));
      const [keyboard, pad, touch] = ways;
      for (const way of [keyboard, pad]) {
        const td = el("td");
        if (way) td.append(el("kbd", "", way));
        tr.append(td);
      }
      tr.append(el("td", "settings-touch", touch));
      table.tBodies[0].append(tr);
    }
    const wrap = el("div", "settings-keys-wrap");
    wrap.append(table);
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
      this.choice(
        "camera",
        [
          [CameraView.CHASE, "Chase"],
          [CameraView.COCKPIT, "Cockpit"],
        ],
        "Camera",
      ),
      this.toggle_row("ghost", "Ghost car", "Your best lap drives beside you"),
      el("h4", "settings-sub", "Keys"),
      wrap,
    ];
  }

  private display(): HTMLElement[] {
    const theme = el("select", "settings-select");
    theme.setAttribute("aria-label", "Theme");
    const active = current_theme();
    for (const name of Object.keys(THEMES)) theme.add(new Option(name, name, false, name === active));
    theme.addEventListener("change", () => {
      choose_theme(theme.value);
      this.reload("theme");
    });
    return [
      this.row("Theme", theme, "Reloads the page"),
      this.choice(
        "hud",
        [
          [HudLayout.STRIP, "Strip"],
          [HudLayout.CLUSTER, "Cluster"],
          [HudLayout.CORNERS, "Corners"],
        ],
        "HUD layout",
        "Reloads the page",
      ),
      this.choice(
        "light",
        [
          [Mood.GOLDEN, "Golden hour"],
          [Mood.BLUE, "Blue hour"],
          [Mood.NIGHT, "Night"],
        ],
        "Lighting",
        "Reloads the page",
      ),
      this.toggle_row("help", "Key hints", "The key list in the bottom corner"),
    ];
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
    const section = button.dataset.section;
    if (!section) return;
    this.show(section, true);
  };

  private readonly key = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    this.close();
  };
}

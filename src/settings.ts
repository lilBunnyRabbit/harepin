import { SteerMode } from "./car";
import { DirectoryStatus, PASSWORD_LENGTH, ROOM_LENGTH, clean_password, clean_room, locked_name, save_lock, type Server } from "./directory";
import { clean_name, parse_seed } from "./net";
import { THEMES, choose_theme, current_theme } from "./theme";
import { TouchSteer } from "./touch";
import { WorldMap } from "./world-map";
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
  readonly version: string;
  show_changelog(): void;
  servers(): Server[];
  servers_status(): DirectoryStatus;
  /** This room's handshake failed on the password, so its row offers another try. */
  password_failed(): boolean;
  browse_servers(on: boolean): void;
}

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
  ["Drive", "WASD / arrows", "RT / LT, stick", "Gas, Brake, drag or arrow buttons to steer (Touch steering)"],
  ["Handbrake", "Space", "A", "Handbrake"],
  ["Nitro (hold, when fitted)", "Shift / N", "B", "Nitro"],
  ["Reset", "R", "Y", "Reset"],
  ["Rewind (hold)", "Backspace", "X", "Rewind (hold)"],
  ["Shift up / down", "E / Q", "RB / LB", ""],
  ["Auto gearbox", "M", "", ""],
  ["Camera", "C", "View", "Cam"],
  ["Look around", "Drag / wheel", "Right stick", "Drag, pinch to zoom"],
  ["Recenter camera", "F / double-click", "R3", "Recenter"],
  ["Ghost", "G", "", ""],
  ["TCS / ABS / steer assist", "1 / 2 / 3", "", ""],
  ["Garage", "V", "", ""],
  ["This key list", "H", "", ""],
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

function random_seed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

export function invite_link(room: string, seed: number): string {
  return `${location.origin}${location.pathname}?room=${encodeURIComponent(room)}&seed=${seed}`;
}

const DIRECTORY_NOTE: Record<DirectoryStatus, string> = {
  connecting: "Looking for other games…",
  online: "Games running right now",
  offline: "No other games found. Invite links still work.",
};

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
  private keys: HTMLElement | null = null;
  private readonly world_map = new WorldMap();
  private chosen: number;

  constructor(
    private readonly parent: HTMLElement,
    private readonly host: SettingsHost,
    private current: SettingsState,
  ) {
    this.saved = read_saved();
    this.chosen = host.seed;
    this.root.hidden = true;
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
      { id: "world", label: "World", icon: "icon-world", build: () => this.world() },
      { id: "servers", label: "Servers", icon: "icon-servers", build: () => this.servers() },
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
      page.append(...section.build());
      this.body.append(page);
      this.pages.set(section.id, page);
    }
    const foot = el("div", "settings-foot");
    const changes = el("button", "settings-link", "What's new");
    changes.type = "button";
    changes.addEventListener("click", () => this.host.show_changelog());
    foot.append(el("span", "", `Version v${this.host.version}`), changes);
    this.panel.append(head, nav, this.body, foot);
  }

  private show(section: string) {
    this.section = section;
    for (const [id, tab] of this.tabs) tab.setAttribute("aria-current", String(id === section));
    for (const [id, page] of this.pages) page.hidden = id !== section;
    this.body.scrollTop = 0;
    if (section === "world") this.world_map.show(this.chosen, true);
    else this.world_map.stop();
    this.host.browse_servers(section === "servers");
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

  private lobby(): HTMLElement[] {
    const { room, seed } = this.host;
    const room_value = el("div", "settings-inline");
    room_value.append(
      el("b", "settings-value", room),
      this.copy_action("Copy invite", invite_link(room, seed)),
    );

    const map_value = el("div", "settings-inline");
    map_value.append(
      el("b", "settings-value settings-number", String(seed)),
      this.action("New map", () => this.go({ room, seed: String(random_seed()) })),
    );

    const name = el("input", "settings-input");
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

    const race = this.action("Start race", () => {
      this.host.toggle_race(this.current.laps);
      this.refresh();
    });
    this.syncs.push(() => (race.textContent = this.host.race_busy() ? "Leave race" : "Start race"));

    return [
      this.row("Your name", name, "Everyone in the room sees it; leave empty for a random bunny"),
      this.row("Room", room_value, "Friends join with the invite link"),
      this.row("New room", this.action("New room", () => this.go({ room: random_code() })), "Starts an empty room with a fresh code; lock one with a password in Servers"),
      this.row("Map", map_value, "Others keep their map until they open your invite"),
      this.choice(
        "laps",
        LAPS.map((laps) => [laps, String(laps)] as const),
        "Race laps",
      ),
      this.row("Lobby race", race, "Everyone in the room starts together"),
    ];
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

    const drive = this.action("Drive this island", () => this.go({ room, seed: String(this.chosen) }));
    drive.classList.add("world-drive");
    const choose = (next: number, now: boolean) => {
      this.chosen = next;
      drive.disabled = next === seed;
      drive.title = drive.disabled ? "You're on this island" : `Reloads room ${room} on island ${next}`;
      this.world_map.show(next, now);
    };
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

    const current = el("div", "settings-inline");
    current.append(el("b", "settings-value settings-number", String(seed)), this.copy_action("Copy link", invite_link(room, seed)));
    const current_row = this.row("This island", current, `Room ${room} is driving it`);
    current_row.classList.add("world-current");

    const world = el("div", "world");
    world.append(seed_row, this.world_map.root, legend, drive, current_row);
    return [world];
  }

  private go(query: Record<string, string>) {
    location.search = `?${new URLSearchParams(query)}`;
  }

  private join(server: Server, password: string | null) {
    save_lock(server.room, password === null ? null : { password, asked: true });
    this.go({ room: server.room, seed: String(server.seed) });
  }

  private servers(): HTMLElement[] {
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

    return [note, list, unlock, el("h4", "settings-sub", "New room"), create];
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
      for (const [way, column] of [
        [keyboard, ""],
        [pad, "settings-col-pad"],
      ]) {
        const td = el("td", column);
        if (way) td.append(el("kbd", "", way));
        tr.append(td);
      }
      tr.append(el("td", "settings-touch settings-col-touch", touch));
      table.tBodies[0].append(tr);
    }
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
    this.show(section);
  };

  private readonly key = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    this.close();
  };
}

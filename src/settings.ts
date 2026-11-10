import { typing, type Nav } from "./input";
import { DirectoryStatus, PASSWORD_LENGTH, ROOM_LENGTH, clean_password, clean_room, locked_name, save_lock, type Server } from "./directory";
import { clean_name, parse_seed } from "./net";
import { GUIDE_PARAM, Guide, ROLLED_VISIT, type GuideStep } from "./guide";
import { ModesPage } from "./menu/modes-page";
import { MenuTab, invite_link, type Menu, type MenuPage, type SettingsHost, type SettingsMenu } from "./menu/page";
import { DEFAULT_SETTINGS, LAPS, type SettingKey, type SettingsState } from "./menu/prefs";
import { mark_drive, read_saved, write_saved } from "./menu/prefs-store";
import { action, copy_action, dress, info, invalid, mosaic, password_input, picture, random_seed, row, tile } from "./menu/widgets";
import { settings_sections } from "./menu/settings-sections";
import { WorldPage } from "./menu/world-page";
import { Rows, el, icon, read, type RowHelp, type Value } from "./setting-rows";
import { WorldKind } from "./worldgen/types";
import { kind_of_world } from "./worldgen/kinds/kinds";
import { WORLDS } from "./worlds/worlds";
import { world_query } from "./world-pick";
import "./settings.css";
import "./menu.css";

interface SubPage {
  label: string;
  parent: string | null;
  keys: readonly SettingKey[];
  tab: HTMLButtonElement | null;
  list: HTMLElement;
  help: string;
}

const MENU_TABS: [MenuTab, string][] = [
  [MenuTab.PLAY, "Play"],
  [MenuTab.GARAGE, "Garage"],
  [MenuTab.ONLINE, "Online"],
  [MenuTab.SETTINGS, "Settings"],
];

const View = {
  MENU: "menu",
  PAGE: "page",
  GUIDE: "guide",
} as const;
type View = (typeof View)[keyof typeof View];

/** The What's new page: a settings page with no section tab, opened from the version line. */
const CHANGES = "changes";

const STATUS_MS = 1000;

function random_code() {
  return Math.random().toString(36).slice(2, 8);
}

const DIRECTORY_NOTE: Record<DirectoryStatus, string> = {
  connecting: "Looking for other games…",
  online: "Games running right now",
  offline: "No other games found. Invite links still work.",
};

export class Settings {
  on_change: ((state: SettingsState, key: SettingKey) => void) | null = null;
  /** Arrow keys in the menu, handed to the pad's focus moves so both walk the same rows. */
  on_nav: ((nav: Nav) => void) | null = null;
  private readonly root = el("div", "settings");
  readonly panel = el("div", "settings-panel");
  private readonly body = el("div", "settings-body");
  private readonly menu_tabs = new Map<string, HTMLButtonElement>();
  private readonly pages = new Map<string, HTMLElement>();
  private readonly syncs: (() => void)[] = [];
  private readonly title = el("h2", "settings-title", "Settings");
  private readonly name_input = el("input");
  private saved: SettingsState;
  private timer = 0;
  private section: string = MenuTab.PLAY;
  private readonly rows = new Rows();
  private readonly subs = new Map<string, SubPage>();
  private sub = "graphics";
  private help: RowHelp | null = null;
  private readonly help_title = el("b", "set-help-title");
  private readonly help_text = el("p", "set-help-text");
  private readonly help_visual = el("div", "set-help-visual");
  private readonly menu: Menu;
  private readonly page_list: MenuPage[];
  private readonly settings_menu: SettingsMenu;
  /** The section being built: `value` records its keys, which Reset section puts back. */
  private recording: SettingKey[] | null = null;
  private race_route = "circuit";
  private readonly guide: Guide;

  constructor(
    private readonly parent: HTMLElement,
    private readonly host: SettingsHost,
    private current: SettingsState,
  ) {
    this.saved = read_saved();
    this.menu = {
      host,
      rows: this.rows,
      state: () => this.current,
      set: (key, value) => this.set(key, value),
      sync: (run) => this.syncs.push(run),
      refresh: () => this.refresh(),
      close: () => this.close(),
      show: (section) => this.show(section),
      drive: (seed, kind) => this.drive(seed, kind),
      go: (query) => this.go(query),
    };
    this.settings_menu = {
      ...this.menu,
      value: (key) => this.value(key),
      show_sub: (id) => this.show_sub(id),
      reload: (param) => this.reload(param),
      redraw_help: () => this.render_help(),
    };
    this.page_list = [
      { id: MenuTab.PLAY, label: "Play", build: () => this.play() },
      {
        id: MenuTab.GARAGE,
        label: "Garage",
        build: () => [host.garage_stage],
        on_show: () => host.show_garage(true),
        on_hide: () => host.show_garage(false),
      },
      {
        id: MenuTab.ONLINE,
        label: "Online",
        build: () => this.online(),
        on_show: () => host.browse_servers(true),
        on_hide: () => host.browse_servers(false),
      },
      { id: MenuTab.SETTINGS, label: "Settings", build: () => this.settings_page(), on_show: () => this.show_sub(this.sub) },
      new WorldPage(this.menu),
      new ModesPage(this.menu),
      { id: "room", label: "New room", parent: MenuTab.ONLINE, build: () => this.create_room() },
    ];
    this.guide = new Guide({
      state: () => this.current,
      set: (key, value) => this.set(key, value),
      name: () => this.host.name(),
      kind: host.kind,
      picture: (name) => picture(name),
      skip: () => this.end_guide(),
      drive: (kind) => {
        this.end_guide();
        this.drive(this.host.seed, kind);
      },
      reload_on_look: (rolled) => {
        const params = new URLSearchParams(location.search);
        params.delete("theme");
        params.set(GUIDE_PARAM, rolled ? ROLLED_VISIT : "look");
        location.replace(`${location.pathname}?${params}${location.hash}`);
      },
    });
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

  get guide_open(): boolean {
    return this.is_open && this.root.dataset.view === View.GUIDE;
  }

  /** The first-run guide in the menu shell, on a step with the current choices filled in. */
  open_guide(step: GuideStep = "you", rolled = false) {
    this.open();
    this.root.dataset.view = View.GUIDE;
    this.root.dataset.section = "guide";
    this.hide_pages();
    this.guide.start(step, rolled);
    this.panel.focus();
  }

  private end_guide() {
    this.set("guide_seen", true);
    this.guide.stop();
    this.show(MenuTab.PLAY);
  }

  /** Start on the pad: the guide skips to Play. */
  skip_guide() {
    if (this.guide_open) this.end_guide();
  }

  /** The menu, on Play unless a section is named. */
  open(section: string = MenuTab.PLAY) {
    if (this.subs.has(section)) {
      this.section = MenuTab.SETTINGS;
      this.sub = section;
    } else if (this.pages.has(section)) this.section = section;
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

  /** The key list: the help key lands here. */
  open_keys() {
    this.open("keys");
  }

  close() {
    if (!this.is_open) return;
    if (this.guide_open) this.set("guide_seen", true);
    this.guide.stop();
    this.root.hidden = true;
    this.root.removeEventListener("click", this.click);
    removeEventListener("keydown", this.key);
    clearInterval(this.timer);
    this.hide_pages();
  }

  private hide_pages() {
    for (const page of this.page_list) page.on_hide?.();
  }

  toggle() {
    if (this.is_open) this.close();
    else this.open();
  }

  focus_name() {
    if (this.guide_open) this.guide.focus_name();
    else this.name_input.focus();
  }

  /** The open tab's page. */
  page(): HTMLElement {
    if (this.guide_open) return this.guide.panel;
    if (this.section === MenuTab.SETTINGS) return this.subs.get(this.sub)?.list ?? this.body;
    return this.pages.get(this.section) ?? this.body;
  }

  /** One level up: a page or a settings section returns to its tab, a tab closes the menu. */
  back() {
    if (this.guide_open) return void this.guide.back();
    const deep = this.section === MenuTab.SETTINGS ? this.subs.get(this.sub)?.parent : null;
    if (deep) return this.show_sub(deep);
    const parent = this.page_of(this.section)?.parent;
    if (parent) this.show(parent);
    else this.close();
  }

  step_tab(step: number) {
    if (this.guide_open) return this.guide.step_by(step);
    if (this.view_of(this.section) === View.PAGE) return;
    const ids = [...this.menu_tabs.keys()];
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
    head.append(back, this.title, close);

    for (const section of this.page_list) {
      const page = el("section", "settings-page");
      page.dataset.section = section.id;
      page.setAttribute("aria-label", section.label);
      page.append(...section.build());
      this.body.append(page);
      this.pages.set(section.id, page);
    }
    this.guide.skip_button.dataset.guideOnly = "";
    top.append(this.guide.skip_button);
    this.panel.append(top, menu_nav, this.guide.rail, head, this.body, this.guide.panel);
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
    this.root.dataset.view = this.view_of(section);
    this.root.dataset.section = section;
    for (const [id, tab] of this.menu_tabs) tab.setAttribute("aria-current", String(id === section));
    for (const [id, page] of this.pages) page.hidden = id !== section;
    const shown = this.page_of(section);
    this.title.textContent = shown?.parent ? shown.label : "Settings";
    this.body.scrollTop = 0;
    for (const page of this.page_list) if (page !== shown) page.on_hide?.();
    shown?.on_show?.();
    this.refresh();
  }

  private page_of(section: string): MenuPage | undefined {
    return this.page_list.find((page) => page.id === section);
  }

  private view_of(section: string): View {
    return this.page_of(section)?.parent ? View.PAGE : View.MENU;
  }

  private play(): HTMLElement[] {
    const { room, seed, kind } = this.host;
    const hero = el("div", "menu-tile");
    hero.dataset.area = "hero";
    const text = dress(hero, `${WORLDS[kind].name} ${seed}`, WORLDS[kind].hero, picture(kind), "Keep driving");
    text.append(el("span", "menu-go", "Drive"));
    const drive = el("button", "menu-hit");
    drive.type = "button";
    drive.dataset.action = "close";
    drive.setAttribute("aria-label", `Keep driving ${WORLDS[kind].name} ${seed}`);
    const restart = el("button", "menu-corner");
    restart.type = "button";
    restart.append(icon("icon-restart"), el("span", "", "Restart lap"));
    restart.addEventListener("click", () => {
      this.close();
      this.host.restart_lap();
    });
    hero.append(drive, restart);

    const world = (other: WorldKind) => {
      const button = tile(other, WORLDS[other].name, WORLDS[other].note, picture(other), () => this.drive(seed, other));
      button.title = other === kind ? "Keep driving here" : `Reloads room ${room} on ${WORLDS[other].name} ${seed}`;
      if (other === kind) button.append(el("span", "menu-tag", "You're here"));
      return button;
    };
    const map = tile("map", "New map", "Pick a world and a map, or type a friend's map code", picture(`${kind}-map`, true), () => this.show("world"));
    const modes = tile("modes", "Modes", "Races, gymkhana, parking, drift zones, gate hunt, ghost duel", icon("icon-modes"), () => this.show("modes"));
    return mosaic(MenuTab.PLAY, hero, ...Object.values(WORLDS).map(({ kind }) => world(kind)), map, modes);
  }

  private online(): HTMLElement[] {
    const { room, seed, kind } = this.host;
    const players = el("span", "menu-caption");
    this.syncs.push(() => (players.textContent = `${this.host.players()} here · ${WORLDS[kind].name} ${seed}`));
    const invite = el("div", "settings-inline");
    invite.append(copy_action("Copy invite link", invite_link(room, seed, kind)));
    const room_tile = info("room", "Your room", el("b", "menu-code", room), players, invite, el("small", "menu-caption", "Friends who open the link join this room on this map"));

    const scroll = el("div", "menu-scroll");
    scroll.append(...this.games());
    const games = info("games", "Games running", scroll);

    const routes = this.host.race_routes;
    const route_of = () => routes.find((r) => r.id === this.race_route) ?? routes[0];
    const picker = el("div", "race-routes");
    picker.setAttribute("role", "radiogroup");
    picker.setAttribute("aria-label", "Route");
    const route_buttons = routes.map((choice) => {
      const button = el("button", "race-route");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.append(el("b", "", choice.name), el("small", "", `${(choice.length / 1000).toFixed(1)} km · ${choice.closed ? "loop" : "A to B"}`));
      button.addEventListener("click", () => {
        this.race_route = choice.id;
        this.refresh();
      });
      picker.append(button);
      return [choice.id, button] as const;
    });
    const laps = el("div", "settings-choice race-laps");
    laps.setAttribute("role", "radiogroup");
    laps.setAttribute("aria-label", "Laps");
    const lap_buttons = LAPS.map((count) => {
      const button = el("button", "", String(count));
      button.type = "button";
      button.setAttribute("role", "radio");
      button.addEventListener("click", () => this.set("laps", count));
      laps.append(button);
      return [count, button] as const;
    });
    const lap_row = el("div", "race-lap-row");
    lap_row.append(el("span", "", "Laps"), laps);
    const note = el("small", "menu-caption");
    const race = el("button", "settings-action", "Start race");
    race.type = "button";
    race.addEventListener("click", () => {
      const route = route_of();
      this.host.toggle_race(route?.closed === false ? 1 : this.current.laps, route?.id ?? "circuit");
      this.refresh();
    });
    const record = el("small", "menu-caption");
    this.syncs.push(() => {
      const route = route_of();
      const loop = route?.closed !== false;
      for (const [id, button] of route_buttons) button.setAttribute("aria-checked", String(id === route?.id));
      for (const [count, button] of lap_buttons) {
        button.setAttribute("aria-checked", String(loop ? this.current.laps === count : count === 1));
        button.disabled = !loop && count !== 1;
      }
      note.textContent = loop ? "Everyone in the room starts together." : "A to B routes are one run, start to finish.";
      race.textContent = this.host.race_busy() ? "Leave race" : "Start race";
      record.textContent = this.host.lobby_record();
    });
    const race_tile = info("race", "Lobby race", picker, lap_row, note, race, record);

    const fresh = tile("new", "New room", "A fresh code, a map, an optional password", icon("icon-dice"), () => this.show("room"));
    return mosaic(MenuTab.ONLINE, room_tile, games, race_tile, fresh);
  }

  /** A world the player picked: remembered for the next bare load, then driven in this room. */
  private drive(seed: number, kind: WorldKind) {
    this.set("last_world", kind);
    this.set("last_seed", seed);
    if (seed === this.host.seed && kind === this.host.kind) return this.close();
    this.go(world_query(this.host.room, seed, kind));
  }

  private go(query: Record<string, string>) {
    mark_drive();
    location.search = `?${new URLSearchParams(query)}`;
  }

  private join(server: Server, password: string | null) {
    save_lock(server.room, password === null ? null : { password, asked: true });
    this.go(world_query(server.room, server.seed, kind_of_world(server.world)));
  }

  private games(): HTMLElement[] {
    const note = el("p", "servers-note");
    const list = el("ol", "servers-list");
    let list_key = "";

    const unlock = el("form", "servers-unlock");
    unlock.hidden = true;
    const unlock_label = el("span", "servers-unlock-label");
    const secret = password_input("Room password");
    const unlock_join = el("button", "settings-action", "Join");
    unlock_join.type = "submit";
    const unlock_cancel = action("Cancel", () => (unlock.hidden = true));
    const unlock_row = el("div", "settings-inline");
    unlock_row.append(secret, unlock_join, unlock_cancel);
    unlock.append(unlock_label, unlock_row);
    let locked: Server | null = null;
    unlock.addEventListener("submit", (event) => {
      event.preventDefault();
      const password = clean_password(secret.value);
      if (!locked || password === null) return invalid(secret, "Enter the room password");
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
    const password = password_input("Password");
    password.placeholder = "Optional, locks the room";
    const seed = el("input", "settings-input");
    seed.type = "text";
    seed.inputMode = "numeric";
    seed.maxLength = 10;
    seed.autocomplete = "off";
    seed.placeholder = "Random";
    seed.setAttribute("aria-label", "Map code");
    const submit = el("button", "settings-action", "Create room");
    submit.type = "submit";
    for (const input of [name, password, seed]) input.addEventListener("input", () => input.setCustomValidity(""));
    create.addEventListener("submit", (event) => {
      event.preventDefault();
      const room = name.value.trim() ? clean_room(name.value) : random_code();
      if (room === null) return invalid(name, `Up to ${ROOM_LENGTH} characters`);
      const lock = password.value ? clean_password(password.value) : null;
      if (password.value && lock === null) return invalid(password, `Up to ${PASSWORD_LENGTH} characters`);
      const map = seed.value.trim() ? parse_seed(seed.value.trim()) : random_seed();
      if (map === null) return invalid(seed, "A whole number from 0 to 4294967295");
      const named = lock === null ? room : locked_name(room);
      save_lock(named, lock === null ? null : { password: lock, asked: false });
      this.go({ room: named, seed: String(map) });
    });
    create.append(
      row("Room name", name),
      row("Password", password, "Locked rooms show a lock and get a short code on their name; only players with the password can connect"),
      row("Map code", seed, "Empty for a random map"),
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
    if (server.here && server.locked && this.host.password_failed()) li.append(action("Retry password", () => ask(server)));
    else if (server.here) li.append(el("span", "servers-tag", "You're here"));
    else if (server.version !== this.host.version) li.append(el("span", "servers-tag", "Different version"));
    else li.append(action("Join", () => (server.locked ? ask(server) : this.join(server, null))));
    return li;
  }

  private value<K extends SettingKey>(key: K): Value<SettingsState[K]> {
    if (this.recording && !this.recording.includes(key)) this.recording.push(key);
    return { get: () => this.current[key], set: (value) => this.set(key, value) };
  }

  private settings_page(): HTMLElement[] {
    const { sections, deep } = settings_sections(this.settings_menu);

    const nav = el("nav", "set-nav");
    nav.setAttribute("aria-label", "Settings sections");
    const foot = el("div", "set-foot");
    const changes = () => {
      const button = el("button", "set-changes", "What's new");
      button.type = "button";
      button.dataset.sub = CHANGES;
      return button;
    };
    const foot_changes = changes();
    const guide = el("button", "set-changes", "Guide");
    guide.type = "button";
    guide.title = "The first-run guide, with your current choices";
    guide.addEventListener("click", () => this.open_guide());
    foot.append(el("span", "", `v${this.host.version}`), guide, foot_changes);

    const back = el("button", "set-crumb");
    back.type = "button";
    back.dataset.action = "back";
    const back_label = el("span");
    back.append(icon("icon-back"), back_label);
    const title = el("h3", "set-title");
    const reset = el("button", "set-reset");
    reset.type = "button";
    reset.append(icon("icon-restart"), el("span", "", "Reset section"));
    reset.addEventListener("click", () => this.alt());
    const head = el("div", "set-head");
    head.append(back, title, changes(), reset);
    const main = el("div", "set-main");
    main.append(head);

    for (const section of sections) {
      const tab = el("button", "set-tab");
      tab.type = "button";
      tab.dataset.sub = section.id;
      const summary = el("small");
      this.syncs.push(() => (summary.textContent = section.summary()));
      tab.append(icon(section.icon), el("b", "", section.label), summary);
      nav.append(tab);
      const keys: SettingKey[] = [];
      this.recording = keys;
      const list = this.sub_list(section.id, section.label, section.rows());
      this.recording = null;
      main.append(list);
      this.subs.set(section.id, { label: section.label, parent: null, keys, tab, list, help: "" });
    }
    for (const page of deep) {
      const list = this.sub_list(page.id, page.label, page.rows());
      main.append(list);
      this.subs.set(page.id, { label: page.label, parent: page.parent, keys: [], tab: null, list, help: page.help });
    }
    const changes_list = this.sub_list(CHANGES, "What's new", [this.host.changelog()]);
    main.append(changes_list);
    this.subs.set(CHANGES, { label: "What's new", parent: null, keys: [], tab: foot_changes, list: changes_list, help: "Every release, newest first." });
    nav.append(foot);

    const help = el("aside", "set-help");
    help.setAttribute("aria-live", "polite");
    help.append(this.help_title, this.help_text, this.help_visual);

    const legend = el("div", "set-legend");
    for (const [glyphs, text] of [
      [["A"], "Select"],
      [["B"], "Back"],
      [["Y"], "Reset section"],
      [["LT", "RT"], "Section"],
      [["LB", "RB"], "Tab"],
    ] as const) {
      const hint = el("span");
      for (const glyph of glyphs) hint.append(el("kbd", glyph.length === 1 ? "pad-glyph pad-face" : "pad-glyph", glyph));
      hint.append(text);
      legend.append(hint);
    }

    this.syncs.push(() => {
      const sub = this.subs.get(this.sub);
      const parent = sub?.parent ? this.subs.get(sub.parent) : null;
      back.hidden = !parent;
      back_label.textContent = parent?.label ?? "";
      title.textContent = sub?.label ?? "";
      reset.hidden = !sub?.keys.length;
    });
    this.rows.on_focus = (row_help) => {
      this.help = row_help;
      this.render_help();
    };

    const root = el("div", "set");
    root.append(nav, main, help, legend);
    return [root];
  }

  private sub_list(id: string, label: string, rows: HTMLElement[]): HTMLElement {
    const list = el("section", "set-list");
    list.dataset.sub = id;
    list.setAttribute("aria-label", label);
    list.hidden = true;
    list.append(...rows);
    return list;
  }

  private show_sub(id: string) {
    const sub = this.subs.get(id);
    if (!sub) return;
    this.sub = id;
    const top = sub.parent ?? id;
    for (const [key, { tab, list }] of this.subs) {
      list.hidden = key !== id;
      tab?.setAttribute("aria-current", String(key === top));
    }
    sub.list.scrollTop = 0;
    this.help = this.rows.help_of(sub.list.querySelector(".row")) ?? { title: sub.label, text: sub.help };
    this.refresh();
  }

  step_sub(step: number) {
    if (this.section !== MenuTab.SETTINGS) return;
    const tops = [...this.subs].filter(([id, sub]) => sub.parent === null && id !== CHANGES).map(([id]) => id);
    const from = this.subs.get(this.sub)?.parent ?? this.sub;
    this.show_sub(tops[(tops.indexOf(from) + step + tops.length) % tops.length]);
  }

  alt() {
    if (this.section !== MenuTab.SETTINGS) return;
    const sub = this.subs.get(this.sub);
    if (!sub) return;
    for (const key of sub.keys) this.set(key, DEFAULT_SETTINGS[key]);
  }

  private render_help() {
    const help = this.help;
    this.help_title.textContent = help?.title ?? "";
    this.help_text.textContent = help ? read(help.text) : "";
    const visual = help?.visual?.() ?? null;
    this.help_visual.replaceChildren(...(visual ? [visual] : []));
  }

  private refresh() {
    for (const sync of this.syncs) sync();
    this.rows.refresh();
    this.render_help();
    this.root.toggleAttribute("data-pad", navigator.getGamepads().some((pad) => pad?.connected));
  }

  private readonly click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    if (event.target === this.root) return this.guide_open ? undefined : this.close();
    const button = event.target.closest<HTMLButtonElement>("button");
    if (!button) return;
    if (button.dataset.action === "close") return this.close();
    if (button.dataset.action === "back") return this.back();
    if (button.dataset.sub) return this.show_sub(button.dataset.sub);
    const section = button.dataset.section;
    if (!section) return;
    this.show(section);
  };

  private readonly key = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      return this.back();
    }
    if (typing(event.target)) return;
    const arrow = ARROW_NAV[event.key];
    // The garage drives its own arrows and Enter: left / right try parts on the car.
    if (arrow && this.section !== MenuTab.GARAGE) {
      event.preventDefault();
      return this.on_nav?.(arrow);
    }
    if (!event.repeat && (event.code === "KeyQ" || event.code === "KeyE")) this.step_tab(event.code === "KeyQ" ? -1 : 1);
  };
}

const ARROW_NAV: Record<string, Nav> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

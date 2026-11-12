import { modal_open, typing, type Nav } from "../hud/input";
import { clean_name } from "../net/net";
import { GUIDE_PARAM, Guide, ROLLED_VISIT, type GuideStep } from "./guide";
import { CareerPage } from "./career-view";
import { GoalsPage } from "./goals-view";
import { ModesPage } from "./modes-page";
import { OnlinePage } from "./online-page";
import { RoomPage } from "./room-page";
import { MenuTab, type Menu, type MenuPage, type SettingsHost, type SettingsMenu } from "./page";
import { DEFAULT_SETTINGS, type SettingKey, type SettingsState } from "./prefs";
import { mark_drive, read_saved, write_saved } from "./prefs-store";
import { picture } from "./widgets";
import { settings_sections } from "./settings-sections";
import { PlayPage } from "./play-page";
import { WorldPage } from "./world-page";
import { Rows, el, icon, read, type RowHelp, type Text, type Value } from "./setting-rows";
import { WorldKind } from "../worldgen/types";
import { GoTo, GoalId } from "../goals/goals";
import { mainland_seed, world_query } from "../world/world-pick";
import { custom_code } from "../worldgen/kinds/map-code";
import { warm_pick } from "./warm";
import { UpdateChip } from "./update";
import "./settings.css";
import "./menu.css";

interface SubPage {
  label: string;
  parent: string | null;
  keys: readonly SettingKey[];
  tab: HTMLButtonElement | null;
  list: HTMLElement;
  help: Text;
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

export class Settings {
  on_change: ((state: SettingsState, key: SettingKey) => void) | null = null;
  /** Arrow keys in the menu, handed to the pad's focus moves so both walk the same rows. */
  on_nav: ((nav: Nav) => void) | null = null;
  private readonly root = el("div", "settings");
  readonly panel = el("div", "settings-panel");
  private readonly body = el("div", "settings-body");
  private readonly menu_tabs = new Map<string, HTMLButtonElement>();
  private readonly pages = new Map<string, HTMLElement>();
  /** Pages whose content exists: each builds on first show, or on idle once `warm` runs. */
  private readonly built = new Set<string>();
  private warm_handle = 0;
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
      drive: (seed, kind, levels) => this.drive(seed, kind, levels),
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
      new PlayPage(this.menu, (to) => this.go_to(to)),
      {
        id: MenuTab.GARAGE,
        label: "Garage",
        build: () => [host.garage_stage],
        on_show: () => host.show_garage(true),
        on_hide: () => host.show_garage(false),
      },
      new OnlinePage(this.menu),
      { id: MenuTab.SETTINGS, label: "Settings", build: () => this.settings_page(), on_show: () => this.show_sub(this.sub) },
      new WorldPage(this.menu),
      new ModesPage(this.menu),
      new RoomPage(this.menu),
      new GoalsPage(this.menu, (to) => this.go_to(to)),
      ...(host.career ? [new CareerPage(this.menu, host.career)] : []),
    ];
    this.guide = new Guide({
      state: () => this.current,
      set: (key, value) => this.set(key, value),
      name: () => this.host.name(),
      kind: host.kind,
      picture: (name) => picture(name),
      car_code: () => host.car_code(),
      use_car: (code) => host.use_car(code),
      skip: () => this.end_guide(),
      drive: (kind) => {
        this.end_guide();
        this.drive(kind === WorldKind.MAINLAND ? mainland_seed(this.host, this.current.last_mainland_seed) : this.host.seed, kind);
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
    if (!this.is_open) this.attach();
    this.root.dataset.view = View.GUIDE;
    this.root.dataset.section = "guide";
    this.hide_pages();
    this.guide.start(step, rolled);
    this.panel.focus();
  }

  private end_guide() {
    this.mark_guide_seen();
    this.guide.stop();
    this.show(MenuTab.PLAY);
  }

  // A name left empty would roll a new random one on every reload, so the one shown in the guide sticks.
  private mark_guide_seen() {
    if (this.current.name === null) this.set("name", this.host.name());
    this.set("guide_seen", true);
  }

  /** Start on the pad: the guide skips to Play. */
  skip_guide() {
    if (this.guide_open) this.end_guide();
  }

  /** The menu, on Play unless a section is named. */
  open(section: string = MenuTab.PLAY) {
    if (!this.pages.has(section)) this.build_page(MenuTab.SETTINGS);
    if (this.subs.has(section)) {
      this.section = MenuTab.SETTINGS;
      this.sub = section;
    } else if (this.pages.has(section)) this.section = section;
    if (this.is_open) return this.show(this.section);
    this.attach();
    this.show(this.section);
    this.panel.focus();
  }

  // The guide covers the tabs, so opening on it leaves every page unbuilt and hidden.
  private attach() {
    if (!this.root.isConnected) this.parent.append(this.root);
    this.root.hidden = false;
    this.root.addEventListener("click", this.click);
    addEventListener("keydown", this.key);
    this.timer = window.setInterval(() => this.refresh(), STATUS_MS);
    this.refresh();
  }

  /** The key list: the help key lands here. */
  open_keys() {
    this.open("keys");
  }

  open_changes() {
    this.open(CHANGES);
  }

  close() {
    if (!this.is_open) return;
    if (this.guide_open) this.mark_guide_seen();
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
    const update_chip = new UpdateChip("menu-chip menu-update");
    update_chip.root.addEventListener("click", () => this.open_changes());
    this.syncs.push(() => {
      const state = this.host.update_state();
      if (update_chip.root.dataset.state !== state) update_chip.show(state);
    });
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
    top.append(brand, name_chip, update_chip.root, room, leave);

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
      page.hidden = true;
      this.body.append(page);
      this.pages.set(section.id, page);
    }
    this.guide.skip_button.dataset.guideOnly = "";
    top.append(this.guide.skip_button);
    this.panel.append(top, menu_nav, this.guide.rail, head, this.body, this.guide.panel);
  }

  private build_page(id: string) {
    const page = this.pages.get(id);
    const shown = this.page_of(id);
    if (!page || !shown || this.built.has(id)) return;
    this.built.add(id);
    page.append(...shown.build());
  }

  /** Builds the pages not yet shown in idle time, so opening one later costs no build. */
  warm() {
    this.stop_warm();
    const ids = this.page_list.map((p) => p.id);
    // One page per idle slot, and only when the slot outlasts its build, so a drive never drops a frame for it.
    const next = (deadline: IdleDeadline) => {
      const pick = warm_pick(ids, this.built, MenuTab.SETTINGS, deadline.timeRemaining());
      if (pick === "done") {
        this.warm_handle = 0;
        return;
      }
      if (pick !== "wait") this.build_page(pick);
      this.warm_handle = requestIdleCallback(next);
    };
    this.warm_handle = requestIdleCallback(next);
  }

  stop_warm() {
    cancelIdleCallback(this.warm_handle);
    this.warm_handle = 0;
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
    this.build_page(section);
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

  /** A world the player picked: remembered for the next bare load, then driven in this room. */
  private drive(seed: number, kind: WorldKind, levels: readonly number[] = []) {
    const code = custom_code({ seed, kind, levels });
    this.set("last_world", kind);
    this.set("last_seed", seed);
    this.set("last_map", code);
    if (kind === WorldKind.MAINLAND) this.set("last_mainland_seed", seed);
    if (seed !== this.host.seed) this.host.goals.done(GoalId.NEW_MAP);
    if (seed === this.host.seed && kind === this.host.kind && code === this.host.code) return this.close();
    this.go(world_query(this.host.room, seed, kind, code));
  }

  private go_to(to: GoTo) {
    if (to === GoTo.DRIVE) return this.close();
    if (to === GoTo.SKY) return this.drive(this.host.seed, WorldKind.SKY);
    this.open(to);
  }

  private go(query: Record<string, string>) {
    mark_drive();
    location.search = `?${new URLSearchParams(query)}`;
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
    reset.setAttribute("aria-label", "Reset section");
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
    // The garage drives its own arrows and Enter: left / right try parts on the car. A modal over it takes them back.
    if (arrow && (this.section !== MenuTab.GARAGE || modal_open())) {
      event.preventDefault();
      return this.on_nav?.(arrow);
    }
    if (!event.repeat && (event.code === "KeyQ" || event.code === "KeyE")) this.step_tab(event.code === "KeyQ" ? -1 : 1);
  };
}

const ARROW_NAV: Record<string, Nav> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

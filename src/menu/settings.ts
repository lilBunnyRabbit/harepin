import { flushSync } from "svelte";
import { modal_open, typing, type Nav } from "../hud/input";
import { clean_name } from "../net/net";
import WelcomePage from "./guide/WelcomePage.svelte";
import FinalCard from "../modes/FinalCard.svelte";
import { FINAL_PAGE } from "../modes/final";
import { SERIES_PAGE } from "../career/series";
import SeriesPage from "./SeriesPage.svelte";
import GoalsPage from "./GoalsPage.svelte";
import GuidePage from "./GuidePage.svelte";
import SupportPage from "./SupportPage.svelte";
import SettingsPage from "./settings-tab/SettingsPage.svelte";
import ChangesPage from "./settings-tab/ChangesPage.svelte";
import { GUIDE_PAGE } from "./guide-topics";
import ModesPage from "./ModesPage.svelte";
import RunsPage from "./runs/RunsPage.svelte";
import RunBuilder from "./runs/RunBuilder.svelte";
import CareerPage from "./CareerPage.svelte";
import EventsPage from "./EventsPage.svelte";
import { CAREER_PAGE, MODES_PAGE, RUNS_PAGE, RUN_BUILD_PAGE } from "./events-view";
import { TUNE_PARAM } from "../career/career";
import MeetPage from "./online/MeetPage.svelte";
import OnlinePage from "./online/OnlinePage.svelte";
import RoomPage from "./online/RoomPage.svelte";
import RoomsPage from "./online/RoomsPage.svelte";
import { MEET_PAGE, NEW_ROOM_PAGE, ROOMS_PAGE } from "./online/rooms";
import EmptyPage from "./EmptyPage.svelte";
import GaragePage from "./GaragePage.svelte";
import CarPickPage from "./CarPickPage.svelte";
import { CAR_PAGE, CarPicker } from "./car-pick.svelte";
import { svelte_page } from "./ui/svelte-page.svelte";
import { MenuTab, ROAD, STATIONS, type Menu, type MenuPage, type SettingsHost } from "./page";
import type { SettingKey, SettingsState } from "./prefs";
import type { CarShelf } from "../car/car-pick";
import { mark_drive, read_saved, write_saved } from "./prefs-store";
import { SettingsNav } from "./settings-tab/nav.svelte";
import { CHANGES, LIST } from "./settings-tab/sections";
import WorldPage from "./WorldPage.svelte";
import HomePage from "./HomePage.svelte";
import MapsPage from "./MapsPage.svelte";
import { MAKE_PAGE, MAPS_PAGE } from "./maps";
import TitlePage from "./showroom/TitlePage.svelte";
import { el, icon } from "./dom";
import { WorldKind } from "../worldgen/types";
import { GoTo, GoalId } from "../goals/goals";
import { world_query } from "../world/world-pick";
import { custom_code } from "../worldgen/kinds/map-code";
import { warm_pick } from "./warm";
import { CarStage } from "./showroom/car-stage";
import { Showroom, type StageRoom } from "./showroom/showroom";
import { TURNTABLE_SLACK, turntable } from "./showroom/turntable";
import "./showroom/showroom.css";
import "./settings.css";
import "./menu.css";

const TITLE = "title";
/** The car stands on the turntable only where the car is the subject; every other framed page shows the bare scene, no car. */
const STAGE_ROOMS: Partial<Record<string, StageRoom>> = { [TITLE]: "beside", [MenuTab.PLAY]: "beside", [MenuTab.GARAGE]: "around", [FINAL_PAGE]: "around" };
/** What the stage frames the car between: a page's own panels, and the frame's rows (their sides are named in `menu.css`). */
/** The first run's page. */
const WELCOME = "welcome";
const STAGE_PANELS = "[data-stage-panel], .ui-frame-top, .ui-frame-bottom";

const View = {
  /** A page that draws itself in the page frame: every station, and each child page once it is rebuilt. */
  FRAME: "frame",
  /** A child page not rebuilt yet, under the old Back bar. */
  PAGE: "page",
} as const;
type View = (typeof View)[keyof typeof View];

const STATUS_MS = 1000;

export class Settings {
  on_change: ((state: SettingsState, key: SettingKey) => void) | null = null;
  /** Arrow keys in the menu, handed to the pad's focus moves so both walk the same rows. */
  on_nav: ((nav: Nav) => void) | null = null;
  private readonly root = el("div", "settings");
  readonly panel = el("div", "settings-panel");
  private readonly body = el("div", "settings-body");
  private readonly pages = new Map<string, HTMLElement>();
  /** Pages whose content exists: each builds on first show, or on idle once `warm` runs. */
  private readonly built = new Set<string>();
  private warm_handle = 0;
  private readonly syncs: (() => void)[] = [];
  private readonly showroom: Showroom;
  private readonly title = el("h2", "settings-title");
  private readonly name_input = el("input");
  private saved: SettingsState;
  private timer = 0;
  private section: string = MenuTab.PLAY;
  /** The page each child page was opened from on this visit: Back returns there, not to the page's station. */
  private readonly openers = new Map<string, string>();
  /** The page a door was opened from (a Guide topic's "Open Driving settings"): Back on the door's page leads there again. */
  private door_from: string | null = null;
  private readonly menu: Menu;
  private readonly page_list: MenuPage[];
  private readonly nav: SettingsNav;
  private readonly picker = new CarPicker();
  private round: string | null = null;

  constructor(
    private readonly parent: HTMLElement,
    private readonly host: SettingsHost,
    private current: SettingsState,
  ) {
    this.saved = read_saved();
    this.menu = {
      host,
      state: () => this.current,
      set: (key, value) => this.set(key, value),
      sync: (run) => this.syncs.push(run),
      refresh: () => this.refresh(),
      close: () => this.close(),
      show: (section) => this.show(section),
      back: () => this.back(),
      up_of: (section) => this.up_of(section),
      drive: (seed, kind, levels) => this.drive(seed, kind, levels),
      go: (query) => this.go(query),
    };
    this.nav = new SettingsNav(
      (key, value) => this.set(key, value),
      () => this.current,
    );
    this.page_list = [
      ...STATIONS.map(({ id, label }) => (id === MenuTab.PLAY ? svelte_page(this.menu, { id, label }, HomePage, { picker: this.picker }) : id === MenuTab.GARAGE ? svelte_page(this.menu, { id, label }, GaragePage, { garage: host.garage, picker: this.picker }) : id === MenuTab.EVENTS ? svelte_page(this.menu, { id, label }, EventsPage, { picker: this.picker }) : id === MenuTab.SETTINGS ? svelte_page(this.menu, { id, label }, SettingsPage, { nav: this.nav }) : id === MenuTab.ONLINE ? svelte_page(this.menu, { id, label }, OnlinePage) : svelte_page(this.menu, { id, label }, EmptyPage, { id }))),
      svelte_page(this.menu, { id: GUIDE_PAGE, label: "Guide", parent: MenuTab.SETTINGS, layout: "frame" }, GuidePage, { open: (id: string) => this.open_door(id) }),
      svelte_page(this.menu, { id: CHANGES, label: "What's new", parent: MenuTab.SETTINGS, layout: "frame" }, ChangesPage),
      svelte_page(this.menu, { id: MenuTab.SUPPORT, label: "Support", parent: MenuTab.SETTINGS, layout: "frame" }, SupportPage),
      svelte_page(this.menu, { id: CAR_PAGE, label: "Car", parent: MenuTab.GARAGE, layout: "frame" }, CarPickPage, { picker: this.picker }),
      svelte_page(this.menu, { id: TITLE, label: "Harepin" }, TitlePage),
      svelte_page(this.menu, { id: WELCOME, label: "Welcome" }, WelcomePage, { seen: () => this.mark_guide_seen() }),
      svelte_page(this.menu, { id: FINAL_PAGE, label: "Season podium", parent: MenuTab.EVENTS, layout: "frame" }, FinalCard),
      svelte_page(this.menu, { id: MAPS_PAGE, label: "Maps", parent: MenuTab.PLAY, layout: "frame" }, MapsPage, { picker: this.picker }),
      svelte_page(this.menu, { id: MAKE_PAGE, label: "Make a map", parent: MenuTab.PLAY, layout: "frame" }, WorldPage),
      svelte_page(this.menu, { id: CAREER_PAGE, label: "Career", parent: MenuTab.EVENTS, layout: "frame" }, CareerPage, { picker: this.picker, tune: new URLSearchParams(location.search).has(TUNE_PARAM) }),
      svelte_page(this.menu, { id: RUNS_PAGE, label: "Runs", parent: MenuTab.EVENTS, layout: "frame" }, RunsPage, { picker: this.picker }),
      svelte_page(this.menu, { id: RUN_BUILD_PAGE, label: "Build a run", parent: MenuTab.EVENTS, layout: "frame" }, RunBuilder, { picker: this.picker }),
      svelte_page(this.menu, { id: MODES_PAGE, label: "Free modes", parent: MenuTab.EVENTS, layout: "frame" }, ModesPage),
      svelte_page(this.menu, { id: "goals", label: "Things to try", parent: MenuTab.EVENTS, layout: "frame" }, GoalsPage, { go: (to: GoTo) => this.go_to(to) }),
      svelte_page(this.menu, { id: SERIES_PAGE, label: "Harepin Series", parent: MenuTab.EVENTS, layout: "frame" }, SeriesPage, { picker: this.picker, asked: () => this.take_round() }),
      svelte_page(this.menu, { id: NEW_ROOM_PAGE, label: "New room", parent: MenuTab.ONLINE, layout: "frame" }, RoomPage),
      svelte_page(this.menu, { id: ROOMS_PAGE, label: "Other rooms", parent: MenuTab.ONLINE, layout: "frame" }, RoomsPage),
      svelte_page(this.menu, { id: MEET_PAGE, label: "Race meet", parent: MenuTab.ONLINE, layout: "frame" }, MeetPage, { picker: this.picker }),
    ];
    const canvas = el("canvas", "showroom-stage");
    this.showroom = new Showroom(new CarStage(canvas, { floor: turntable(), slack: TURNTABLE_SLACK }), {
      build: () => host.garage.shown,
      panels: () => [...this.root.querySelectorAll<HTMLElement>(STAGE_PANELS)],
    });
    host.garage.stand_on(this.showroom);
    this.root.hidden = true;
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.setAttribute("aria-label", "Menu");
    this.panel.tabIndex = -1;
    this.build();
    this.root.append(canvas, this.panel);
  }

  get state(): SettingsState {
    return this.current;
  }

  get is_open(): boolean {
    return !this.root.hidden;
  }

  /** The showroom's car stands on the turntable, or a bare room shows no car: either way the world's own car hides. */
  get staged(): boolean {
    return this.showroom.hides_world_car;
  }

  get guide_open(): boolean {
    return this.is_open && this.section === WELCOME;
  }

  /** The first run: a name, then one step of set up, before the road teaches the rest. */
  open_guide() {
    this.open(WELCOME);
  }

  // A name left empty would roll a new random one on every reload, so the one shown in the guide sticks.
  private mark_guide_seen() {
    if (this.current.name === null) this.set("name", this.host.name());
    this.set("guide_seen", true);
  }

  /** Start on the pad: the first run goes straight to the road. */
  skip_guide() {
    if (this.guide_open) this.close();
  }

  /** The Series page on a round's start sheet: a road result's Next. */
  open_round(id: string) {
    this.round = id;
    this.open(SERIES_PAGE);
  }

  private take_round(): string | null {
    const id = this.round;
    this.round = null;
    return id;
  }

  /** The menu, on Home unless a section is named. */
  open(section: string = MenuTab.PLAY) {
    if (this.nav.has(section)) {
      this.section = MenuTab.SETTINGS;
      this.nav.show(section);
    } else if (this.pages.has(section)) this.section = section;
    if (this.is_open) return this.show(this.section, null);
    this.attach();
    this.show(this.section, null);
    this.panel.focus();
  }

  private open_door(id: string) {
    const from = this.section;
    this.open(id);
    if (this.section === from) return;
    this.door_from = from;
    this.refresh();
  }

  // The guide covers the pages, so opening on it leaves every page unbuilt and hidden.
  private attach() {
    if (!this.root.isConnected) this.parent.append(this.root);
    this.root.hidden = false;
    this.root.addEventListener("click", this.click);
    addEventListener("keydown", this.key);
    this.timer = window.setInterval(() => this.refresh(), STATUS_MS);
    this.refresh();
  }

  /** The boot screen: the wordmark, the car and one Continue card. */
  open_title() {
    this.open(TITLE);
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
    this.host.updates_closed();
    this.root.hidden = true;
    this.root.removeEventListener("click", this.click);
    removeEventListener("keydown", this.key);
    clearInterval(this.timer);
    this.hide_pages();
    this.showroom.hide();
    this.openers.clear();
  }

  private hide_pages() {
    for (const page of this.page_list) page.on_hide?.();
  }

  toggle() {
    if (this.is_open) this.close();
    else this.open();
  }

  focus_name() {
    if (this.guide_open) this.pages.get(WELCOME)?.querySelector("input")?.focus();
  }

  page(): HTMLElement {
    return (this.section === MenuTab.SETTINGS ? this.nav.list : null) ?? this.pages.get(this.section) ?? this.body;
  }

  /** One level up: a page returns to the page it was opened from (else its station), a station closes the menu. */
  back() {
    const door = this.door_from;
    // A settings section takes Back itself, to the list: one reached through a door goes back through it instead.
    if (door && this.section === MenuTab.SETTINGS && this.nav.sub !== LIST && !this.nav.parent()) return this.show(door, null);
    if (this.page_of(this.section)?.back?.()) return;
    const deep = this.section === MenuTab.SETTINGS ? this.nav.parent() : null;
    if (deep) return this.nav.show(deep);
    const up = this.up_id(this.section);
    if (up) this.show(up, null);
    else this.close();
  }

  private up_id(section: string): string | undefined {
    return (section === this.section ? this.door_from : null) ?? this.openers.get(section) ?? this.page_of(section)?.parent;
  }

  private up_of(section: string): string {
    const up = this.up_id(section);
    return (up && this.page_of(up)?.label) ?? ROAD;
  }

  // A page reached again from deeper down keeps its first opener, so Back never walks in a loop.
  private note_opener(section: string, opener: string | null) {
    if (opener === null || opener === section || !this.page_of(section)?.parent) return;
    for (let at: string | undefined = opener; at; at = this.openers.get(at)) if (at === section) return;
    this.openers.set(section, opener);
  }

  /** Q / E, LB / RB: the next station. A child page shows no station bar, so the keys stay its own. */
  step_tab(step: number) {
    if (this.section === MenuTab.SETTINGS && this.nav.sub !== LIST) return;
    if (this.section === CAR_PAGE) return this.picker.on_step?.(step);
    const at = STATIONS.findIndex((station) => station.id === this.section);
    if (at >= 0) this.show(STATIONS[(at + step + STATIONS.length) % STATIONS.length].id, null);
  }

  set<K extends SettingKey>(key: K, value: SettingsState[K]) {
    if (this.current[key] === value) return;
    this.current = { ...this.current, [key]: value };
    this.saved = { ...this.saved, [key]: value };
    write_saved(this.saved);
    this.refresh();
    this.on_change?.(this.current, key);
  }

  private build() {
    const top = el("div", "menu-top");
    const brand = el("span", "menu-brand");
    brand.append(icon("logo-mark"), el("span", "", "Harepin"));
    const name_chip = el("label", "menu-chip menu-name");
    name_chip.title = "Your name: everyone in the room sees it";
    name_chip.append(this.name_field(), icon("icon-edit"));
    top.append(brand, name_chip);

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
    this.panel.append(top, head, this.body);
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

  /** `opener` is the page this one is reached from, null when going back, stepping stations or opening the menu. */
  private show(section: string, opener: string | null = this.section) {
    this.door_from = null;
    this.note_opener(section, opener);
    this.build_page(section);
    this.section = section;
    const view = this.view_of(section);
    this.root.dataset.view = view;
    this.root.dataset.section = section;
    for (const [id, page] of this.pages) page.hidden = id !== section;
    const shown = this.page_of(section);
    if (view === View.PAGE) this.root.dataset.layout = shown?.layout ?? "column";
    else delete this.root.dataset.layout;
    this.title.textContent = shown?.label ?? "";
    this.body.scrollTop = 0;
    for (const page of this.page_list) if (page !== shown) page.on_hide?.();
    shown?.on_show?.();
    this.refresh();
    // The pad focuses the page's first control right after this returns: a page mounted just now binds its rows in effects.
    flushSync();
    if (view === View.FRAME) this.showroom.show(STAGE_ROOMS[section] ?? "bare");
    else this.showroom.hide();
  }

  private page_of(section: string): MenuPage | undefined {
    return this.page_list.find((page) => page.id === section);
  }

  private view_of(section: string): View {
    const page = this.page_of(section);
    return page?.parent && page.layout !== "frame" ? View.PAGE : View.FRAME;
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

  /**
   * The car picker page, over the road or from the page that asked. Settles with the car's code, or null when backed
   * out, closed or aborted; the menu then returns to where the ask came from.
   */
  async pick_car(title: string, limit: string, shelves: readonly CarShelf[], signal: AbortSignal, note = `For ${title}.`): Promise<string | null> {
    if (signal.aborted) return null;
    const from = this.is_open && this.section !== CAR_PAGE ? this.section : null;
    const abort = () => this.picker.end(null);
    signal.addEventListener("abort", abort, { once: true });
    const asked = this.picker.open({ title, limit, shelves, note, back: from ? (this.page_of(from)?.label ?? ROAD) : ROAD });
    if (from) this.show(CAR_PAGE);
    else this.open(CAR_PAGE);
    const code = await asked;
    signal.removeEventListener("abort", abort);
    // A newer ask holds the page now: it decides where the menu goes.
    if (!this.picker.open_ask && this.is_open) {
      if (!from) this.close();
      else if (this.section === CAR_PAGE) this.back();
    }
    return signal.aborted ? null : code;
  }

  step_sub(step: number) {
    if (this.section === MenuTab.SETTINGS) this.nav.step(step);
  }

  alt() {
    if (this.section === MenuTab.SETTINGS) this.nav.reset();
  }

  private refresh() {
    for (const sync of this.syncs) sync();
    this.showroom.sync();
    this.root.toggleAttribute("data-pad", navigator.getGamepads().some((pad) => pad?.connected));
  }

  private readonly click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const action = event.target.closest<HTMLButtonElement>("button[data-action]")?.dataset.action;
    if (action === "close") this.close();
    else if (action === "back") this.back();
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

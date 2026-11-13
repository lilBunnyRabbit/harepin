import { tick } from "svelte";
import { DECALS, DEFAULT_BUILD, MAX_NUMBER, build_code, parse_build, type Build } from "../car/build";
import { free_build_name, load_builds, store_builds, with_build, without_build, type SavedBuild } from "../car/builds";
import { CARS } from "../car/cars";
import { PRESETS } from "../car/presets";
import { NO_UNLOCKS, type Reward, type Unlocks } from "../career/rewards";
import { modal_open, typing, type Nav } from "../hud/input";
import { save_build } from "./garage-builds";
import { BUILDS_TAB, TABS, car_value, type Item } from "./garage-items";
import { GarageStage } from "./garage-stage";
import { strip_key } from "./garage-strip-key";

const KEY_NAV: Record<string, Nav> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "accept",
  NumpadEnter: "accept",
};

export type GarageInput = "pad" | "keys";

export interface GarageView {
  canvas: HTMLCanvasElement;
  panels(): HTMLElement[];
  sheet(): HTMLElement | null;
}

export class Garage {
  on_change: ((build: Build) => void) | null = null;
  on_save: (() => void) | null = null;
  /** The garage is the menu's Garage tab: LB / RB and Back belong to the menu. */
  on_tab: ((step: number) => void) | null = null;
  on_back: (() => void) | null = null;
  /** Career rewards earned: the garage lists only these of the reward paints and decals. */
  rewards: () => Unlocks = () => NO_UNLOCKS;

  current = $state.raw<Build>(DEFAULT_BUILD);
  tab = $state(1);
  item = $state.raw<Item>(TABS[1].items(DEFAULT_BUILD, NO_UNLOCKS)[0]);
  cursor = $state(0);
  builds = $state.raw<SavedBuild[]>(load_builds());
  renaming = $state<string | null>(null);
  input = $state<GarageInput>("keys");
  centred = $state(0);
  private opened = $state(false);
  // `rewards` reads career stars outside the runes, so each open bumps this to relist reward paints and decals.
  private relist = $state(0);
  private view: GarageView | null = null;
  private stage: GarageStage | null = null;

  constructor(build: Build) {
    this.current = build;
  }

  get build(): Build {
    return this.current;
  }

  get is_open(): boolean {
    return this.opened;
  }

  get code(): string {
    return build_code(this.current);
  }

  get items(): Item[] {
    void this.relist;
    return TABS[this.tab].items(this.current, this.rewards());
  }

  get on_builds(): boolean {
    return this.tab === BUILDS_TAB;
  }

  get shown(): Build {
    return this.cursor === this.item.at(this.current) ? this.current : this.item.with(this.current, this.cursor);
  }

  get strip_key(): string {
    return strip_key(this.item, this.tab, this.current);
  }

  attach(view: GarageView) {
    this.view = view;
    this.stage = new GarageStage(view.canvas);
    if (this.opened) this.start();
  }

  use_code(code: string, save = true) {
    const build = parse_build(code);
    if (build) this.apply(build, save);
  }

  open() {
    if (this.opened) return;
    this.opened = true;
    this.relist++;
    this.input = navigator.getGamepads?.().some((pad) => pad?.connected) ? "pad" : "keys";
    addEventListener("keydown", this.key);
    addEventListener("resize", this.resized);
    const items = this.items;
    this.item = items.find((item) => item.id === this.item.id) ?? items[0] ?? this.item;
    this.builds = load_builds();
    this.cursor = this.item.at(this.current);
    this.start();
  }

  close() {
    if (!this.opened) return;
    this.opened = false;
    this.stage?.stop();
    removeEventListener("keydown", this.key);
    removeEventListener("resize", this.resized);
  }

  try_reward(reward: Reward) {
    if (!this.opened || reward.kind === "badge") return;
    this.relist++;
    const paint = reward.kind === "paint";
    const section = paint ? "paint" : "body";
    const { rewards } = reward.tier;
    const value = paint ? rewards.paint : reward.kind === "car" ? car_value(rewards.car) : DECALS.indexOf(rewards.decal ?? "none");
    this.tab = TABS.findIndex((tab) => tab.section === section);
    const item = this.items.find((it) => it.id === reward.kind);
    if (item) {
      this.select(item);
      const option = item.values?.indexOf(value) ?? value;
      if (option >= 0) this.preview(option);
    }
    this.reframe();
  }

  navigate(presses: readonly Nav[]) {
    if (!presses.length) return;
    this.input = "pad";
    for (const nav of presses) this.act(nav);
  }

  switch_tab(tab: number) {
    this.tab = (tab + TABS.length) % TABS.length;
    this.renaming = null;
    const first = this.items[0];
    if (first) this.select(first);
    this.reframe();
  }

  select(item: Item) {
    this.item = item;
    this.cursor = item.at(this.current);
    this.stage?.aim(item.view);
  }

  preview(option: number) {
    this.cursor = option;
  }

  fit(option: number, centre = true) {
    this.cursor = option;
    this.apply(this.item.with(this.current, option));
    if (centre) this.centred++;
  }

  step_number(by: number) {
    this.fit((this.cursor + by + MAX_NUMBER + 1) % (MAX_NUMBER + 1));
  }

  load(code: string | undefined) {
    const build = parse_build(code);
    if (build) this.apply(build);
  }

  load_preset(index: number) {
    this.use_code(PRESETS[index]?.code ?? "");
  }

  save_build(typed: string): boolean {
    const name = typed.trim() || free_build_name(this.builds, CARS[this.current.car].name);
    const next = with_build(this.builds, name, build_code(this.current));
    if (!next || !store_builds(next)) return false;
    this.on_save?.();
    this.builds = next;
    if (this.tab !== BUILDS_TAB) this.switch_tab(BUILDS_TAB);
    return true;
  }

  store(next: SavedBuild[] | null): string | null {
    if (!next) return "Another build has that name";
    if (!store_builds(next)) return "This browser refused to store it";
    this.builds = next;
    this.renaming = null;
    return null;
  }

  delete_build(name: string) {
    this.store(without_build(this.builds, name));
  }

  private start() {
    if (!this.stage || !this.opened) return;
    this.stage.start(this.item.view);
    this.stage.show(this.shown);
    this.reframe();
  }

  draw() {
    if (this.opened) this.stage?.show(this.shown);
  }

  private act(nav: Nav) {
    if (!this.opened) return;
    if (nav === "back") return this.on_back?.();
    if (nav === "prev" || nav === "next") return this.on_tab?.(nav === "prev" ? -1 : 1);
    if (nav === "sub_prev" || nav === "sub_next") return this.switch_tab(this.tab + (nav === "sub_prev" ? -1 : 1));
    if (nav === "alt") return void this.save_build("");
    if (this.tab === BUILDS_TAB) return this.builds_focus(nav);
    const items = this.items;
    const index = Math.max(0, items.findIndex((item) => item.id === this.item.id));
    if (nav === "up" || nav === "down") this.select(items[(index + (nav === "up" ? -1 : 1) + items.length) % items.length]);
    else if (nav === "left" || nav === "right") {
      const step = nav === "left" ? -1 : 1;
      const count = this.item.count;
      this.preview(this.item.kind === "number" ? (this.cursor + step + count) % count : Math.max(0, Math.min(count - 1, this.cursor + step)));
    } else if (nav === "accept") this.fit(this.cursor);
  }

  // My builds is a short list of fields and buttons, so the pad walks it in reading order on real focus.
  private builds_focus(nav: Nav) {
    const sheet = this.view?.sheet();
    if (!sheet) return;
    const items = [...sheet.querySelectorAll<HTMLElement>("button, input")].filter((el) => el.checkVisibility());
    const at = items.findIndex((el) => el === document.activeElement);
    if (nav === "accept") {
      if (at >= 0) items[at].click();
      else items[0]?.focus({ focusVisible: true });
      return;
    }
    const step = nav === "up" || nav === "left" ? -1 : 1;
    items[at < 0 ? 0 : Math.max(0, Math.min(items.length - 1, at + step))]?.focus({ focusVisible: true });
  }

  private readonly key = (event: KeyboardEvent) => {
    const nav = KEY_NAV[event.code];
    if (!nav || event.repeat || event.altKey || event.ctrlKey || event.metaKey || modal_open()) return;
    if (typing(event.target) && (nav !== "accept" || this.tab === BUILDS_TAB)) return;
    event.preventDefault();
    this.input = "keys";
    this.act(nav);
  };

  private apply(next: Build, save = true) {
    const checked = parse_build(build_code(next));
    if (!checked || build_code(checked) === build_code(this.current)) return;
    this.current = checked;
    // Paint and decal options list the fitted value even when it is a reward not earned, so they change with the build.
    this.item = this.items.find((item) => item.id === this.item.id) ?? this.item;
    this.cursor = this.item.at(checked);
    if (save) save_build(checked);
    this.on_change?.(checked);
  }

  private reframe() {
    void tick().then(this.resized);
  }

  private readonly resized = () => {
    if (this.opened && this.view) this.stage?.resize(this.view.panels());
  };
}

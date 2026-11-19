import { tick } from "svelte";
import { DECALS, DEFAULT_BUILD, MAX_NUMBER, WHOLE_CAR, build_code, parse_build, type Build, type SlotView } from "../car/build";
import { free_build_name, load_builds, store_builds, with_build, without_build, type SavedBuild } from "../car/builds";
import { CARS, type CarId } from "../car/cars";
import { PRESETS } from "../car/presets";
import type { CarLocks } from "../car/car-pick";
import { body_price, frame_locks, frame_of, owned_frames } from "../career/frames";
import { COSMETIC_PRICE, part_price } from "../career/prices";
import type { PartPick, ShopItem, Wallet } from "../career/wallet";
import { NO_UNLOCKS, type Reward, type Unlocks } from "../career/rewards";
import { typing, type Nav } from "../hud/input";
import { modal_open } from "../hud/modals";
import { save_build } from "./garage-builds";
import { garage_items, own_parts, pick_label, strip_unowned, type Item } from "./garage-items";

const KEY_NAV: Record<string, Nav> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "accept",
  NumpadEnter: "accept",
  KeyC: "alt",
  KeyB: "sub_prev",
};

export type GarageInput = "pad" | "keys";

export interface GarageView {
  sheet(): HTMLElement | null;
}

/** The showroom's stage the garage stands its car on: it draws `Garage.shown` and frames it between the page's panels. */
export interface GarageStage {
  aim(view: SlotView): void;
  sync(): void;
  reframe(): void;
}

/** A build loaded onto the player's own car without the parts it wanted that they don't own yet. */
export interface MissingParts {
  readonly build: Build;
  readonly parts: readonly PartPick[];
  readonly price: number;
}

export class Garage {
  on_change: ((build: Build) => void) | null = null;
  on_save: (() => void) | null = null;
  /** The garage is the menu's Garage tab: LB / RB and Back belong to the menu. */
  on_tab: ((step: number) => void) | null = null;
  on_back: (() => void) | null = null;
  /** Change car: the picker takes over, and its pick comes back through `use_code`. */
  on_pick_car: (() => void) | null = null;
  /** Career rewards earned: the garage lists only these of the reward paints and decals. */
  rewards: () => Unlocks = () => NO_UNLOCKS;
  /** The cars the player was given, by a cup or a career tier: each owns its frame. */
  given: () => readonly CarId[] = () => [];
  /** What the shop pays from; null sells nothing. */
  wallet: Wallet | null = null;
  on_notice: ((text: string) => void) | null = null;

  current = $state.raw<Build>(DEFAULT_BUILD);
  /** The card shows the saved builds instead of a slot's options. */
  on_builds = $state(false);
  item = $state.raw<Item>(garage_items(DEFAULT_BUILD, NO_UNLOCKS)[0]);
  cursor = $state(0);
  builds = $state.raw<SavedBuild[]>(load_builds());
  renaming = $state<string | null>(null);
  /** What the Builds card's "A friend's code" field holds; a build offered from chat lands here. */
  friend_code = $state("");
  input = $state<GarageInput>("keys");
  missing = $state.raw<MissingParts | null>(null);
  private opened = $state(false);
  // `rewards` reads career stars outside the runes, so each open bumps this to relist reward paints and decals.
  private relist = $state(0);
  private view: GarageView | null = null;
  /** The player's own car while a meet has lent them another. */
  private own_code: string | null = null;
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
    return garage_items(this.current, this.rewards());
  }

  /** Reward cars the player holds: a preset on one lists only then. */
  get held_cars(): readonly CarId[] {
    void this.relist;
    return this.rewards().cars;
  }

  get locks(): CarLocks {
    void this.relist;
    return frame_locks(this.given());
  }

  get credits(): number {
    void this.relist;
    return this.wallet?.credits ?? 0;
  }

  /** What an option of the open slot costs, or null when it is free or bought. */
  price(option: number): number | null {
    void this.relist;
    const slot = this.item.slot;
    if (slot) return this.part_owned({ slot, index: option }) ? null : part_price(slot, option);
    const id = this.item.cosmetic?.(option);
    if (!id || !this.wallet || this.wallet.has(id)) return null;
    return COSMETIC_PRICE[id] ?? null;
  }

  bought(option: number): boolean {
    void this.relist;
    const slot = this.item.slot;
    return slot !== undefined && this.wallet !== null && this.own_code === null && part_price(slot, option) > 0 && this.part_owned({ slot, index: option });
  }

  // A car lent at a meet tunes free: it goes back after the race.
  private part_owned(pick: PartPick): boolean {
    return !this.wallet || this.own_code !== null || this.wallet.owns_part(this.current.car, pick);
  }

  private shop_item(option: number): ShopItem | null {
    const slot = this.item.slot;
    if (slot) return { kind: "parts", car: this.current.car, parts: [{ slot, index: option }] };
    const id = this.item.cosmetic?.(option);
    return id ? { kind: "cosmetic", id } : null;
  }

  /** The fitted car's body, when its frame is owned and the body is for sale but not bought yet. */
  get body_price(): number | null {
    return this.car_price(this.current.car);
  }

  /** A body for sale on a frame the player owns, not bought yet; null otherwise. */
  car_price(car: CarId): number | null {
    void this.relist;
    const given = this.given();
    return owned_frames(given).has(frame_of(car)) && !given.includes(car) ? body_price(car) : null;
  }

  buy(option: number): boolean {
    const item = this.shop_item(option);
    const price = this.price(option);
    if (!item || price === null || !this.wallet?.buy(item, price)) return false;
    this.relist++;
    this.fit(option);
    return true;
  }

  buy_missing(): boolean {
    const missing = this.missing;
    if (!missing || !this.wallet?.buy({ kind: "parts", car: missing.build.car, parts: missing.parts }, missing.price)) return false;
    this.relist++;
    this.apply({ ...this.current, parts: missing.build.parts });
    return true;
  }

  /** The car loaded at boot (the saved build, a `?car=` link) wears only bought parts once the wallet has read. */
  check_owned() {
    if (this.own_code === null) this.apply(this.current);
  }

  buy_body(): boolean {
    return this.buy_car(this.current.car);
  }

  buy_car(car: CarId): boolean {
    const price = this.car_price(car);
    if (price === null || !this.wallet?.buy({ kind: "car", car }, price)) return false;
    this.relist++;
    return true;
  }

  get shown(): Build {
    return this.cursor === this.item.at(this.current) ? this.current : this.item.with(this.current, this.cursor);
  }

  attach(view: GarageView) {
    this.view = view;
  }

  stand_on(stage: GarageStage) {
    this.stage = stage;
  }

  use_code(code: string, save = true) {
    if (save) this.own_code = null;
    const build = parse_build(code);
    if (build) this.apply(build, save);
  }

  /** A race meet races any frame: a car the player doesn't own is lent, unsaved, until `take_back` returns their own. */
  meet_pick(code: string) {
    const build = parse_build(code);
    if (!build) return;
    if (!this.locks[build.car]) {
      this.own_code = null;
      return this.apply(build);
    }
    this.own_code ??= this.code;
    this.apply(build, false);
  }

  take_back() {
    if (this.own_code === null) return;
    const code = this.own_code;
    this.own_code = null;
    this.use_code(code, false);
  }

  open() {
    if (this.opened) return;
    this.opened = true;
    this.relist++;
    this.input = navigator.getGamepads?.().some((pad) => pad?.connected) ? "pad" : "keys";
    addEventListener("keydown", this.key);
    const items = this.items;
    this.item = items.find((item) => item.id === this.item.id) ?? items[0] ?? this.item;
    this.builds = load_builds();
    this.cursor = this.item.at(this.current);
    this.stage?.aim(this.item.view);
    this.reframe();
  }

  /** Leaves the stage on the fitted car, turned to the whole of it, for the stations that stand it next. */
  close() {
    if (!this.opened) return;
    this.opened = false;
    this.on_builds = false;
    this.renaming = null;
    this.friend_code = "";
    this.missing = null;
    this.cursor = this.item.at(this.current);
    this.stage?.aim(WHOLE_CAR);
    this.stage?.sync();
    removeEventListener("keydown", this.key);
  }

  /** A build from chat while a run is up: shown in the friend's code field, fitted only when the player loads it. */
  offer(code: string) {
    if (!this.opened) return;
    this.on_builds = true;
    this.renaming = null;
    this.friend_code = code;
  }

  /** A reward just earned, tried on the car: a paint or decal as its option, a car through the picker. */
  try_reward(reward: Reward) {
    if (!this.opened || reward.kind === "badge") return;
    if (reward.kind === "car") return this.on_pick_car?.();
    this.relist++;
    const { rewards } = reward.tier;
    const value = reward.kind === "paint" ? rewards.paint : DECALS.indexOf(rewards.decal ?? "none");
    const item = this.items.find((it) => it.id === reward.kind);
    if (!item) return;
    this.select(item);
    const option = item.values?.indexOf(value) ?? value;
    if (option !== undefined && option >= 0) this.preview(option);
  }

  navigate(presses: readonly Nav[]) {
    if (!presses.length) return;
    this.input = "pad";
    for (const nav of presses) this.act(nav);
  }

  toggle_builds() {
    this.on_builds = !this.on_builds;
    this.renaming = null;
    this.cursor = this.item.at(this.current);
  }

  select(item: Item) {
    this.on_builds = false;
    this.item = item;
    this.cursor = item.at(this.current);
    this.stage?.aim(item.view);
  }

  step_slot(by: number) {
    const items = this.items;
    const at = Math.max(0, items.findIndex((item) => item.id === this.item.id));
    this.select(items[(at + by + items.length) % items.length]);
  }

  preview(option: number) {
    this.cursor = option;
  }

  /** A sold option not bought yet only shows: `buy` fits it. */
  fit(option: number) {
    this.cursor = option;
    if (this.price(option) !== null) return;
    this.apply(this.item.with(this.current, option));
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

  draw() {
    if (this.opened) this.stage?.sync();
  }

  private act(nav: Nav) {
    if (!this.opened) return;
    if (nav === "back") return this.on_back?.();
    if (nav === "prev" || nav === "next") return this.on_tab?.(nav === "prev" ? -1 : 1);
    if (nav === "alt") return this.on_pick_car?.();
    if (nav === "sub_prev") return this.toggle_builds();
    if (this.on_builds) return this.builds_focus(nav);
    if (nav === "left" || nav === "right") this.step_slot(nav === "left" ? -1 : 1);
    else if (nav === "up" || nav === "down") {
      const step = nav === "up" ? -1 : 1;
      const count = this.item.count;
      this.preview(this.item.kind === "number" ? (this.cursor + step + count) % count : Math.max(0, Math.min(count - 1, this.cursor + step)));
    } else if (nav === "accept") {
      if (this.price(this.cursor) === null) this.fit(this.cursor);
      else this.buy(this.cursor);
    }
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
    if (typing(event.target) && (nav !== "accept" || this.on_builds)) return;
    event.preventDefault();
    this.input = "keys";
    this.act(nav);
  };

  private apply(next: Build, save = true) {
    // A build code (a saved build, chat, a paste) can wear a decal, neon or parts the player hasn't bought: their own car drops them.
    const wallet = save && this.own_code === null && this.wallet?.ready ? this.wallet : null;
    const { build: dressed, dropped } = wallet ? strip_unowned(next, (id) => wallet.has(id)) : { build: next, dropped: [] };
    const { build: own, missing } = wallet ? own_parts(dressed, (pick) => wallet.owns_part(dressed.car, pick)) : { build: dressed, missing: [] };
    this.missing = missing.length && !this.locks[own.car] ? { build: next, parts: missing, price: missing.reduce((sum, pick) => sum + part_price(pick.slot, pick.index), 0) } : null;
    const notes = [...(dropped.length ? [`${dropped.join(", ")} not owned: removed`] : []), ...(missing.length ? [`${missing.map(pick_label).join(", ")} not owned: fitted the best you own`] : [])];
    if (notes.length) this.on_notice?.(notes.join(" · "));
    const checked = parse_build(build_code(own));
    if (!checked || build_code(checked) === build_code(this.current)) return;
    this.current = checked;
    // Paint and decal options list the fitted value even when it is a reward not earned, so they change with the build.
    this.item = this.items.find((item) => item.id === this.item.id) ?? this.item;
    this.cursor = this.item.at(checked);
    if (save && this.own_code === null) save_build(checked);
    this.on_change?.(checked);
  }

  private reframe() {
    void tick().then(() => {
      if (this.opened) this.stage?.reframe();
    });
  }
}

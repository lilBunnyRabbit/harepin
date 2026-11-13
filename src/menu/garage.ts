import { DECALS, DEFAULT_BUILD, MAX_NUMBER, build_code, parse_build, type Build } from "../car/build";
import { free_build_name, load_builds, store_builds, with_build, without_build, type SavedBuild } from "../car/builds";
import { CARS } from "../car/cars";
import { PRESETS } from "../car/presets";
import { livery_of } from "../car/livery";
import { modal_open, typing, type Nav } from "../hud/input";
import { paint_finish, paint_lab } from "../car/paint";
import { NO_UNLOCKS, type Reward, type Unlocks } from "../career/rewards";
import { color, decal_inks, rgba } from "../theme/palette";
import { confirm_tap, render_builds, save_build } from "./garage-builds";
import { build_badge } from "./class-badge";
import { BUILDS_TAB, GarageSection, TABS, type Item } from "./garage-items";
import { strip_key } from "./garage-strip-key";
import { StatMeters } from "./garage-meters";
import { GarageStage } from "./garage-stage";
import { decal_tile, glyph, hint, icon } from "./garage-widgets";
import { el } from "./setting-rows";
import { COPIED_MS } from "./widgets";
import "./garage.css";

const KEY_NAV: Record<string, Nav> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "accept",
  NumpadEnter: "accept",
};

export class Garage {
  on_change: ((build: Build) => void) | null = null;
  on_save: (() => void) | null = null;
  /** The garage is the menu's Garage tab: LB / RB and Back belong to the menu. */
  on_tab: ((step: number) => void) | null = null;
  on_back: (() => void) | null = null;
  /** Career rewards earned: the garage lists only these of the reward paints and decals. */
  rewards: () => Unlocks = () => NO_UNLOCKS;
  private builds: SavedBuild[] = load_builds();
  private renaming: string | null = null;
  private readonly root = el("div", "garage");
  private readonly canvas = el("canvas", "garage-canvas");
  private readonly top = el("header", "garage-top");
  private readonly car_name = el("span", "garage-sub");
  private readonly tabs = el("nav", "garage-tabs");
  private readonly rail = el("nav", "garage-panel garage-rail");
  private readonly panel = el("section", "garage-panel garage-stats");
  private readonly bottom = el("section", "garage-bottom");
  private readonly strip_head = el("div", "garage-strip-head");
  private readonly strip = el("div", "garage-strip");
  private readonly number_input = el("input", "garage-number");
  private readonly stage = new GarageStage(this.canvas);
  private readonly stats = new StatMeters(this.panel);
  private strip_key = "";
  private tab = 1;
  private item: Item = TABS[1].items(DEFAULT_BUILD, NO_UNLOCKS)[0];
  private cursor = 0;
  private readonly calm = matchMedia("(prefers-reduced-motion: reduce)");

  constructor(
    private readonly parent: HTMLElement,
    private current: Build,
  ) {
    this.root.hidden = true;
    this.root.setAttribute("role", "region");
    this.root.setAttribute("aria-label", "Garage");
    this.root.dataset.input = "keys";
    this.top.append(this.car_name, this.tabs);

    const hints = el("div", "garage-hints");
    hints.append(hint("Slot / part", "move"), hint("Fit", "accept"), hint("Sections", "prev", "next"));
    this.bottom.append(this.strip_head, this.strip, hints);

    this.number_input.type = "text";
    this.number_input.inputMode = "numeric";
    this.number_input.maxLength = 2;
    this.number_input.size = 2;
    this.number_input.setAttribute("aria-label", "Number");
    this.number_input.addEventListener("input", this.typed);

    this.root.append(this.canvas, this.top, this.rail, this.panel, this.bottom);
  }

  get build(): Build {
    return this.current;
  }

  get is_open(): boolean {
    return !this.root.hidden;
  }

  get code(): string {
    return build_code(this.current);
  }

  use_code(code: string, save = true) {
    const build = parse_build(code);
    if (build) this.apply(build, save);
    if (this.is_open) this.refresh();
  }

  /** On `section`, or the tab it was last left on. */
  open(section: GarageSection | null = null) {
    if (this.is_open) return;
    if (section) this.tab = Math.max(0, TABS.findIndex((tab) => tab.section === section));
    if (!this.root.isConnected) this.parent.append(this.root);
    this.root.hidden = false;
    this.root.dataset.input = navigator.getGamepads?.().some((pad) => pad?.connected) ? "pad" : "keys";
    this.root.addEventListener("click", this.click);
    this.root.addEventListener("pointerover", this.hover);
    this.strip.addEventListener("pointerleave", this.unhover);
    addEventListener("keydown", this.key);
    addEventListener("resize", this.resized);
    const items = this.items();
    this.item = items.find((item) => item.id === this.item.id) ?? items[0] ?? this.item;
    this.builds = load_builds();
    this.cursor = this.item.at(this.current);
    this.stage.start(this.item.view);
    this.refresh();
    this.resized();
  }

  /** On the open garage: a career reward tried on the car, not fitted. A badge has no garage option. */
  try_reward(reward: Reward) {
    if (!this.is_open || reward.kind === "badge") return;
    const paint = reward.kind === "paint";
    const section = paint ? GarageSection.PAINT : GarageSection.BODY;
    const value = paint ? reward.tier.rewards.paint : DECALS.indexOf(reward.tier.rewards.decal ?? "none");
    this.tab = TABS.findIndex((tab) => tab.section === section);
    const item = this.items().find((it) => it.id === reward.kind);
    if (!item) return this.refresh();
    this.select(item);
    const option = item.values?.indexOf(value) ?? value;
    if (option >= 0) this.preview(option);
    this.resized();
  }

  close() {
    if (!this.is_open) return;
    this.root.hidden = true;
    this.root.removeEventListener("click", this.click);
    this.root.removeEventListener("pointerover", this.hover);
    this.strip.removeEventListener("pointerleave", this.unhover);
    this.stage.stop();
    removeEventListener("keydown", this.key);
    removeEventListener("resize", this.resized);
    this.stats.stop();
  }

  /** Pad menu presses from `Input.nav`, once per game frame while open. */
  navigate(presses: readonly Nav[]) {
    if (!presses.length) return;
    this.root.dataset.input = "pad";
    for (const nav of presses) this.act(nav);
  }

  private act(nav: Nav) {
    if (!this.is_open) return;
    if (nav === "back") return this.on_back?.();
    if (nav === "prev" || nav === "next") return this.on_tab?.(nav === "prev" ? -1 : 1);
    if (nav === "sub_prev" || nav === "sub_next") return this.switch_tab(this.tab + (nav === "sub_prev" ? -1 : 1));
    if (nav === "alt") return this.save_build("");
    if (this.tab === BUILDS_TAB) return this.builds_focus(nav);
    const items = this.items();
    const index = Math.max(0, items.findIndex((item) => item.id === this.item.id));
    if (nav === "up" || nav === "down") this.select(items[(index + (nav === "up" ? -1 : 1) + items.length) % items.length]);
    else if (nav === "left" || nav === "right") {
      const step = nav === "left" ? -1 : 1;
      const count = this.item.count;
      this.preview(this.item.kind === "number" ? (this.cursor + step + count) % count : Math.max(0, Math.min(count - 1, this.cursor + step)));
    } else if (nav === "accept") this.fit(this.cursor);
  }

  private switch_tab(tab: number) {
    this.tab = (tab + TABS.length) % TABS.length;
    this.renaming = null;
    const first = this.items()[0];
    if (first) this.select(first);
    else this.refresh();
    this.resized();
  }

  // My builds is a short list of fields and buttons, so the pad walks it in reading order on real focus.
  private builds_focus(nav: Nav) {
    const items = [...this.rail.querySelectorAll<HTMLElement>("button, input")].filter((el) => el.checkVisibility());
    const active = document.activeElement;
    const at = items.findIndex((el) => el === active);
    if (nav === "accept") {
      if (at >= 0) items[at].click();
      else items[0]?.focus({ focusVisible: true });
      return;
    }
    const step = nav === "up" || nav === "left" ? -1 : 1;
    items[at < 0 ? 0 : Math.max(0, Math.min(items.length - 1, at + step))]?.focus({ focusVisible: true });
  }

  private save_build(typed: string) {
    const name = typed.trim() || free_build_name(this.builds, CARS[this.current.car].name);
    const next = with_build(this.builds, name, build_code(this.current));
    if (!next || !store_builds(next)) return;
    this.on_save?.();
    this.builds = next;
    this.tab = BUILDS_TAB;
    this.refresh();
    this.resized();
  }

  private load_code(field: HTMLInputElement) {
    const build = parse_build(field.value.trim());
    if (!build) {
      field.setCustomValidity("That isn't a build code");
      field.reportValidity();
      return;
    }
    this.apply(build);
    this.refresh();
  }

  private store(next: SavedBuild[] | null, field: HTMLInputElement | null = null) {
    if (next && store_builds(next)) {
      this.builds = next;
      this.renaming = null;
      return this.refresh();
    }
    field?.setCustomValidity(next ? "This browser refused to store it" : "Another build has that name");
    field?.reportValidity();
  }

  private select(item: Item) {
    this.item = item;
    this.cursor = item.at(this.current);
    this.stage.aim(item.view);
    this.refresh();
  }

  private preview(option: number) {
    if (option === this.cursor) return;
    this.cursor = option;
    this.refresh();
  }

  private fit(option: number, centre = true) {
    this.cursor = option;
    this.apply(this.item.with(this.current, option));
    this.refresh();
    if (centre) this.centre_fitted(this.calm.matches ? "instant" : "smooth");
  }

  // A fitted card sits mid-strip, so a phone's narrow strip shows the options either side of it, not only those before.
  private centre_fitted(behavior: ScrollBehavior) {
    this.strip.querySelector("[aria-pressed='true']")?.scrollIntoView({ block: "nearest", inline: "center", behavior });
  }

  private readonly click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>("[data-action]");
    if (!target) return;
    const { action, value } = target.dataset;
    const n = Number(value);
    if (action === "tab") this.switch_tab(n);
    else if (action === "load-build") {
      const build = parse_build(this.builds.find((b) => b.name === value)?.code);
      if (build) this.apply(build);
      this.refresh();
    } else if (action === "load-preset") this.use_code(PRESETS[n]?.code ?? "");
    else if (action === "rename-build") {
      this.renaming = value ?? null;
      this.refresh();
      this.rail.querySelector<HTMLInputElement>(".garage-rename input")?.focus();
    } else if (action === "cancel-rename") {
      this.renaming = null;
      this.refresh();
    } else if (action === "delete-build" && value) {
      if (confirm_tap(target)) this.store(without_build(this.builds, value));
    }
    else if (action === "copy-code") this.copy_code(target);
    else if (action === "item") {
      const item = this.items().find((it) => it.id === value);
      if (item) this.select(item);
    } else if (action === "option") {
      // A mouse click leaves the strip still: sliding it would put another card under the pointer and preview that one.
      this.fit(n, !(event instanceof PointerEvent && event.pointerType === "mouse"));
    }
    else if (action === "step") this.fit((this.cursor + n + MAX_NUMBER + 1) % (MAX_NUMBER + 1));
  };

  // Hover previews like the pad cursor does; a tap fits straight away through `click`, so touch never sees a preview.
  private readonly hover = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
    const card = event.target.closest<HTMLElement>("[data-action='option']");
    if (card) this.preview(Number(card.dataset.value));
  };

  private readonly unhover = (event: PointerEvent) => {
    if (event.pointerType === "mouse") this.preview(this.item.at(this.current));
  };

  private readonly typed = () => {
    const digits = this.number_input.value.replace(/\D/g, "");
    if (digits !== this.number_input.value) this.number_input.value = digits;
    if (digits) this.fit(Number(digits));
  };

  private async copy_code(button: HTMLElement) {
    const code = build_code(this.current);
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = "Copied";
    } catch (error) {
      console.warn("garage: clipboard refused", error);
      button.textContent = "Copy failed";
    }
    setTimeout(() => (button.textContent = "Copy"), COPIED_MS);
  }

  private readonly key = (event: KeyboardEvent) => {
    const nav = KEY_NAV[event.code];
    if (!nav || event.repeat || event.altKey || event.ctrlKey || event.metaKey || modal_open()) return;
    if (typing(event.target) && (nav !== "accept" || this.tab === BUILDS_TAB)) return;
    event.preventDefault();
    this.root.dataset.input = "keys";
    this.act(nav);
  };

  private apply(next: Build, save = true) {
    const checked = parse_build(build_code(next));
    if (!checked || build_code(checked) === build_code(this.current)) return;
    this.current = checked;
    // Paint and decal options list the fitted value even when it is a reward not earned, so they change with the build.
    this.item = this.items().find((item) => item.id === this.item.id) ?? this.item;
    this.cursor = this.item.at(checked);
    if (save) save_build(checked);
    this.on_change?.(checked);
  }

  /** The build the screen shows: the fitted one with the cursor's option tried on. */
  private get shown(): Build {
    return this.cursor === this.item.at(this.current) ? this.current : this.item.with(this.current, this.cursor);
  }

  private items(): Item[] {
    return TABS[this.tab].items(this.current, this.rewards());
  }

  private refresh() {
    const shown = this.shown;
    const builds = this.tab === BUILDS_TAB;
    this.root.dataset.tab = TABS[this.tab].section;
    this.car_name.textContent = CARS[shown.car].name;
    this.render_tabs();
    if (builds) this.render_builds();
    else this.render_rail();
    if (!builds) this.render_strip(shown);
    this.stats.render(this.current, shown);
    this.stage.show(shown);
  }

  private render_tabs() {
    this.tabs.replaceChildren(
      glyph("prev"),
      ...TABS.map((tab, i) => {
        const button = el("button", "garage-tab", tab.label);
        button.type = "button";
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(i === this.tab));
        button.dataset.action = "tab";
        button.dataset.value = String(i);
        return button;
      }),
      glyph("next"),
    );
  }

  private render_rail() {
    this.rail.replaceChildren(
      ...this.items().map((item) => {
        const button = el("button", "garage-slot");
        button.type = "button";
        button.dataset.action = "item";
        button.dataset.value = item.id;
        button.setAttribute("aria-label", item.label);
        if (item.id === this.item.id) button.setAttribute("aria-current", "true");
        button.append(icon(item.id), el("small", "garage-slot-label", item.label), el("b", "garage-slot-part", item.name(item.at(this.current))));
        return button;
      }),
    );
  }

  private render_builds() {
    render_builds(
      this.rail,
      { builds: this.builds, renaming: this.renaming, current: this.current },
      { save: (name) => this.save_build(name), load_code: (field) => this.load_code(field), store: (next, field) => this.store(next, field) },
    );
  }


  private render_strip(shown: Build) {
    const item = this.item;
    const fitted = item.at(this.current);
    const livery = livery_of(shown);
    this.strip.style.setProperty("--decal-paint", rgba(paint_lab(shown.paint)));
    this.strip.style.setProperty("--decal-ink", livery.ink.getStyle());
    this.strip.style.setProperty("--decal-mark", livery.mark.getStyle());
    this.strip.style.setProperty("--decal-key", livery.key ? livery.key.getStyle() : "transparent");

    const swapped = DECALS[shown.decal] !== "none" && !livery.ink.equals(color(decal_inks[shown.ink % decal_inks.length]));
    const head: (Node | string)[] = [icon(item.id), el("b", "", item.label)];
    if (item.kind !== "number") head.push(` · ${this.cursor + 1} of ${item.count}`);
    if ((item.kind === "decal" || item.kind === "ink") && swapped) head.push(" · auto-contrast");
    if (this.cursor !== fitted) head.push(hint("Fit", "accept"));
    this.strip_head.replaceChildren(...head);

    const key = strip_key(item, this.tab, this.current);
    const fresh = key !== this.strip_key;
    if (fresh) {
      this.strip_key = key;
      this.strip.dataset.kind = item.kind;
      // A new slot's cards start from the strip's start, not the last slot's scroll; the fitted one is then centred at once.
      this.strip.scrollLeft = 0;
      if (item.kind === "number") {
        const card = el("div", "garage-card garage-stepper");
        const step = (label: string, value: string, aria: string) => {
          const button = el("button", "garage-step", label);
          button.type = "button";
          button.dataset.action = "step";
          button.dataset.value = value;
          button.setAttribute("aria-label", aria);
          return button;
        };
        card.append(step("−", "-1", "Number down"), this.number_input, step("+", "1", "Number up"));
        this.strip.replaceChildren(card);
      } else
        this.strip.replaceChildren(
          ...Array.from({ length: item.count }, (_, i) => {
            const card = el("button", "garage-card");
            card.type = "button";
            card.dataset.action = "option";
            card.dataset.value = String(i);
            if (item.kind === "paint" || item.kind === "ink") {
              const swatch = el("i", "garage-swatch");
              const paint = item.with(this.current, i).paint;
              swatch.style.setProperty("--swatch", rgba(item.kind === "paint" ? paint_lab(paint) : decal_inks[i]));
              swatch.toggleAttribute("data-metal", item.kind === "paint" && paint_finish(paint) !== null);
              card.append(swatch);
            }
            if (item.kind === "decal") card.append(decal_tile(DECALS[item.with(this.current, i).decal]));
            const name = el("b", "garage-card-name", item.name(i));
            if (item.kind === "car") {
              const head = el("span", "garage-card-head");
              head.append(name, build_badge(item.with(this.current, i)));
              card.append(head);
            } else card.append(name);
            const blurb = item.blurb(i);
            if (blurb) card.append(el("span", "garage-card-blurb", blurb));
            return card;
          }),
        );
    }
    for (const text of this.strip.querySelectorAll(".decal-number")) text.textContent = String(shown.number);
    if (item.kind === "number") {
      if (document.activeElement !== this.number_input) this.number_input.value = item.name(this.cursor);
      this.strip.firstElementChild?.classList.toggle("is-cursor", this.cursor !== fitted);
      return;
    }
    for (const card of this.strip.children) {
      if (!(card instanceof HTMLElement)) continue;
      const i = Number(card.dataset.value);
      card.setAttribute("aria-pressed", String(i === fitted));
      card.classList.toggle("is-cursor", i === this.cursor);
      if (i === this.cursor && !fresh) card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: this.calm.matches ? "instant" : "smooth" });
    }
    if (fresh) this.centre_fitted("instant");
  }


  /** Frames the car in the part of the screen the panels leave clear. */
  private readonly resized = () => {
    if (this.is_open) this.stage.resize([this.top, this.rail, this.panel, this.bottom]);
  };

}

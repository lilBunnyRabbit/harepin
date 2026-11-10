import type { Chat } from "../net/chat";
import { $ } from "../hud/hud";
import type { Nav } from "../hud/input";
import { ADJUST_EVENT } from "./setting-rows";
import type { Settings } from "./settings";

// Controls inside a menu row carry tabindex -1: the row holds focus and they stay click targets only.
const FOCUSABLE = ":is(button, input, select, textarea, a[href], [tabindex]):not([tabindex='-1'])";
// Borders and focus outlines make neighbours overlap by a few px; they still count as the next row or column.
const OVERLAP_PX = 4;
const SIDE_WEIGHT = 2;

type Direction = "up" | "down" | "left" | "right";

interface Layer {
  roots: Element[];
  back(): void;
  tab?(step: number): HTMLElement | null;
  sub?(step: number): HTMLElement | null;
  alt?(): void;
  first(): HTMLElement | null;
}

export interface PadMenuHost {
  settings: Settings;
  chat: Chat;
  garage_open(): boolean;
}

function candidates(roots: Element[]): HTMLElement[] {
  return roots
    .flatMap((root) => [root, ...root.querySelectorAll(FOCUSABLE)])
    .filter((el): el is HTMLElement => el instanceof HTMLElement && el.matches(FOCUSABLE) && !el.matches(":disabled") && !el.closest("[inert]") && el.checkVisibility({ visibilityProperty: true }));
}

const first_of = (...roots: Element[]) => candidates(roots)[0] ?? null;

const gap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, b0 - a1, a0 - b1);

function nearest(from: HTMLElement, items: HTMLElement[], dir: Direction): HTMLElement | null {
  const f = from.getBoundingClientRect();
  const vertical = dir === "up" || dir === "down";
  const group = from.closest("nav, section");
  let best: HTMLElement | null = null;
  let best_rank = [Infinity, Infinity];
  for (const item of items) {
    if (item === from) continue;
    const r = item.getBoundingClientRect();
    const ahead = { down: r.top - f.bottom, up: f.top - r.bottom, right: r.left - f.right, left: f.left - r.right }[dir];
    const beyond = { down: r.top + r.bottom > f.top + f.bottom, up: r.top + r.bottom < f.top + f.bottom, right: r.left + r.right > f.left + f.right, left: r.left + r.right < f.left + f.right }[dir];
    if (!beyond || ahead < -OVERLAP_PX) continue;
    const side = vertical ? gap(f.left, f.right, r.left, r.right) : gap(f.top, f.bottom, r.top, r.bottom);
    // Staying in the same nav or section beats leaving it, however close: the settings tabs sit beside the page, and a
    // tall control (the world map) would otherwise hand down-presses to the next tab.
    const rank = [group && item.closest("nav, section") !== group ? 1 : 0, Math.max(0, ahead) + side * SIDE_WEIGHT];
    if (rank[0] < best_rank[0] || (rank[0] === best_rank[0] && rank[1] < best_rank[1])) {
      best = item;
      best_rank = rank;
    }
  }
  return best;
}

function focus(el: HTMLElement | null) {
  el?.focus({ focusVisible: true });
}

// A select only commits on A: the theme select reloads the page on change.
function adjust(el: Element | null, step: number): boolean {
  if (el instanceof HTMLElement && el.dataset.adjust !== undefined) {
    el.dispatchEvent(new CustomEvent(ADJUST_EVENT, { detail: step }));
    return true;
  }
  if (el instanceof HTMLInputElement && el.type === "range") {
    if (step > 0) el.stepUp();
    else el.stepDown();
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  if (el instanceof HTMLSelectElement) {
    el.selectedIndex = Math.max(0, Math.min(el.length - 1, el.selectedIndex + step));
    return true;
  }
  return false;
}

function settle(el: Element | null) {
  if (!(el instanceof HTMLSelectElement)) return;
  const chosen = [...el.options].findIndex((option) => option.defaultSelected);
  if (chosen >= 0) el.selectedIndex = chosen;
}

/**
 * The pad through every menu outside the garage, on real focus: d-pad and left stick move, A clicks, B backs out, LB / RB
 * switch tabs. Start opens the main menu, or the HUD bar while a card there waits for an answer (mode result, update,
 * join their map), and shuts whatever is open.
 */
export class PadMenu {
  private hud_open = false;
  private last: HTMLElement | null = null;
  private readonly rotate = $("rotate");
  private readonly chat_panel = $("chat-panel");

  constructor(private readonly host: PadMenuHost) {}

  get is_open(): boolean {
    return this.hud_open || this.overlay() !== null;
  }

  toggle() {
    if (this.rotated()) return;
    const { settings } = this.host;
    if (settings.guide_open) {
      settings.skip_guide();
      return focus(first_of(settings.page()));
    }
    if (this.is_open || settings.is_open) return this.close_all();
    if (!this.card_waiting()) {
      settings.open();
      return focus(first_of(settings.page()));
    }
    this.hud_open = true;
    const layer = this.hud();
    const held = document.activeElement;
    focus(held instanceof HTMLElement && candidates(layer.roots).includes(held) ? held : layer.first());
  }

  navigate(presses: readonly Nav[]) {
    if (this.rotated()) return;
    this.keep_hud();
    const layer = this.layer();
    if (!layer) return;
    for (const nav of presses) {
      if (nav === "back") return layer.back();
      if (nav === "accept") return this.accept(layer);
      if (nav === "prev" || nav === "next") {
        focus(layer.tab?.(nav === "prev" ? -1 : 1) ?? null);
        continue;
      }
      if (nav === "sub_prev" || nav === "sub_next") {
        focus(layer.sub?.(nav === "sub_prev" ? -1 : 1) ?? null);
        continue;
      }
      if (nav === "alt") {
        layer.alt?.();
        continue;
      }
      const current = document.activeElement;
      const items = candidates(layer.roots);
      if (!(current instanceof HTMLElement) || !items.includes(current)) {
        focus(layer.first());
        continue;
      }
      if ((nav === "left" || nav === "right") && adjust(current, nav === "left" ? -1 : 1)) continue;
      const next = nearest(current, items, nav);
      if (!next) continue;
      settle(current);
      focus(next);
    }
  }

  private accept(layer: Layer) {
    const target = document.activeElement;
    if (!(target instanceof HTMLElement) || !candidates(layer.roots).includes(target)) return focus(layer.first());
    if (target instanceof HTMLSelectElement) {
      target.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (target instanceof HTMLInputElement && target.type !== "submit" && target.type !== "button") return;
    const play = layer.roots[0] === this.host.settings.panel || !this.overlay();
    target.click();
    const opened = target instanceof HTMLButtonElement ? (target.popoverTargetElement ?? document.getElementById(target.getAttribute("aria-controls") ?? "")) : null;
    // A popover can rebuild its contents on its own `toggle` event, after this; focus waits for that.
    if (opened?.matches(":popover-open")) opened.addEventListener("toggle", () => focus(first_of(opened)), { once: true });
    else if (opened?.checkVisibility() && !opened.contains(document.activeElement)) focus(first_of(opened));
    if (this.host.garage_open()) return;
    const above = this.overlay();
    if (above && above.roots[0] !== layer.roots[0]) {
      const landed = document.activeElement;
      if (!opened && !(landed instanceof HTMLElement && candidates(above.roots).includes(landed))) focus(above.first());
      return;
    }
    // main.ts blurs every clicked button; a pick that stays on screen keeps the ring, one that took its menu away starts play.
    if (target.isConnected && target.checkVisibility()) {
      if (document.activeElement === document.body) focus(target);
    } else if (play) this.close_hud();
  }

  private hud(): Layer {
    const roots = [document.querySelector(".update-toast"), $("mode-result"), document.querySelector(".dock-top .top-left"), document.querySelector(".actions"), document.querySelector(".assists"), $("restart-lap")].filter((root) => root !== null);
    return { roots, back: () => this.close_hud(), first: () => first_of(...roots) };
  }

  private overlay(): Layer | null {
    const { settings, chat } = this.host;
    if (settings.is_open)
      return {
        roots: [settings.panel],
        back: () => {
          settings.back();
          if (settings.is_open) focus(first_of(settings.page()));
        },
        tab: (step) => {
          settings.step_tab(step);
          return first_of(settings.page());
        },
        sub: (step) => {
          settings.step_sub(step);
          return first_of(settings.page());
        },
        alt: () => settings.alt(),
        first: () => first_of(settings.page()) ?? first_of(settings.panel),
      };
    if (chat.is_open && this.chat_panel.contains(document.activeElement)) return { roots: [this.chat_panel], back: () => chat.close(), first: () => first_of(this.chat_panel) };
    return null;
  }

  private layer(): Layer | null {
    return this.overlay() ?? (this.hud_open ? this.hud() : null);
  }

  private keep_hud() {
    if (!this.hud_open || this.overlay() || this.host.garage_open()) return;
    const layer = this.hud();
    const items = candidates(layer.roots);
    const current = document.activeElement;
    if (current instanceof HTMLElement && items.includes(current)) {
      this.last = current;
      return;
    }
    if (current && current !== document.body) return this.close_hud();
    const back_to = this.last && items.includes(this.last) ? this.last : layer.first();
    if (back_to) focus(back_to);
    else this.close_hud();
  }

  private close_hud() {
    this.hud_open = false;
    this.last = null;
    const current = document.activeElement;
    if (current instanceof HTMLElement) current.blur();
  }

  private close_all() {
    this.host.settings.close();
    if (this.host.chat.is_open && this.chat_panel.contains(document.activeElement)) this.host.chat.close();
    this.close_hud();
  }

  private card_waiting(): boolean {
    return [$("mode-result"), document.querySelector(".update-toast")].some((card) => card instanceof HTMLElement && card.checkVisibility());
  }

  private rotated(): boolean {
    return this.rotate.checkVisibility();
  }
}

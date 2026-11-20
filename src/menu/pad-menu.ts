import type { Chat } from "../net/chat";
import { $ } from "../hud/hud";
import type { Nav } from "../hud/input";
import { modal_open, top_modal } from "../hud/modals";
import { ROTATE_QUERY, rotate_shown } from "../hud/orientation";
import { ADJUST_EVENT, HOLD_EVENT } from "./dom";
import { first_spot, walk_step, type Spot } from "./focus-walk";
import type { Settings } from "./settings";

// Controls inside a menu row carry tabindex -1: the row holds focus and they stay click targets only.
const FOCUSABLE = ":is(button, input, select, textarea, a[href], [tabindex]):not([tabindex='-1'])";
// The page frame's station bar: Q / E and LB / RB step it, so focus never starts there and no arrow lands there.
const STATION_BAR = ".ui-frame-stations";
// A focused block's content this close to its scroller's edge counts as shown.
const OVERLAP_PX = 4;
/** Share of the visible height one up or down press scrolls a focused block taller than its scroller. */
const SCROLL_STEP = 0.4;
/** The pad button behind `accept` in `PAD_NAV` (`hud/input.ts`): a hold button stays pressed while it is down. */
const ACCEPT_BUTTON = 0;

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
  notice(text: string): void;
  pad(): Gamepad | null;
}

function candidates(roots: Element[]): HTMLElement[] {
  return roots
    .flatMap((root) => [root, ...root.querySelectorAll(FOCUSABLE)])
    .filter((el): el is HTMLElement => el instanceof HTMLElement && el.matches(FOCUSABLE) && !el.matches(":disabled") && !el.closest("[inert]") && el.checkVisibility({ visibilityProperty: true }));
}

// A page's autofocus control leads, as in a modal: the Series strip, so left / right turn cards from the first press.
function first_of(...roots: Element[]): HTMLElement | null {
  const items = candidates(roots);
  return items.find((item) => item.autofocus) ?? items[first_spot(spots(items))] ?? null;
}

function spots(items: HTMLElement[]): Spot[] {
  return items.map((item) => {
    const { left, top, right, bottom } = item.getBoundingClientRect();
    return { left, top, right, bottom, group: item.closest("nav, section"), bar: item.closest(STATION_BAR) !== null };
  });
}

function scroller(el: HTMLElement): HTMLElement | null {
  for (let at: HTMLElement | null = el; at; at = at.parentElement) {
    if (at.scrollHeight > at.clientHeight && /auto|scroll/.test(getComputedStyle(at).overflowY)) return at;
  }
  return null;
}

// A focused block with content past the scroller's edge (the changelog, the key list) scrolls before focus moves on.
function scroll_within(el: HTMLElement, dir: "up" | "down"): boolean {
  const box = scroller(el);
  if (!box) return false;
  const r = el.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const end = box.scrollHeight - box.clientHeight - box.scrollTop;
  const hidden = dir === "down" ? Math.min(end, box === el ? end : r.bottom - b.bottom) : Math.min(box.scrollTop, box === el ? box.scrollTop : b.top - r.top);
  if (hidden <= OVERLAP_PX) return false;
  box.scrollBy({ top: (dir === "down" ? 1 : -1) * Math.min(hidden, box.clientHeight * SCROLL_STEP) });
  return true;
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
 * switch tabs. Start opens the main menu, or the HUD bar while a card there waits for an answer (mode result or update),
 * and shuts whatever is open.
 */
export class PadMenu {
  private hud_open = false;
  private last: HTMLElement | null = null;
  /** The hold button A pressed, released when A comes up. */
  private holding: HTMLElement | null = null;
  private readonly rotate = matchMedia(ROTATE_QUERY);
  private readonly chat_panel = $("chat-panel");

  constructor(private readonly host: PadMenuHost) {}

  /** Read on every input poll, so it never builds a layer to answer. */
  get is_open(): boolean {
    const { settings, chat } = this.host;
    return this.hud_open || modal_open() || settings.is_open || (chat.is_open && this.chat_panel.contains(document.activeElement));
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
    this.release();
    if (presses.length === 0 && !this.hud_open) return;
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
      if ((nav === "up" || nav === "down") && scroll_within(current, nav)) continue;
      const next = items[walk_step(items.indexOf(current), spots(items), nav)];
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
    // A pad press is not user activation, so a new-tab link would be popup-blocked; the ring stays for a tap or click.
    if (target instanceof HTMLAnchorElement && target.target === "_blank") return this.host.notice("Tap or click the link to open it");
    if (target.dataset.hold !== undefined) return this.press(target);
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

  private press(target: HTMLElement) {
    this.holding = target;
    target.dispatchEvent(new CustomEvent(HOLD_EVENT, { detail: true }));
  }

  private release() {
    const { holding } = this;
    if (!holding || this.host.pad()?.buttons[ACCEPT_BUTTON]?.pressed) return;
    this.holding = null;
    holding.dispatchEvent(new CustomEvent(HOLD_EVENT, { detail: false }));
  }

  private hud(): Layer {
    const roots = [document.querySelector(".update-toast"), $("mode-result"), document.querySelector(".event-card"), document.querySelector(".lab-strip"), document.querySelector(".assists"), $("restart-lap"), $("online-chip")].filter((root) => root !== null);
    return { roots, back: () => this.close_hud(), first: () => first_of(...roots) };
  }

  private overlay(): Layer | null {
    const { settings, chat } = this.host;
    const modal = top_modal();
    if (modal) return { roots: [modal], back: () => modal.close(), first: () => modal.querySelector<HTMLElement>("[autofocus]") ?? first_of(modal) };
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
    // A hold that started play took its card away with the focus: play goes on, as after a pick in `accept`.
    if (this.last && !this.last.checkVisibility()) return this.close_hud();
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
    top_modal()?.close();
    this.host.settings.close();
    if (this.host.chat.is_open && this.chat_panel.contains(document.activeElement)) this.host.chat.close();
    this.close_hud();
  }

  card_waiting(): boolean {
    // The feel lab's strip waits the whole session: Start reaches its Trials, Retry and Stop, and the menu button beside them.
    // At a flag Start reaches the event card's cars and its hold button.
    return [$("mode-result"), document.querySelector(".update-toast"), document.querySelector(".lab-strip"), document.querySelector(".event-card")].some((card) => card instanceof HTMLElement && card.checkVisibility());
  }

  private rotated(): boolean {
    return rotate_shown(this.rotate.matches, this.host.settings.is_open);
  }
}

import type { Chat } from "../net/chat";
import { $ } from "../hud/hud";
import type { Nav } from "../hud/input";
import { ROTATE_QUERY, rotate_shown } from "../hud/orientation";
import { ADJUST_EVENT, HOLD_EVENT } from "./dom";
import type { Settings } from "./settings";

// Controls inside a menu row carry tabindex -1: the row holds focus and they stay click targets only.
const FOCUSABLE = ":is(button, input, select, textarea, a[href], [tabindex]):not([tabindex='-1'])";
// Borders and focus outlines make neighbours overlap by a few px; they still count as the next row or column.
const OVERLAP_PX = 4;
const SIDE_WEIGHT = 2;
/** Share of the visible height one up or down press scrolls a focused block taller than its scroller. */
const SCROLL_STEP = 0.4;
/** The pad button behind `accept` in `PAD_NAV` (`hud/input.ts`): a hold button stays pressed while it is down. */
const ACCEPT_BUTTON = 0;

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
  notice(text: string): void;
  pad(): Gamepad | null;
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
  /** Dialogs seen opening, newest last; one closed or taken out of the page drops off on the next `is_open`. */
  private readonly modals: HTMLDialogElement[] = [];
  // `beforetoggle` runs inside showModal, so the dialog counts from the same frame on; `toggle` would land a task later.
  private readonly on_toggle = (event: Event) => {
    const dialog = event.target;
    if (dialog instanceof HTMLDialogElement && (event as ToggleEvent).newState === "open" && !this.modals.includes(dialog)) this.modals.push(dialog);
  };

  constructor(private readonly host: PadMenuHost) {}

  start() {
    for (const dialog of document.querySelectorAll<HTMLDialogElement>("dialog:modal")) this.modals.push(dialog);
    document.addEventListener("beforetoggle", this.on_toggle, { capture: true });
  }

  stop() {
    document.removeEventListener("beforetoggle", this.on_toggle, { capture: true });
    this.modals.length = 0;
  }

  /** Read on every input poll, so it answers from the dialogs seen opening rather than a document query or a built layer. */
  get is_open(): boolean {
    const { settings, chat } = this.host;
    return this.hud_open || this.modal_open() || settings.is_open || (chat.is_open && this.chat_panel.contains(document.activeElement));
  }

  private modal_open(): boolean {
    for (let i = this.modals.length - 1; i >= 0; i--) {
      if (this.modals[i].matches(":modal")) return true;
      this.modals.splice(i, 1);
    }
    return false;
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
    const modal = document.querySelector<HTMLDialogElement>("dialog:modal");
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
    document.querySelector<HTMLDialogElement>("dialog:modal")?.close();
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

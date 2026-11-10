import { $ } from "./hud";
import { typing } from "./input";
import type { Net } from "./net";

const BUBBLES = 6;
const HISTORY = 100;
const UNREAD_MAX = 99;
const PRESENCE_MS = 1000;
const FOLLOW_END_PX = 24;

const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export class Chat {
  private bubbles = $("chat-log", HTMLOListElement);
  private panel = $("chat-panel");
  private history = $("chat-history", HTMLOListElement);
  private empty = $("chat-empty");
  private form = $("chat-form", HTMLFormElement);
  private field = $("chat-input", HTMLInputElement);
  private button = $("chat-btn", HTMLButtonElement);
  private badge = $("chat-unread");
  private unread = 0;
  private presence: number | null = null;
  private abort: AbortController | null = null;
  /** While true (garage or settings open) T, Enter and Escape belong to that panel. */
  blocked: () => boolean = () => false;

  constructor(private net: Net) {}

  start() {
    this.abort = new AbortController();
    const { signal } = this.abort;
    // Capture phase, so an Escape that closes the chat is not also the settings key in input.ts.
    window.addEventListener(
      "keydown",
      (e) => {
        if (this.blocked()) return;
        if (e.code === "Escape") {
          if (!this.is_open || document.querySelector(":popover-open")) return;
          e.preventDefault();
          e.stopPropagation();
          this.close();
          return;
        }
        if (e.repeat || typing(e.target) || e.target instanceof HTMLButtonElement || (e.code !== "Enter" && e.code !== "KeyT")) return;
        e.preventDefault();
        this.open(true);
      },
      { signal, capture: true },
    );
    this.button.addEventListener("click", () => (this.is_open ? this.close() : this.open(matchMedia("(pointer: fine)").matches)), { signal });
    $("chat-close").addEventListener("click", () => this.close(), { signal });
    this.form.addEventListener(
      "submit",
      (e) => {
        e.preventDefault();
        if (!this.field.value.trim()) {
          this.field.value = "";
          this.field.blur();
          return;
        }
        const sent = this.net.send_chat(this.field.value);
        if (!sent) return;
        this.field.value = "";
        this.add(this.net.name, sent, true);
        this.field.focus();
      },
      { signal },
    );
    this.bubbles.addEventListener("animationend", (e) => e.target instanceof HTMLElement && e.target.remove(), { signal });
    signal.addEventListener("abort", this.net.on_chat((name, text) => this.add(name, text, false)));
    this.sync_empty();
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
    this.stop_presence();
  }

  get is_open() {
    return !this.panel.hidden;
  }

  open(focus: boolean) {
    if (!this.is_open) {
      this.panel.hidden = false;
      this.button.setAttribute("aria-expanded", "true");
      this.bubbles.replaceChildren();
      this.set_unread(0);
      this.sync_empty();
      this.history.scrollTop = this.history.scrollHeight;
      this.presence = window.setInterval(() => this.sync_empty(), PRESENCE_MS);
    }
    if (focus) this.field.focus();
  }

  close() {
    if (!this.is_open) return;
    this.field.blur();
    this.panel.hidden = true;
    this.button.setAttribute("aria-expanded", "false");
    this.stop_presence();
  }

  private stop_presence() {
    if (this.presence !== null) window.clearInterval(this.presence);
    this.presence = null;
  }

  private sync_empty() {
    this.empty.hidden = this.history.childElementCount > 0;
    this.empty.dataset.alone = String(this.net.remotes.size === 0);
  }

  private set_unread(count: number) {
    this.unread = count;
    this.badge.hidden = count === 0;
    this.badge.textContent = count > UNREAD_MAX ? `${UNREAD_MAX}+` : String(count);
    this.button.ariaLabel = count === 0 ? "Chat" : `Chat, ${count} unread`;
  }

  private add(name: string, text: string, own: boolean) {
    const list = this.history;
    const at_end = list.scrollHeight - list.scrollTop - list.clientHeight < FOLLOW_END_PX;
    const item = document.createElement("li");
    item.dataset.own = String(own);
    const meta = document.createElement("div");
    meta.className = "chat-meta";
    const who = document.createElement("b");
    who.textContent = own ? "You" : name;
    const time = document.createElement("time");
    const now = new Date();
    time.dateTime = now.toISOString();
    time.textContent = clock.format(now);
    meta.append(who, time);
    const body = document.createElement("p");
    body.textContent = text;
    item.append(meta, body);
    list.append(item);
    while (list.childElementCount > HISTORY) list.firstElementChild?.remove();
    if (at_end || own) list.scrollTop = list.scrollHeight;
    this.sync_empty();
    if (this.is_open) return;

    const line = document.createElement("li");
    const sender = document.createElement("b");
    sender.textContent = name;
    line.dataset.own = String(own);
    line.append(sender, document.createTextNode(` ${text}`));
    this.bubbles.append(line);
    while (this.bubbles.childElementCount > BUBBLES) this.bubbles.firstElementChild?.remove();
    if (!own) this.set_unread(this.unread + 1);
  }
}

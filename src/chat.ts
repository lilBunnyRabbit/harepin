import { $ } from "./hud";
import { typing } from "./input";
import type { Net } from "./net";

const LINES = 6;

export class Chat {
  private log = $("chat-log", HTMLOListElement);
  private form = $("chat-form", HTMLFormElement);
  private field = $("chat-input", HTMLInputElement);
  private button = $("chat-button", HTMLButtonElement);
  private abort: AbortController | null = null;

  constructor(
    private net: Net,
  ) {}

  start() {
    this.abort = new AbortController();
    const { signal } = this.abort;
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.repeat || typing(e.target) || (e.code !== "Enter" && e.code !== "KeyT")) return;
        e.preventDefault();
        this.open();
      },
      { signal },
    );
    this.field.addEventListener(
      "keydown",
      (e) => {
        if (e.code === "Escape") this.close();
      },
      { signal },
    );
    this.field.addEventListener("blur", () => this.close(), { signal });
    this.button.addEventListener("click", () => this.open(), { signal });
    this.form.addEventListener(
      "submit",
      (e) => {
        e.preventDefault();
        const sent = this.net.send_chat(this.field.value);
        if (!sent && this.field.value.trim()) return;
        if (sent) this.add(this.net.name, sent, true);
        this.close();
      },
      { signal },
    );
    this.log.addEventListener("animationend", (e) => e.target instanceof HTMLElement && e.target.remove(), { signal });
    this.net.on_chat = (name, text) => this.add(name, text, false);
  }

  stop() {
    this.abort?.abort();
    this.abort = null;
    this.net.on_chat = null;
  }

  get is_open() {
    return !this.form.hidden;
  }

  open() {
    this.form.hidden = false;
    document.body.classList.add("chatting");
    this.field.focus();
  }

  close() {
    if (this.form.hidden) return;
    this.field.value = "";
    this.form.hidden = true;
    document.body.classList.remove("chatting");
    this.field.blur();
  }

  private add(name: string, text: string, own: boolean) {
    const line = document.createElement("li");
    const who = document.createElement("b");
    who.textContent = name;
    line.dataset.own = String(own);
    line.append(who, document.createTextNode(` ${text}`));
    this.log.append(line);
    while (this.log.children.length > LINES) this.log.firstElementChild?.remove();
  }
}

import { PASSWORD_LENGTH } from "../net/directory";
import { el } from "../setting-rows";
import type { MenuTab } from "./page";

export const COPIED_MS = 2000;

const preview = (name: string) => `${import.meta.env.BASE_URL}menu/${name}.webp`;

export function random_seed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

export function picture(name: string, contain = false): HTMLImageElement {
  const img = el("img");
  img.src = preview(name);
  img.alt = "";
  img.decoding = "async";
  if (contain) img.dataset.fit = "contain";
  return img;
}

/** Picture or icon behind, title and a line over a scrim at the bottom. */
export function dress(tile: HTMLElement, title: string, note: string, art: Node | null, eyebrow = ""): HTMLElement {
  if (art) {
    const wrap = el("span", "menu-art");
    wrap.append(art);
    tile.append(wrap);
  }
  const text = el("span", "menu-text");
  if (eyebrow) text.append(el("span", "menu-eyebrow", eyebrow));
  text.append(el("b", "", title), el("span", "", note));
  tile.append(text);
  return text;
}

export function tile(area: string, title: string, note: string, art: Node | null, run: () => void): HTMLButtonElement {
  const button = el("button", "menu-tile");
  button.type = "button";
  button.dataset.area = area;
  dress(button, title, note, art);
  button.addEventListener("click", run);
  return button;
}

export function info(area: string, eyebrow: string, ...content: HTMLElement[]): HTMLElement {
  const node = el("div", "menu-tile menu-info");
  node.dataset.area = area;
  node.append(el("span", "menu-eyebrow", eyebrow), ...content);
  return node;
}

export function mosaic(tab: MenuTab, ...tiles: HTMLElement[]): HTMLElement[] {
  const grid = el("div", "menu-mosaic");
  grid.dataset.tab = tab;
  grid.append(...tiles);
  return [grid];
}

export function row(label: string, control: HTMLElement, hint = ""): HTMLElement {
  const node = el("div", "settings-row");
  const text = el("div", "settings-label");
  text.append(el("span", "", label));
  if (hint) text.append(el("small", "", hint));
  node.append(text, control);
  return node;
}

export function action(label: string, run: (button: HTMLButtonElement) => void): HTMLButtonElement {
  const button = el("button", "settings-action", label);
  button.type = "button";
  button.addEventListener("click", () => run(button));
  return button;
}

export function stat(label: string, value: string): HTMLElement {
  const node = el("span", "settings-stat");
  node.append(el("span", "", label), el("b", "", value));
  return node;
}

export function copy_action(label: string, link: string): HTMLButtonElement {
  return action(label, async (button) => {
    try {
      await navigator.clipboard.writeText(link);
      button.textContent = "Copied";
    } catch (error) {
      console.warn("settings: clipboard refused", error);
      button.textContent = "Copy failed";
    }
    setTimeout(() => (button.textContent = label), COPIED_MS);
  });
}

export function password_input(label: string): HTMLInputElement {
  const input = el("input", "settings-input");
  input.type = "password";
  input.maxLength = PASSWORD_LENGTH;
  input.autocomplete = "off";
  input.setAttribute("aria-label", label);
  return input;
}

export function invalid(input: HTMLInputElement, message: string) {
  input.setCustomValidity(message);
  input.reportValidity();
}

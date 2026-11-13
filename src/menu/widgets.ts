import { el } from "./setting-rows";

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

export function invalid(input: HTMLInputElement, message: string) {
  input.setCustomValidity(message);
  input.reportValidity();
}

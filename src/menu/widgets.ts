import { el } from "./dom";

export const COPIED_MS = 2000;

export const preview = (name: string) => `${import.meta.env.BASE_URL}menu/${name}.webp`;

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

export function invalid(input: HTMLInputElement, message: string) {
  input.setCustomValidity(message);
  input.reportValidity();
}

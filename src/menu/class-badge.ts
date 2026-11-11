import type { Build } from "../car/build";
import { CLASS_LABELS, rating, type Rating } from "../car/pi";
import { el } from "./setting-rows";
import "./class-badge.css";

export function class_badge({ pi, class: name }: Rating): HTMLElement {
  const badge = el("span", "class-badge");
  badge.dataset.class = name;
  badge.setAttribute("aria-label", `Class ${CLASS_LABELS[name]}, PI ${pi}`);
  badge.append(el("b", "class-badge-letter", CLASS_LABELS[name]), el("span", "class-badge-pi", String(pi)));
  return badge;
}

export const build_badge = (build: Build) => class_badge(rating(build));

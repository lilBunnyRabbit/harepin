import { DEFAULT_BUILD, build_code, parse_build, type Build } from "../car/build";
import { BUILD_NAME_LENGTH, free_build_name, renamed, type SavedBuild } from "../car/builds";
import { CARS, is_car } from "../car/cars";
import { PRESETS } from "../car/presets";
import { build_badge } from "./class-badge";
import { icon } from "./garage-widgets";
import { el } from "./setting-rows";

export const BUILD_KEY = "harepin:build";

export function load_build(query: string | null): Build {
  const asked = parse_build(query);
  if (asked) return asked;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(BUILD_KEY);
  } catch (error) {
    console.warn("garage: saved build unreadable", error);
  }
  const base = parse_build(saved) ?? DEFAULT_BUILD;
  return query !== null && is_car(query) ? { ...base, car: query } : base;
}

export function save_build(build: Build) {
  try {
    localStorage.setItem(BUILD_KEY, build_code(build));
  } catch (error) {
    console.warn("garage: build not saved", error);
  }
}

export interface BuildsView {
  builds: SavedBuild[];
  /** The saved build whose name is being edited. */
  renaming: string | null;
  current: Build;
}

export interface BuildsActions {
  save(name: string): void;
  load_code(field: HTMLInputElement): void;
  store(next: SavedBuild[] | null, field: HTMLInputElement): void;
}

export function render_builds(rail: HTMLElement, view: BuildsView, actions: BuildsActions) {
  const active = document.activeElement;
  const kept = active instanceof HTMLElement && rail.contains(active) ? (active.dataset.action ?? active.getAttribute("name")) + (active.dataset.value ?? "") : null;

  const field = (name: string, label: string, placeholder: string) => {
    const input = el("input", "garage-field");
    input.type = "text";
    input.name = name;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = placeholder;
    input.setAttribute("aria-label", label);
    input.addEventListener("input", () => input.setCustomValidity(""));
    return input;
  };
  const button = (label: string, action: string, value = "", class_name = "garage-action") => {
    const node = el("button", class_name, label);
    node.type = "button";
    node.dataset.action = action;
    node.dataset.value = value;
    return node;
  };
  const form = (input: HTMLInputElement, label: string, submit: () => void) => {
    const node = el("form", "garage-build-form");
    const go = el("button", "garage-action", label);
    go.type = "submit";
    go.name = `${input.name}-go`;
    node.append(input, go);
    node.addEventListener("submit", (event) => {
      event.preventDefault();
      submit();
    });
    return node;
  };

  const car = CARS[view.current.car].name;
  const name = field("build-name", "Build name", free_build_name(view.builds, car));
  name.maxLength = BUILD_NAME_LENGTH;
  const save = form(name, "Save", () => actions.save(name.value));
  const code = field("build-code", "A friend's build code", "Paste a friend's code");
  const paste = form(code, "Load", () => actions.load_code(code));
  const own = el("div", "garage-build-own");
  own.append(el("code", "garage-code", build_code(view.current)), button("Copy", "copy-code"));

  const fitted = build_code(view.current);
  const card = (title: string, sub: string, code: string, action: string, value: string) => {
    const build = parse_build(code);
    const on_car = code === fitted;
    const body = on_car ? el("div", "garage-build-load") : button("", action, value, "garage-build-load");
    const meta = el("span", "garage-build-meta");
    meta.append(...(build ? [build_badge(build)] : []), on_car ? el("span", "garage-tag", "On your car") : el("span", "garage-build-go", "Load"));
    body.append(el("b", "garage-build-title", title), el("small", "garage-build-sub", sub), meta);
    return body;
  };
  const list = el("ol", "garage-builds");
  for (const saved of view.builds) {
    const li = el("li", "garage-build");
    if (saved.name === view.renaming) {
      const input = field("rename", `New name for ${saved.name}`, saved.name);
      input.value = saved.name;
      input.maxLength = BUILD_NAME_LENGTH;
      const rename = form(input, "Save", () => actions.store(renamed(view.builds, saved.name, input.value), input));
      rename.classList.add("garage-rename");
      rename.append(button("Cancel", "cancel-rename"));
      li.append(rename);
    } else {
      const build = parse_build(saved.code);
      const edit = button("", "rename-build", saved.name, "garage-mini");
      edit.setAttribute("aria-label", `Rename ${saved.name}`);
      edit.append(icon("rename"));
      const drop = button("", "delete-build", saved.name, "garage-mini");
      drop.setAttribute("aria-label", `Delete ${saved.name}`);
      drop.append(icon("delete"));
      const tools = el("div", "garage-build-tools");
      tools.append(edit, drop);
      li.append(card(saved.name, build ? CARS[build.car].name : "", saved.code, "load-build", saved.name), tools);
    }
    list.append(li);
  }
  const presets = el("ol", "garage-builds");
  PRESETS.forEach((preset, i) => {
    const li = el("li", "garage-build");
    li.append(card(preset.name, preset.blurb, preset.code, "load-preset", String(i)));
    presets.append(li);
  });
  const head = (text: string) => el("h3", "garage-build-head", text);
  rail.replaceChildren(
    head("Save this car"),
    save,
    head("Your car's code"),
    own,
    head("A friend's code"),
    paste,
    head("Presets"),
    presets,
    head(view.builds.length ? "My builds" : "No builds saved yet"),
    list,
  );
  if (!kept) return;
  for (const node of rail.querySelectorAll<HTMLElement>("button, input"))
    if ((node.dataset.action ?? node.getAttribute("name")) + (node.dataset.value ?? "") === kept) return node.focus({ focusVisible: true });
}

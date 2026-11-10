import { Harmony, generate_theme, is_dark, type ThemeMode } from "../theme/random-theme";
import { mulberry32 } from "../rng";
import { el, icon, type Value } from "./setting-rows";
import {
  THEMES,
  THEME_NAME_LENGTH,
  TOKENS,
  choose_theme,
  current_theme,
  derive_theme,
  find_saved,
  find_theme,
  load_saved_themes,
  store_saved_themes,
  theme_name_problem,
  token_var,
  with_saved,
  without_saved,
  type ThemeBase,
} from "../theme/theme";
import type { SettingsMenu } from "./page";
import { action, invalid } from "./widgets";

export const BASE_TOKENS: [keyof ThemeBase, string][] = [
  ["background", "Background"],
  ["foreground", "Text"],
  ["primary", "Main"],
  ["secondary", "Second"],
  ["accent", "Accent"],
];

const THEME_MODES: [ThemeMode, string][] = [
  ["dark", "Dark"],
  ["light", "Light"],
  ["any", "Either"],
];

const HARMONY_CHOICES: [Harmony | "any", string][] = [
  ["any", "Surprise me"],
  [Harmony.ANALOGOUS, "Matching"],
  [Harmony.COMPLEMENTARY, "Contrasting"],
  [Harmony.TRIADIC, "Three colours"],
  [Harmony.SPLIT, "Split"],
];

export function saved_themes(m: SettingsMenu): HTMLElement[] {
  const list = el("div", "set-rows");
  const render = () => {
    const saved = load_saved_themes();
    const in_use = find_saved(saved, current_theme())?.name ?? null;
    list.replaceChildren(
      ...saved.map(({ name }) => {
        const control = el("span", "set-inline");
        if (name === in_use) control.append(el("span", "servers-tag", "In use"));
        control.append(
          action("Delete", () => {
            if (!store_saved_themes(without_saved(load_saved_themes(), name))) return;
            if (name === in_use) return m.reload("theme");
            render();
            m.refresh();
            list.querySelector("button")?.focus();
          }),
        );
        return m.rows.custom(name, name === in_use ? "The theme you're using. Delete it and the game goes back to Brand Dark." : "Delete it to remove it from the Theme list.", control);
      }),
    );
    if (!saved.length) list.append(el("p", "servers-note", "No themes yet. Make one with Make your own theme."));
  };
  render();
  return [list];
}

export function theme_create(m: SettingsMenu): HTMLElement[] {
  const saved = () => load_saved_themes();
  const { background, foreground, primary, secondary, accent } = find_theme(current_theme()) ?? THEMES["Brand Dark"];
  let base: ThemeBase = { background, foreground, primary, secondary, accent };
  let mode: ThemeMode = is_dark(base) ? "dark" : "light";
  let harmony: Harmony | "any" = "any";
  let vibrance = 50;
  let contrast = 50;
  // One seed per roll, so a slider or style change reshapes this theme instead of rolling a new one.
  let seed = 0;
  let rolled = false;
  const locked = new Set<keyof ThemeBase>();

  const scene = el("div", "theme-scene");
  scene.setAttribute("aria-hidden", "true");
  for (const part of ["sky", "hill", "road", "lane", "car", "pill"]) scene.append(el("span", `theme-scene-${part}`));
  scene.querySelector(".theme-scene-pill")?.append(el("b", "", "88"), el("small", "", "km/h"), el("i", "", "3"));

  const locks = el("div", "theme-locks");
  const lock_buttons = BASE_TOKENS.map(([token, label]) => {
    const button = el("button", "theme-lock");
    button.type = "button";
    button.setAttribute("aria-label", `Lock ${label.toLowerCase()} colour`);
    const swatch = el("span", "theme-swatch");
    swatch.append(icon("icon-lock"));
    button.append(swatch, el("span", "", label));
    button.addEventListener("click", () => {
      if (locked.has(token)) locked.delete(token);
      else locked.add(token);
      render();
    });
    locks.append(button);
    return [token, button, swatch] as const;
  });

  const generate = () => {
    const keep = Object.fromEntries([...locked].map((token) => [token, base[token]]));
    base = generate_theme({ mode, harmony, vibrance: vibrance / 100, contrast: contrast / 100, locked: keep }, mulberry32(seed));
  };
  const adjust = () => {
    if (rolled) generate();
    render();
  };
  const roll = () => {
    seed = Math.floor(Math.random() * 2 ** 32);
    rolled = true;
    generate();
    render();
  };

  const form = el("form", "set-inline");
  const name = el("input", "settings-input");
  name.type = "text";
  name.maxLength = THEME_NAME_LENGTH;
  name.autocomplete = "off";
  name.enterKeyHint = "done";
  name.setAttribute("aria-label", "Theme name");
  // A pad can't type, so an empty name saves under the next free placeholder.
  const free_name = () => {
    let at = saved().length + 1;
    while (find_saved(saved(), `My theme ${at}`)) at++;
    return `My theme ${at}`;
  };
  name.addEventListener("input", () => name.setCustomValidity(""));
  const save = el("button", "settings-action", "Save");
  save.type = "submit";
  form.append(name, save);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!rolled) return;
    const chosen = name.value.trim() || free_name();
    const problem = theme_name_problem(chosen);
    if (problem) return invalid(name, problem);
    if (!store_saved_themes(with_saved(saved(), chosen, derive_theme(base)))) return invalid(name, "This browser refused to store it");
    choose_theme(chosen);
    m.reload("theme");
  });

  const render = () => {
    const theme = derive_theme(base);
    for (const token of TOKENS) scene.style.setProperty(token_var(token), theme[token]);
    for (const [token, button, swatch] of lock_buttons) {
      swatch.style.background = base[token];
      button.setAttribute("aria-pressed", String(locked.has(token)));
    }
    save.disabled = !rolled;
    name.disabled = !rolled;
    name.placeholder = free_name();
    m.rows.refresh();
    m.redraw_help();
  };
  render();

  const local = <T>(get: () => T, set: (value: T) => void): Value<T> => ({
    get,
    set: (value) => {
      set(value);
      adjust();
    },
  });
  return [
    scene,
    m.rows.link("Roll a theme", "New random colours. Locked colours stay as they are.", () => (rolled ? "Roll again" : "Roll"), roll),
    m.rows.custom("Your colours", "Lock a colour to keep it when you roll again.", locks),
    m.rows.segmented(
      "Light or dark",
      "Which kind of background a roll can give.",
      local(
        () => mode,
        (value) => (mode = value),
      ),
      THEME_MODES,
    ),
    m.rows.stepper(
      "Colour style",
      "How the main colours relate to each other.",
      local(
        () => harmony,
        (value) => (harmony = value),
      ),
      HARMONY_CHOICES,
    ),
    m.rows.slider(
      "Colour strength",
      "Muted to bold.",
      local(
        () => vibrance,
        (value) => (vibrance = value),
      ),
    ),
    m.rows.slider(
      "Contrast",
      "Soft to sharp. Text always stays readable.",
      local(
        () => contrast,
        (value) => (contrast = value),
      ),
    ),
    m.rows.custom("Name and save", "Roll first. Saving adds it to your themes and switches to it; the page reloads.", form),
  ];
}

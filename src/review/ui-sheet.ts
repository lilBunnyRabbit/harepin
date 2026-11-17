import { mount } from "svelte";
import { mulberry32 } from "../rng";
import { dusk_of } from "../theme/palette";
import { DEFAULT_GENERATE, generate_theme } from "../theme/random-theme";
import { apply_theme, derive_theme, load_saved_themes, read_tokens, store_saved_themes, with_saved, without_saved } from "../theme/theme";
import UiSheet from "./UiSheet.svelte";
import { UI_SHEET } from "./params";
import "../style.css";

const RANDOM_PARAM = "random";
const INPUT_PARAM = "input";
const RANDOM_NAME = "Review random";
// From the review chunk, not a CSS import, so none of it reaches the game's stylesheet.
const PAGE_CSS = `
html[data-review] body > :not(.review-ui) { display: none !important; }
html[data-review], html[data-review] body { overflow: auto; height: auto; background: var(--background-darkest); color: var(--foreground); }`;

const params = new URLSearchParams(location.search);
const root = document.documentElement;
root.dataset.review = "busy";
document.getElementById("loading")?.remove();
document.head.append(Object.assign(document.createElement("style"), { textContent: PAGE_CSS }));

// `?random=<seed>` wears a generated theme. apply_theme takes a name, so the theme is saved for the one call and removed.
const seed = params.get(RANDOM_PARAM);
if (seed !== null) {
  const saved = load_saved_themes();
  const theme = derive_theme(generate_theme({ ...DEFAULT_GENERATE, mode: "any" }, mulberry32(Number(seed))));
  store_saved_themes(with_saved(saved, RANDOM_NAME, theme));
  apply_theme(RANDOM_NAME);
  store_saved_themes(without_saved(saved, RANDOM_NAME));
}
root.dataset.scheme = dusk_of(read_tokens().background) ? "dark" : "light";
const input = params.get(INPUT_PARAM);
if (input) root.dataset.input = input;
await document.fonts.ready;

const target = document.createElement("div");
target.className = "review-ui";
document.body.append(target);
mount(UiSheet, { target });
root.dataset.review = `sheet:${UI_SHEET}`;

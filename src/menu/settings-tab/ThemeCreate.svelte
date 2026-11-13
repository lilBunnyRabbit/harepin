<script lang="ts">
  import { mulberry32 } from "../../rng";
  import { Harmony, generate_theme, is_dark, type ThemeMode } from "../../theme/random-theme";
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
    type ThemeBase,
  } from "../../theme/theme";
  import { invalid } from "../widgets";
  import Button from "../ui/Button.svelte";
  import Icon from "../ui/Icon.svelte";
  import TextField from "../ui/TextField.svelte";
  import ChoiceRow from "./rows/ChoiceRow.svelte";
  import LinkRow from "./rows/LinkRow.svelte";
  import SliderRow from "./rows/SliderRow.svelte";
  import StepRow from "./rows/StepRow.svelte";
  import SettingRow from "./SettingRow.svelte";
  import { BASE_TOKENS, options, reload_without } from "./sections";

  const MODES = options<ThemeMode>([
    ["dark", "Dark"],
    ["light", "Light"],
    ["any", "Either"],
  ]);
  const HARMONIES = options<Harmony | "any">([
    ["any", "Surprise me"],
    [Harmony.ANALOGOUS, "Matching"],
    [Harmony.COMPLEMENTARY, "Contrasting"],
    [Harmony.TRIADIC, "Three colours"],
    [Harmony.SPLIT, "Split"],
  ]);

  const { background, foreground, primary, secondary, accent } = find_theme(current_theme()) ?? THEMES["Brand Dark"];
  let base = $state.raw<ThemeBase>({ background, foreground, primary, secondary, accent });
  let mode = $state<ThemeMode>(is_dark({ background }) ? "dark" : "light");
  let harmony = $state<Harmony | "any">("any");
  let vibrance = $state(50);
  let contrast = $state(50);
  // One seed per roll, so a slider or style change reshapes this theme instead of rolling a new one.
  let seed = 0;
  let rolled = $state(false);
  let locked = $state.raw(new Set<keyof ThemeBase>());
  let name = $state("");
  let saves = $state(0);

  const theme = $derived(derive_theme(base));
  const scene = $derived(TOKENS.map((token) => `${token_var(token)}: ${theme[token]}`).join("; "));
  const free_name = $derived.by(() => {
    void saves;
    const saved = load_saved_themes();
    let at = saved.length + 1;
    while (find_saved(saved, `My theme ${at}`)) at++;
    return `My theme ${at}`;
  });

  function generate() {
    const keep = Object.fromEntries([...locked].map((token) => [token, base[token]]));
    base = generate_theme({ mode, harmony, vibrance: vibrance / 100, contrast: contrast / 100, locked: keep }, mulberry32(seed));
  }

  function adjust(change: () => void) {
    change();
    if (rolled) generate();
  }

  function roll() {
    seed = Math.floor(Math.random() * 2 ** 32);
    rolled = true;
    generate();
  }

  function lock(token: keyof ThemeBase) {
    const next = new Set(locked);
    if (!next.delete(token)) next.add(token);
    locked = next;
  }

  // A pad can't type, so an empty name saves under the next free placeholder.
  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!rolled || !(event.currentTarget instanceof HTMLFormElement)) return;
    const input = event.currentTarget.querySelector("input");
    if (!input) return;
    const chosen = name.trim() || free_name;
    const problem = theme_name_problem(chosen);
    if (problem) return invalid(input, problem);
    if (!store_saved_themes(with_saved(load_saved_themes(), chosen, derive_theme(base)))) return invalid(input, "This browser refused to store it");
    saves++;
    choose_theme(chosen);
    reload_without("theme");
  }
</script>

<div class="set-scene" style={scene} aria-hidden="true">
  <span class="set-scene-sky"></span>
  <span class="set-scene-hill"></span>
  <span class="set-scene-road"></span>
  <span class="set-scene-lane"></span>
  <span class="set-scene-car"></span>
  <span class="set-scene-pill"><b>88</b><small>km/h</small><i>3</i></span>
</div>
<LinkRow label="Roll a theme" help="New random colours. Locked colours stay as they are." value={rolled ? "Roll again" : "Roll"} open={roll} />
<SettingRow label="Your colours" help="Lock a colour to keep it when you roll again." custom stack>
  <div class="set-locks">
    {#each BASE_TOKENS as [token, label] (token)}
      <button type="button" class="set-lock" aria-pressed={locked.has(token)} aria-label={`Lock ${label.toLowerCase()} colour`} onclick={() => lock(token)}>
        <span class="set-swatch" style:background={base[token]}><Icon name="icon-lock" /></span>
        <span>{label}</span>
      </button>
    {/each}
  </div>
</SettingRow>
<ChoiceRow label="Light or dark" help="Which kind of background a roll can give." value={mode} options={MODES} onchange={(value) => adjust(() => (mode = value))} />
<StepRow label="Colour style" help="How the main colours relate to each other." value={harmony} options={HARMONIES} onchange={(value) => adjust(() => (harmony = value))} />
<SliderRow label="Colour strength" help="Muted to bold." value={vibrance} onchange={(value) => adjust(() => (vibrance = value))} />
<SliderRow label="Contrast" help="Soft to sharp. Text always stays readable." value={contrast} onchange={(value) => adjust(() => (contrast = value))} />
<SettingRow label="Name and save" help="Roll first. Saving adds it to your themes and switches to it; the page reloads." custom stack>
  <form class="set-save" onsubmit={save}>
    <TextField
      bind:value={name}
      maxlength={THEME_NAME_LENGTH}
      enterkeyhint="done"
      aria-label="Theme name"
      placeholder={free_name}
      disabled={!rolled}
      oninput={(event) => event.currentTarget.setCustomValidity("")}
    />
    <Button type="submit" disabled={!rolled}>Save</Button>
  </form>
</SettingRow>

<style>
  /* Carries the rolled theme's tokens on itself, so every colour below resolves against them, not the page's. */
  .set-scene {
    position: relative;
    flex: none;
    height: 8rem;
    margin: 0 var(--space-4) var(--space-2);
    overflow: hidden;
    border: 1px solid color-mix(in oklch, var(--foreground) 16%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in oklch, var(--success) 38%, var(--background-dark));
  }

  .set-scene > span {
    position: absolute;
  }

  .set-scene-sky {
    inset: 0 0 48% 0;
    background: var(--background-lighter);
  }

  .set-scene-hill {
    inset: 30% 0 48% 0;
    background: color-mix(in oklch, var(--success) 30%, var(--background));
    clip-path: polygon(0 100%, 0 55%, 22% 10%, 40% 60%, 62% 0, 82% 50%, 100% 30%, 100% 100%);
  }

  .set-scene-road {
    inset: 52% 0 0 0;
    background: var(--background-darkest);
    clip-path: polygon(45% 0, 55% 0, 88% 100%, 12% 100%);
  }

  .set-scene-lane {
    inset: 56% calc(50% - 1px) 0;
    background: repeating-linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 70%, transparent) 0 var(--space-2), transparent var(--space-2) var(--space-4));
  }

  .set-scene-car {
    left: 50%;
    bottom: 12%;
    width: 22%;
    height: 26%;
    translate: -50% 0;
    border-radius: var(--radius-xs) var(--radius-xs) var(--space-1) var(--space-1);
    background: var(--primary);
    box-shadow: inset 0 9px 0 -2px color-mix(in oklch, var(--background-darkest) 70%, var(--primary));
  }

  .set-scene-pill {
    top: var(--space-2);
    right: var(--space-2);
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
    padding: var(--space-0) var(--space-2);
    border-radius: var(--radius-sm);
    background: color-mix(in oklch, var(--background-darkest) 88%, transparent);
    color: var(--foreground);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .set-scene-pill b {
    font-size: var(--text-xl);
    font-weight: 700;
  }

  .set-scene-pill i {
    margin-left: var(--space-1);
    color: var(--primary);
    font-style: normal;
    font-weight: 700;
  }

  .set-locks {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .set-lock {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    height: auto;
    padding: var(--space-2) var(--space-1);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-sm);
    background: var(--set-soft);
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .set-lock:hover {
    border-color: var(--line-strong);
  }

  .set-lock:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .set-lock[aria-pressed="true"] {
    border-color: var(--primary);
    background: var(--set-raised);
    color: var(--foreground);
  }

  .set-swatch {
    --icon-size: var(--text-lg);
    position: relative;
    width: var(--control-h-lg);
    height: var(--control-h-lg);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-sm);
  }

  .set-swatch :global(.ui-icon) {
    position: absolute;
    right: calc(-1 * var(--space-2));
    bottom: calc(-1 * var(--space-2));
    box-sizing: content-box;
    padding: var(--space-0);
    border: 1px solid var(--set-line);
    border-radius: 50%;
    background: var(--set-raised);
    color: var(--set-dim);
  }

  .set-lock[aria-pressed="true"] .set-swatch :global(.ui-icon) {
    border-color: var(--primary);
    color: var(--primary);
  }

  .set-save {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .set-save :global(.ui-field) {
    width: 12rem;
  }

  @media (max-width: 600px) {
    .set-save :global(.ui-field) {
      flex: 1;
      width: auto;
    }
  }
</style>

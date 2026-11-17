<script lang="ts">
  import { THEMES, apply_theme, choose_theme, current_theme, find_saved, find_theme, load_saved_themes } from "../../theme/theme";
  import { HudSize, MapView, SpeedoStyle } from "../prefs";
  import Button from "../ui/Button.svelte";
  import type { MenuState } from "../ui/menu-state.svelte";
  import HudWire from "./HudWire.svelte";
  import { use_nav } from "./nav.svelte";
  import ChoiceRow from "./rows/ChoiceRow.svelte";
  import LinkRow from "./rows/LinkRow.svelte";
  import StepRow from "./rows/StepRow.svelte";
  import { BASE_TOKENS, MAP_VIEWS, SPEEDO_STYLES, options, reload_without } from "./sections";

  interface Props {
    live: MenuState;
  }

  let { live }: Props = $props();

  const nav = use_nav();
  const SIZES = options([
    [HudSize.SMALL, "Small"],
    [HudSize.MEDIUM, "Medium"],
    [HudSize.LARGE, "Large"],
  ]);
  const SPEEDO = Object.values(SpeedoStyle).map((style) => ({ value: style, label: SPEEDO_STYLES[style][0] }));
  const MAPS = Object.values(MapView).map((view) => ({ value: view, label: MAP_VIEWS[view][0] }));

  const saved = load_saved_themes();
  const active = current_theme();
  const in_use = THEMES[active] ? active : (find_saved(saved, active)?.name ?? active);
  const names = [...saved.map(({ name }) => ({ value: name, label: name })), ...Object.keys(THEMES).map((name) => ({ value: name, label: name }))];
  let pick = $state(in_use);
  const picked = $derived(find_theme(pick, saved));
  const mine = $derived(live.live(() => load_saved_themes().length));

  let previewing = false;

  function preview(name: string) {
    pick = name;
    if (previewing) apply_theme(name);
  }

  function enter() {
    if (previewing) return;
    previewing = true;
    apply_theme(pick);
  }

  function leave(event: FocusEvent) {
    if (event.currentTarget instanceof Element && event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    restore();
  }

  function restore() {
    if (!previewing) return;
    previewing = false;
    pick = in_use;
    apply_theme(in_use);
  }

  $effect(() => restore);

  function keep() {
    if (pick === in_use) return;
    previewing = false;
    choose_theme(pick);
    reload_without("theme");
  }
</script>

{#snippet wire()}
  <HudWire map={live.prefs.map} speedo={live.prefs.speedo} />
{/snippet}

{#snippet swatches()}
  {#if picked}
    <span class="set-swatches" aria-hidden="true">
      {#each BASE_TOKENS as [token] (token)}<i style:background={picked[token]}></i>{/each}
    </span>
  {/if}
{/snippet}

<ChoiceRow label="Minimap" help={() => `${MAP_VIEWS[live.prefs.map][1]}.`} value={live.prefs.map} options={MAPS} onchange={(value) => live.set("map", value)} visual={wire} />
<ChoiceRow
  label="Speedometer"
  help={() => `${SPEEDO_STYLES[live.prefs.speedo][1]}. On a phone it sits in the top right, clear of the car.`}
  value={live.prefs.speedo}
  options={SPEEDO}
  onchange={(value) => live.set("speedo", value)}
  visual={wire}
/>
<ChoiceRow
  label="HUD size"
  help="How big speed, laps, map and the race cards draw. Touch buttons keep their own size."
  value={live.prefs.hud_size}
  options={SIZES}
  onchange={(value) => live.set("hud_size", value)}
/>
<StepRow
  label="Theme"
  help={() =>
    pick === in_use
      ? "Colours for the whole game. Step through to preview one on the menu and HUD."
      : `Previewing ${pick}, not saved yet. Press A or tap Keep to save it; the page reloads and the 3D scene takes the new colours.`}
  value={pick}
  options={names}
  onchange={preview}
  visual={swatches}
  accept={keep}
  onenter={enter}
  onleave={leave}
>
  {#if pick !== in_use}
    <Button size="sm" tabindex={-1} onclick={(event) => (event.stopPropagation(), keep())}>Keep</Button>
  {/if}
</StepRow>
<LinkRow label="Make your own theme" help="Roll colours, keep the ones you like, then name and save it." value="Roll, adjust, save" open={() => nav.show("creator")} />
<LinkRow label="Your themes" help="Themes you made: delete the ones you don't want." value={`${mine} saved`} open={() => nav.show("themes")} hidden={mine === 0} />

<style>
  .set-swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .set-swatches i {
    width: var(--control-h-lg);
    height: var(--control-h-lg);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
</style>

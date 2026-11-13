<script lang="ts">
  import { THEMES, choose_theme, current_theme, find_saved, find_theme, load_saved_themes } from "../../theme/theme";
  import { DashPlace, MapCorner, MapView, SpeedoStyle } from "../prefs";
  import Button from "../ui/Button.svelte";
  import type { MenuState } from "../ui/menu-state.svelte";
  import HudWire from "./HudWire.svelte";
  import { use_nav } from "./nav.svelte";
  import ChoiceRow from "./rows/ChoiceRow.svelte";
  import LinkRow from "./rows/LinkRow.svelte";
  import StepRow from "./rows/StepRow.svelte";
  import { BASE_TOKENS, HUD_LAYOUTS, MAP_VIEWS, hud_layout, options, reload_without } from "./sections";

  interface Props {
    live: MenuState;
  }

  let { live }: Props = $props();

  const nav = use_nav();
  const LAYOUTS = HUD_LAYOUTS.map(({ value, name }) => ({ value, label: name }));
  const DASH = options([
    [DashPlace.RIGHT, "Right"],
    [DashPlace.CENTER, "Centre"],
  ]);
  const SPEEDO = options([
    [SpeedoStyle.RING, "Ring"],
    [SpeedoStyle.BAR, "Bar"],
  ]);
  const MAPS = Object.values(MapView).map((view) => ({ value: view, label: MAP_VIEWS[view][0] }));
  const CORNERS = options([
    [MapCorner.BOTTOM_LEFT, "Bottom left"],
    [MapCorner.TOP_RIGHT, "Top right"],
  ]);

  const saved = load_saved_themes();
  const active = current_theme();
  const in_use = THEMES[active] ? active : (find_saved(saved, active)?.name ?? active);
  const names = [...saved.map(({ name }) => ({ value: name, label: name })), ...Object.keys(THEMES).map((name) => ({ value: name, label: name }))];
  let pick = $state(in_use);
  const picked = $derived(find_theme(pick, saved));
  const mine = $derived(live.live(() => load_saved_themes().length));

  function use() {
    if (pick === in_use) return;
    choose_theme(pick);
    reload_without("theme");
  }
</script>

{#snippet wire()}
  <HudWire hud={live.prefs.hud} map={live.prefs.map} />
{/snippet}

{#snippet swatches()}
  {#if picked}
    <span class="set-swatches" aria-hidden="true">
      {#each BASE_TOKENS as [token] (token)}<i style:background={picked[token]}></i>{/each}
    </span>
  {/if}
{/snippet}

<StepRow
  label="HUD layout"
  help={() => {
    const layout = hud_layout(live.prefs.hud);
    return `Where speed, laps, map and buttons sit. ${layout.name}: ${layout.note}.`;
  }}
  value={live.prefs.hud}
  options={LAYOUTS}
  onchange={(value) => live.set("hud", value)}
  visual={wire}
/>
<ChoiceRow
  label="Dash"
  help="Speed, gear and aids. Racing always centres it, Compact keeps it up top."
  value={live.prefs.dash}
  options={DASH}
  onchange={(value) => live.set("dash", value)}
  visual={wire}
/>
<ChoiceRow
  label="Speedometer"
  help="Classic layout. Ring: revs round the speed. Bar: a big speed over a rev bar."
  value={live.prefs.speedo}
  options={SPEEDO}
  onchange={(value) => live.set("speedo", value)}
/>
<ChoiceRow label="Map" help={() => `${MAP_VIEWS[live.prefs.map][1]}.`} value={live.prefs.map} options={MAPS} onchange={(value) => live.set("map", value)} visual={wire} />
<!-- Touch always keeps the map top right, clear of the thumbs, so the choice is a desk one. -->
<ChoiceRow
  label="Map corner"
  help="Classic layout. Bottom left mirrors the speedometer; top right keeps the lower screen clear."
  value={live.prefs.map_corner}
  options={CORNERS}
  onchange={(value) => live.set("map_corner", value)}
  only="desk"
/>
<StepRow
  label="Theme"
  help={() => (pick === in_use ? "Colours for the whole game." : "Press A or tap Use to switch to it. The page reloads.")}
  value={pick}
  options={names}
  onchange={(value) => (pick = value)}
  visual={swatches}
  accept={use}
>
  {#if pick !== in_use}
    <Button size="sm" tabindex={-1} onclick={(event) => (event.stopPropagation(), use())}>Use</Button>
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
    border: 1px solid var(--set-line);
    border-radius: var(--radius-sm);
  }
</style>

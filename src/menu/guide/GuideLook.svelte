<script lang="ts">
  import { generate_theme } from "../../theme/random-theme";
  import { THEMES, choose_theme, current_theme, derive_theme, find_saved, find_theme, load_saved_themes, store_saved_themes, with_saved, without_saved } from "../../theme/theme";
  import { rolled_name } from "../guide-rules";
  import Tile from "../ui/Tile.svelte";
  import GuideDash from "./GuideDash.svelte";
  import GuideLayout from "./GuideLayout.svelte";
  import GuideShot from "./GuideShot.svelte";
  import { LOOKS, SWATCHES } from "./guide-text";
  import type { GuideState } from "./guide.svelte";

  interface Props {
    guide: GuideState;
  }

  let { guide }: Props = $props();

  const active = current_theme();
  const rolled = $derived(guide.rolled_visit && !THEMES[active]);

  function pick(name: string) {
    if (name === active) return;
    if (rolled) store_saved_themes(without_saved(load_saved_themes(), active));
    choose_theme(name);
    guide.host.reload_on_look(false);
  }

  function roll() {
    const saved = load_saved_themes();
    const replace = guide.rolled_visit && find_saved(saved, active) ? active : null;
    const name = replace ?? rolled_name(saved.map((theme) => theme.name));
    const base = generate_theme({ mode: Math.random() < 0.5 ? "dark" : "light", harmony: "any", vibrance: 0.5, contrast: 0.5 });
    if (!store_saved_themes(with_saved(saved, name, derive_theme(base)))) return;
    choose_theme(name);
    guide.host.reload_on_look(true);
  }
</script>

{#snippet swatch(name: string)}
  {@const theme = find_theme(name)}
  <span class="guide-swatch" style:background={theme?.background}>
    {#each SWATCHES as token (token)}<i style:background={theme?.[token]}></i>{/each}
  </span>
{/snippet}

<GuideLayout title="Pick a look" lede="Colours for the menu, the HUD and the whole world. The game reloads in each one you pick." visual_on_short={false}>
  {#snippet copy()}
    <div class="guide-tiles" role="group" aria-label="Looks">
      {#each LOOKS as name (name)}
        <Tile title={name} size="sm" selected={name === active} onclick={() => pick(name)}>{@render swatch(name)}</Tile>
      {/each}
      {#if rolled}
        <Tile title="Roll again" size="sm" selected onclick={roll}>{@render swatch(active)}</Tile>
      {:else}
        <Tile title="Roll one" icon="icon-dice" size="sm" onclick={roll} />
      {/if}
    </div>
    <small class="guide-help">Make your own later: Settings, Display.</small>
  {/snippet}
  {#snippet visual()}
    <GuideShot picture={guide.host.picture(guide.host.kind).src} tag={guide.prefs.name ?? guide.host.name()}>
      <GuideDash aids={guide.prefs} />
    </GuideShot>
  {/snippet}
</GuideLayout>

<style>
  .guide-tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .guide-tiles > :global(.ui-tile) {
    justify-content: flex-start;
  }

  .guide-swatch {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    width: fit-content;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
  }

  .guide-swatch i {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
  }

  .guide-help {
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
    text-wrap: pretty;
  }

  @media (max-height: 500px) {
    .guide-tiles {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
</style>

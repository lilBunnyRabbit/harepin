<script lang="ts">
  import type { SeasonTab } from "./series-view";
  import Icon from "./ui/Icon.svelte";
  import IconButton from "./ui/IconButton.svelte";

  interface Props {
    seasons: readonly SeasonTab[];
    at: number;
    onseason: (at: number) => void;
  }

  let { seasons, at, onseason }: Props = $props();

  const tab = $derived(seasons[at]);
</script>

<div class="sw" role="group" aria-label="Seasons">
  <IconButton icon="icon-back" label="Previous season" shape="round" disabled={at <= 0} onclick={() => onseason(at - 1)} />
  <div class="sw-mid">
    <h2 aria-live="polite">
      {#if !tab.open}<Icon name="icon-lock" />{/if}{tab.name} series
    </h2>
    <span class="sw-dots" aria-hidden="true">
      {#each seasons as season, i (season.name)}<span class="sw-dot" data-on={i === at} data-state={season.done ? "done" : season.open ? "open" : "locked"}></span>{/each}
    </span>
  </div>
  <IconButton icon="icon-back" label="Next season" shape="round" flip disabled={at >= seasons.length - 1} onclick={() => onseason(at + 1)} />
</div>

<style>
  .sw {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }

  .sw-mid {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    min-width: 0;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-3xl);
    font-weight: 800;
    line-height: 1.05;
    white-space: nowrap;
  }

  h2 :global(svg) {
    width: 0.7em;
    height: 0.7em;
    color: var(--set-dim);
  }

  .sw-dots {
    display: flex;
    gap: var(--space-2);
  }

  .sw-dot {
    width: var(--space-2);
    height: var(--space-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-full);
  }

  .sw-dot[data-state="open"] {
    background: var(--line-strong);
  }

  .sw-dot[data-state="done"] {
    border-color: var(--primary);
    background: var(--primary);
  }

  .sw-dot[data-on="true"] {
    outline: 2px solid var(--foreground);
    outline-offset: 1px;
  }

  @media (max-height: 500px) {
    h2 {
      font-size: var(--text-xl);
    }
  }
</style>

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

<div class="sw" role="group" aria-label="Seasons" data-state={tab.done ? "done" : tab.open ? "open" : "locked"}>
  <!-- The steps lead the line, so they keep their spot whatever the season is called. -->
  <div class="sw-top">
    <span class="sw-step">
      <IconButton icon="icon-back" label="Previous season" shape="round" size="sm" disabled={at <= 0} onclick={() => onseason(at - 1)} />
      <IconButton icon="icon-back" label="Next season" shape="round" size="sm" flip disabled={at >= seasons.length - 1} onclick={() => onseason(at + 1)} />
    </span>
    <span class="sw-of">Season {at + 1} of {seasons.length}{tab.done ? " · finished" : ""}</span>
  </div>
  <h2 aria-live="polite">
    {#if !tab.open}<Icon name="icon-lock" />{/if}<span class="sw-name">{tab.name} series</span>
  </h2>
</div>

<style>
  .sw {
    display: grid;
    gap: var(--gap-xs);
    min-width: 0;
  }

  .sw-of {
    color: var(--dim);
    font-size: var(--type-eyebrow);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  [data-state="done"] .sw-of {
    color: var(--primary);
  }

  .sw-top {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    min-width: 0;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    min-width: 0;
    margin: 0;
    font-size: var(--type-h1);
    font-weight: 800;
    line-height: 1.05;
    white-space: nowrap;
  }

  .sw-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  h2 :global(svg) {
    flex: none;
    width: 0.7em;
    height: 0.7em;
    color: var(--dim);
  }

  .sw-step {
    display: flex;
    flex: none;
    gap: var(--gap-sm);
  }
</style>

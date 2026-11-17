<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    pad?: "md" | "sm" | "none";
    focused?: boolean;
    flat?: boolean;
    picture?: Snippet;
    wide?: boolean;
    onclick?: (event: MouseEvent) => void;
    onfocus?: () => void;
    /** Holds a `RowList`: the rows bring their own padding. */
    list?: boolean;
    label?: string;
    selected?: boolean;
    class?: string;
    /** @deprecated The old panel ladder: every variant draws the one card now. Goes with the last old page. */
    variant?: "panel" | "well" | "raised";
    children: Snippet;
  }

  let { pad = "md", focused = false, flat = false, picture, wide = false, onclick, onfocus, list = false, label, selected, class: extra, children }: Props = $props();

  const classes = $derived(["ui-card", list && "ui-list", picture && "ui-pictured", wide && "ui-wide", extra]);
</script>

{#snippet body()}
  {#if picture}
    <div class="ui-card-pic">{@render picture()}</div>
    <div class="ui-card-cap">{@render children()}</div>
  {:else}
    {@render children()}
  {/if}
{/snippet}

{#if onclick}
  <button type="button" class={[classes, "ui-tile"]} data-pad={pad} data-focused={focused ? "" : undefined} data-flat={flat ? "" : undefined} aria-label={label} aria-pressed={selected} {onclick} {onfocus}>{@render body()}</button>
{:else}
  <section class={classes} data-pad={pad} data-focused={focused ? "" : undefined} data-flat={flat ? "" : undefined} aria-label={label}>{@render body()}</section>
{/if}

<style>
  .ui-card {
    --card-pad: var(--pad);
    display: flex;
    flex-direction: column;
    gap: var(--gap-md);
    min-width: 0;
    min-height: 0;
    padding: var(--card-pad);
    border: 1px solid var(--line-strong);
    border-radius: var(--card-radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--foreground);
  }

  [data-pad="sm"] {
    --card-pad: var(--gap-md) var(--gap);
  }

  [data-pad="none"] {
    --card-pad: 0;
  }

  .ui-card.ui-list {
    --card-pad: calc(var(--pad) - var(--gap-md));
  }

  [data-flat] {
    box-shadow: none;
  }

  .ui-pictured {
    gap: 0;
    padding: 0;
    overflow: hidden;
  }

  .ui-card-pic {
    display: grid;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .ui-card-pic > :global(*) {
    width: 100%;
    height: 100%;
    min-height: 0;
    object-fit: cover;
  }

  .ui-card-cap {
    display: flex;
    flex-direction: column;
    gap: var(--gap-sm);
    min-width: 0;
    padding: var(--card-pad);
  }

  .ui-tile {
    justify-content: flex-start;
    align-items: stretch;
    height: auto;
    font: inherit;
    text-align: left;
    white-space: normal;
    cursor: pointer;
  }

  .ui-tile:hover {
    border-color: var(--dim);
    background: var(--surface);
  }

  .ui-tile[aria-pressed="true"] {
    border-color: var(--primary);
  }

  [data-focused],
  .ui-tile:focus-visible {
    outline: var(--mark-w) solid var(--cottontail);
    outline-offset: var(--space-0);
  }

  @media (max-height: 500px) {
    .ui-wide {
      flex-direction: row;
    }

    .ui-wide > .ui-card-pic {
      flex: 0 0 30%;
    }

    .ui-wide > .ui-card-cap {
      flex: 1;
      justify-content: center;
    }
  }
</style>

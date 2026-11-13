<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    variant?: "panel" | "well" | "raised";
    onclick?: () => void;
    /** Holds a `RowList`: the rows bring their own padding. */
    list?: boolean;
    label?: string;
    class?: string;
    children: Snippet;
  }

  let { variant = "panel", onclick, list = false, label, class: extra, children }: Props = $props();
</script>

{#if onclick}
  <button type="button" class={["ui-card", "ui-tile", extra]} data-variant={variant} aria-label={label} {onclick}>{@render children()}</button>
{:else}
  <section class={["ui-card", extra]} class:ui-list={list} data-variant={variant} aria-label={label}>{@render children()}</section>
{/if}

<style>
  .ui-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
    padding: var(--space-5);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-lg);
    background: var(--set-panel);
    color: var(--foreground);
  }

  [data-variant="well"] {
    background: var(--set-well);
  }

  [data-variant="raised"] {
    background: var(--set-raised);
  }

  .ui-tile {
    height: auto;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .ui-tile:hover {
    border-color: var(--line-strong);
  }

  .ui-tile:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  @media (max-height: 500px), (max-width: 600px) {
    .ui-card {
      padding: var(--space-4);
    }
  }

  .ui-card.ui-list {
    padding: var(--space-2);
  }
</style>

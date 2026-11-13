<script lang="ts" generics="T extends string">
  import type { Tab } from "./types";

  interface Props {
    items: readonly Tab<T>[];
    value: T;
    variant?: "nav" | "section" | "steps";
    label: string;
    onchange?: (id: T) => void;
  }

  let { items, value = $bindable(), variant = "section", label, onchange }: Props = $props();

  function pick(id: T) {
    value = id;
    onchange?.(id);
  }
</script>

<nav class="ui-tabs" data-variant={variant} aria-label={label}>
  {#each items as item, index (item.id)}
    <button type="button" class="ui-tab" aria-current={item.id === value} onclick={() => pick(item.id)}>
      {#if variant === "steps"}<span class="ui-step">{index + 1}</span>{/if}
      {item.label}
    </button>
  {/each}
</nav>

<style>
  .ui-tabs {
    display: flex;
    gap: var(--space-1);
    max-width: 100%;
    padding: var(--space-1);
    overflow-x: auto;
    scrollbar-width: none;
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--set-well);
  }

  .ui-tab {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    height: var(--control-h);
    padding: 0 var(--space-4);
    border: 1px solid transparent;
    border-radius: var(--radius-full);
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 120ms ease-out,
      color 120ms ease-out;
  }

  .ui-tab:hover {
    color: var(--foreground);
    background: color-mix(in oklch, var(--set-raised) 45%, transparent);
  }

  .ui-tab[aria-current="true"] {
    color: var(--foreground);
    background: var(--set-raised);
    border-color: var(--line-strong);
    box-shadow: 0 1px 2px color-mix(in oklch, var(--background-darkest) 40%, transparent);
  }

  .ui-tab:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }

  [data-variant="nav"] .ui-tab {
    padding: 0 var(--space-5);
  }

  .ui-step {
    display: inline-grid;
    place-items: center;
    width: var(--control-h-sm);
    height: var(--control-h-sm);
    margin-left: calc(-1 * var(--space-2));
    border-radius: var(--radius-full);
    background: var(--set-well);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .ui-tab[aria-current="true"] .ui-step {
    background: var(--primary);
    color: var(--on-primary);
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-tab {
      transition: none;
    }
  }
</style>

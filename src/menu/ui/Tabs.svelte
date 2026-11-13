<script lang="ts" generics="T extends string">
  import Icon from "./Icon.svelte";
  import type { Tab } from "./types";

  interface Props {
    items: readonly Tab<T>[];
    value: T;
    variant?: "nav" | "section" | "steps";
    label: string;
    /** `steps` only: earlier steps show a check instead of their number. */
    done?: boolean;
    /** At phone width: tighter tab padding; in `steps`, the steps other than the current one show just their number. */
    compact?: boolean;
    /** The track takes the full width and the tabs share it, a long label ellipsizing instead of scrolling the track. */
    fill?: boolean;
    onchange?: (id: T) => void;
  }

  let { items, value = $bindable(), variant = "section", label, done = false, compact = false, fill = false, onchange }: Props = $props();

  const current = $derived(items.findIndex((item) => item.id === value));

  function pick(id: T) {
    value = id;
    onchange?.(id);
  }
</script>

<nav class="ui-tabs" class:ui-compact={compact} class:ui-fill={fill} data-variant={variant} aria-label={label}>
  {#each items as item, index (item.id)}
    <button type="button" class="ui-tab" aria-current={item.id === value} onclick={() => pick(item.id)}>
      {#if variant === "steps"}
        {@const passed = done && index < current}
        <span class="ui-step" class:ui-passed={passed}>{#if passed}<Icon name="icon-check" />{:else}{index + 1}{/if}</span>
      {/if}
      {#if compact || fill}<span class="ui-tab-label">{item.label}</span>{:else}{item.label}{/if}
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

  .ui-fill {
    width: 100%;
  }

  .ui-fill .ui-tab {
    flex: 1 1 0;
    justify-content: center;
    min-width: 0;
  }

  .ui-fill .ui-tab-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ui-step.ui-passed {
    --icon-size: var(--text-lg);
    box-shadow: inset 0 0 0 1px var(--primary);
    color: var(--primary);
  }

  @media (max-width: 600px) {
    .ui-compact .ui-tab,
    [data-variant="nav"].ui-compact .ui-tab {
      padding: 0 var(--space-3);
    }

    [data-variant="steps"].ui-compact .ui-tab:not([aria-current="true"]) {
      padding: 0 var(--space-1);
    }

    [data-variant="steps"].ui-compact .ui-tab:not([aria-current="true"]) .ui-step {
      margin-left: 0;
    }

    [data-variant="steps"].ui-compact .ui-tab:not([aria-current="true"]) .ui-tab-label {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-tab {
      transition: none;
    }
  }
</style>

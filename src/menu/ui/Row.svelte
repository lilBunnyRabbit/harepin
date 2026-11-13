<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    label: string;
    help?: string;
    icon?: string;
    href?: string;
    external?: boolean;
    onclick?: () => void;
    control?: Snippet;
    detail?: Snippet;
    /** Phones put the control under the label, at full width. */
    stack?: boolean;
  }

  let { label, help, icon, href, external = false, onclick, control, detail, stack = false }: Props = $props();
</script>

{#snippet text()}
  {#if icon}<span class="ui-lead"><Icon name={icon} /></span>{/if}
  <span class="ui-text">
    <span class="ui-label">{label}</span>
    {#if help}<small class="ui-help">{help}</small>{/if}
    {#if detail}<span class="ui-help">{@render detail()}</span>{/if}
  </span>
{/snippet}

{#if href}
  <a class="ui-row ui-action" {href} target={external ? "_blank" : undefined} rel={external ? "noopener" : undefined}>
    {@render text()}
    <span class="ui-end"><Icon name={external ? "icon-external" : "icon-back"} flip={!external} /></span>
  </a>
{:else if onclick}
  <button type="button" class="ui-row ui-action" {onclick}>
    {@render text()}
    <span class="ui-end"><Icon name="icon-back" flip /></span>
  </button>
{:else}
  <div class="ui-row" class:ui-stack={stack}>
    {@render text()}
    {#if control}<span class="ui-control">{@render control()}</span>{/if}
  </div>
{/if}

<style>
  .ui-row {
    --row-h: 72px;
    --lead-size: 22px;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
    min-height: var(--row-h);
    height: auto;
    padding: var(--space-4);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--set-dim);
    font: inherit;
    text-align: left;
    text-decoration: none;
  }

  .ui-action {
    cursor: pointer;
  }

  .ui-action:hover {
    background: color-mix(in oklch, var(--set-raised) 50%, transparent);
  }

  .ui-action:hover .ui-end {
    color: var(--foreground);
  }

  .ui-row:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }

  .ui-lead {
    --icon-size: var(--lead-size);
    display: flex;
    flex: none;
    color: var(--primary);
  }

  .ui-text {
    display: grid;
    flex: 1;
    gap: var(--space-0);
    min-width: 0;
  }

  .ui-label {
    color: var(--foreground);
    font-size: var(--text-xl);
    font-weight: 600;
    line-height: 1.3;
  }

  .ui-help {
    font-size: var(--text-sm);
    line-height: 1.4;
    text-wrap: pretty;
  }

  .ui-end,
  .ui-control {
    display: flex;
    flex: none;
    align-items: center;
  }

  @media (pointer: coarse) {
    .ui-row {
      --row-h: 80px;
    }
  }

  @media (max-width: 600px) {
    .ui-stack {
      flex-wrap: wrap;
      row-gap: var(--space-3);
    }

    .ui-stack .ui-control {
      flex: 1 0 100%;
    }

    .ui-stack .ui-control > :global(*) {
      flex: 1;
    }
  }
</style>

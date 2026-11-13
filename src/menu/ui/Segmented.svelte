<script lang="ts" generics="T extends string | number">
  import type { Option } from "./types";

  interface Props {
    options: readonly Option<T>[];
    value: T;
    label: string;
    disabled?: boolean;
    tabindex?: number;
    onchange?: (value: T) => void;
  }

  let { options, value = $bindable(), label, disabled = false, tabindex, onchange }: Props = $props();

  function pick(next: T) {
    value = next;
    onchange?.(next);
  }
</script>

<div class="ui-segmented" role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <button type="button" class="ui-segment" role="radio" aria-checked={option.value === value} {disabled} {tabindex} onclick={() => pick(option.value)}>{option.label}</button>
  {/each}
</div>

<style>
  .ui-segmented {
    display: grid;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
    gap: var(--space-0);
    height: var(--control-h);
    padding: var(--space-1);
    border-radius: var(--radius-full);
    background: var(--set-well);
  }

  .ui-segment {
    min-width: 0;
    height: auto;
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-full);
    background: none;
    color: var(--set-dim);
    font: inherit;
    font-size: var(--text-md);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .ui-segment:hover:not(:disabled) {
    background: none;
    color: var(--foreground);
  }

  .ui-segment[aria-checked="true"] {
    color: var(--foreground);
    background: var(--set-raised);
    box-shadow: 0 1px 2px color-mix(in oklch, var(--background-darkest) 30%, transparent);
  }

  .ui-segment:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: -2px;
  }

  .ui-segment:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>

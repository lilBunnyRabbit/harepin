<script lang="ts" generics="T extends string">
  import type { Option } from "./types";

  interface Props {
    options: readonly Option<T>[];
    value: T;
    label: string;
    show_label?: boolean;
    help?: string;
    disabled?: boolean;
    onchange?: (value: T) => void;
  }

  let { options, value = $bindable(), label, show_label = false, help, disabled = false, onchange }: Props = $props();
</script>

<label class="ui-field">
  {#if show_label}<span class="ui-label">{label}</span>{/if}
  <select class="ui-select" aria-label={show_label ? undefined : label} {disabled} bind:value onchange={() => onchange?.(value)}>
    {#each options as option (option.value)}<option value={option.value} disabled={option.disabled}>{option.label}</option>{/each}
  </select>
  {#if help}<small class="ui-help">{help}</small>{/if}
</label>

<style>
  .ui-field {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }

  .ui-label {
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 1.3;
  }

  .ui-help {
    margin-top: calc(var(--space-0) - var(--space-2));
    color: var(--set-dim);
    font-size: var(--text-sm);
    line-height: 1.4;
  }

  .ui-select {
    min-width: 0;
    height: var(--control-h);
    padding: 0 var(--space-3);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-sm);
    background: var(--set-soft);
    color: var(--foreground);
    font: inherit;
    font-size: var(--text-lg);
    cursor: pointer;
  }

  .ui-select:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .ui-select:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>

<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLInputAttributes, "value"> {
    value: string;
    label?: string;
    help?: string;
    mono?: boolean;
    center?: boolean;
  }

  let { value = $bindable(), label, help, mono = false, center = false, type = "text", class: extra, ...rest }: Props = $props();
</script>

<label class={["ui-field", extra]}>
  {#if label}<span class="ui-label">{label}</span>{/if}
  <input class="ui-input" class:ui-mono={mono} class:ui-center={center} {type} autocomplete="off" bind:value {...rest} />
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

  .ui-input {
    width: 100%;
    min-width: 0;
    height: var(--control-h);
    padding: 0 var(--space-3);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-sm);
    background: var(--set-soft);
    color: var(--foreground);
    font: inherit;
    font-size: var(--text-lg);
    user-select: text;
  }

  .ui-input::placeholder {
    color: var(--set-dim);
  }

  .ui-input:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .ui-mono {
    font-family: var(--font-mono);
  }

  .ui-center {
    text-align: center;
  }
</style>

<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";

  interface Props extends Omit<HTMLInputAttributes, "value"> {
    value: string;
    label: string;
  }

  let { value = $bindable(), label, ...rest }: Props = $props();
</script>

<label class="ui-chip" title={label}>
  <input class="ui-input" type="text" autocomplete="off" aria-label={label} bind:value {...rest} />
  <Icon name="icon-edit" />
</label>

<style>
  .ui-chip {
    --icon-size: var(--text-lg);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    height: var(--control-h);
    padding: 0 var(--space-3);
    border: 1px solid var(--set-line);
    border-radius: var(--radius-full);
    background: var(--set-panel);
    color: var(--set-dim);
  }

  .ui-chip:focus-within {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .ui-input {
    width: 12ch;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--foreground);
    font: inherit;
    font-size: var(--text-md);
    font-weight: 600;
    outline: none;
    user-select: text;
  }

  .ui-input::placeholder {
    color: var(--set-dim);
  }
</style>

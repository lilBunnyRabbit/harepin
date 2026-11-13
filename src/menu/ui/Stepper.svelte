<script lang="ts" generics="T extends string | number">
  import IconButton from "./IconButton.svelte";
  import type { Option } from "./types";

  interface Props {
    options: readonly Option<T>[];
    value: T;
    label: string;
    onchange?: (value: T) => void;
  }

  let { options, value = $bindable(), label, onchange }: Props = $props();

  const index = $derived(options.findIndex((option) => option.value === value));

  function step(by: number) {
    const next = options[index + by];
    if (!next) return;
    value = next.value;
    onchange?.(next.value);
  }
</script>

<div class="ui-stepper" role="group" aria-label={label}>
  <IconButton icon="icon-back" label="Previous" size="sm" disabled={index <= 0} onclick={() => step(-1)} />
  <div class="ui-middle">
    <span class="ui-value" aria-live="polite">{options[index]?.label ?? ""}</span>
    <span class="ui-dots" aria-hidden="true">
      {#each options as option, at (option.value)}<span class="ui-dot" class:ui-on={at === index}></span>{/each}
    </span>
  </div>
  <IconButton icon="icon-back" label="Next" size="sm" flip disabled={index >= options.length - 1} onclick={() => step(1)} />
</div>

<style>
  .ui-stepper {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .ui-middle {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    min-width: 8ch;
  }

  .ui-value {
    font-size: var(--text-md);
    font-weight: 600;
    white-space: nowrap;
  }

  .ui-dots {
    display: flex;
    gap: var(--space-1);
  }

  .ui-dot {
    width: var(--space-1);
    height: var(--space-1);
    border-radius: var(--radius-full);
    background: var(--line-strong);
  }

  .ui-dot.ui-on {
    background: var(--primary);
  }
</style>

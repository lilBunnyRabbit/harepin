<script lang="ts" generics="T extends string | number">
  import type { Snippet } from "svelte";
  import Stepper from "../../ui/Stepper.svelte";
  import type { Option } from "../../ui/types";
  import SettingRow from "../SettingRow.svelte";

  interface Props {
    label: string;
    help: string | (() => string);
    value: T;
    options: readonly Option<T>[];
    onchange: (value: T) => void;
    visual?: Snippet;
    accept?: () => void;
    children?: Snippet;
  }

  let { label, help, value, options, onchange, visual, accept, children }: Props = $props();

  function step(by: number) {
    const at = options.findIndex((option) => option.value === value);
    onchange(options[(at + by + options.length) % options.length].value);
  }
</script>

<SettingRow {label} {help} {visual} adjust={step} accept={accept ?? (() => step(1))}>
  <span class="set-step">
    {@render children?.()}
    <Stepper {options} {value} {label} wrap max_dots={8} tabindex={-1} {onchange} />
  </span>
</SettingRow>

<style>
  .set-step {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
</style>

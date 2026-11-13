<script lang="ts" generics="T extends string | number">
  import type { Snippet } from "svelte";
  import Segmented from "../../ui/Segmented.svelte";
  import type { Option } from "../../ui/types";
  import SettingRow from "../SettingRow.svelte";

  interface Props {
    label: string;
    help: string | (() => string);
    value: T | null;
    options: readonly Option<T>[];
    onchange: (value: T) => void;
    visual?: Snippet;
    only?: "touch" | "desk";
  }

  let { label, help, value, options, onchange, visual, only }: Props = $props();

  const at = $derived(options.findIndex((option) => option.value === value));
</script>

<SettingRow
  {label}
  {help}
  {visual}
  {only}
  stack
  adjust={(by) => onchange(options[Math.max(0, Math.min(options.length - 1, at + by))].value)}
  accept={() => onchange(options[(at + 1) % options.length].value)}
>
  <Segmented {options} {value} {label} tabindex={-1} {onchange} />
</SettingRow>

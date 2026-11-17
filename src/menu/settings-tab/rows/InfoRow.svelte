<script lang="ts">
  import type { Snippet } from "svelte";
  import SettingRow from "../SettingRow.svelte";

  interface Props {
    label: string;
    help: string | (() => string);
    value: string;
    visual?: Snippet;
  }

  let { label, help, value, visual }: Props = $props();
</script>

<SettingRow {label} {help} {visual} stack>
  <span class="set-info">{value}</span>
</SettingRow>

<style>
  .set-info {
    color: var(--dim);
    font-size: var(--type-body);
    text-align: right;
  }
</style>

<script lang="ts">
  import Toggle from "../../ui/Toggle.svelte";
  import SettingRow from "../SettingRow.svelte";

  interface Props {
    label: string;
    help: string | (() => string);
    checked: boolean;
    onchange: (checked: boolean) => void;
    effect?: [string, string];
  }

  let { label, help, checked, onchange, effect }: Props = $props();
</script>

{#snippet both()}
  {#if effect}
    <span class="set-effect">
      <b>On</b><span>{effect[0]}</span>
      <b>Off</b><span>{effect[1]}</span>
    </span>
  {/if}
{/snippet}

<SettingRow {label} {help} detail={effect ? both : undefined} adjust={(by) => onchange(by > 0)} accept={() => onchange(!checked)}>
  <Toggle {checked} {label} tabindex={-1} {onchange} />
</SettingRow>

<style>
  .set-effect {
    display: grid;
    grid-template-columns: 3ch minmax(0, 1fr);
    gap: var(--gap-xs) var(--gap-sm);
    max-width: 56ch;
    margin-top: var(--gap-xs);
  }

  .set-effect b {
    color: var(--foreground);
    font-weight: 600;
  }
</style>

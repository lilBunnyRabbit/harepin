<script lang="ts">
  import Toggle from "../../ui/Toggle.svelte";
  import SettingRow from "../SettingRow.svelte";

  interface Props {
    label: string;
    help: string | (() => string);
    checked: boolean;
    onchange: (checked: boolean) => void;
    /** What on and off each do, spelled out under the label. */
    effect?: [string, string];
  }

  let { label, help, checked, onchange, effect }: Props = $props();
</script>

<SettingRow {label} {help} line={effect ? `${checked ? "On" : "Off"}: ${effect[checked ? 0 : 1]}` : undefined} adjust={(by) => onchange(by > 0)} accept={() => onchange(!checked)}>
  <Toggle {checked} {label} {onchange} />
</SettingRow>
